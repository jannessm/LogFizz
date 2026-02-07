import Stripe from 'stripe';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';

export class PaymentService {
  private stripe: Stripe;
  private userRepository = AppDataSource.getRepository(User);

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.warn('STRIPE_SECRET_KEY not configured. Payment features will not work.');
      // Initialize with a dummy key to prevent errors, but payments won't work
      this.stripe = new Stripe('sk_test_dummy', { apiVersion: '2026-01-28.clover' });
    } else {
      this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-01-28.clover' });
    }
  }

  /**
   * Create a checkout session for annual subscription
   */
  async createCheckoutSession(userId: string, successUrl: string, cancelUrl: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
      user.stripe_customer_id = customerId;
      await this.userRepository.save(user);
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'TapShift Annual Subscription',
              description: 'Full access to TapShift time tracking application',
            },
            unit_amount: 500, // €5.00 in cents
            recurring: {
              interval: 'year',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
      },
    });

    return session.url || '';
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.user_id;
    if (!userId) return;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const subscription = await this.stripe.subscriptions.retrieve(session.subscription as string);

    user.subscription_status = 'active';
    user.stripe_subscription_id = subscription.id;
    // Note: current_period_end exists in Stripe API but may not be in type definitions
    // Using type assertion to access it safely
    const periodEnd = (subscription as any).current_period_end;
    if (periodEnd) {
      user.subscription_end_date = new Date(periodEnd * 1000);
    }
    await this.userRepository.save(user);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const user = await this.userRepository.findOne({ 
      where: { stripe_subscription_id: subscription.id } 
    });
    if (!user) return;

    user.subscription_status = subscription.status === 'active' ? 'active' : 'expired';
    // Note: current_period_end exists in Stripe API but may not be in type definitions
    // Using type assertion to access it safely
    const periodEnd = (subscription as any).current_period_end;
    if (periodEnd) {
      user.subscription_end_date = new Date(periodEnd * 1000);
    }
    await this.userRepository.save(user);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const user = await this.userRepository.findOne({ 
      where: { stripe_subscription_id: subscription.id } 
    });
    if (!user) return;

    user.subscription_status = 'canceled';
    await this.userRepository.save(user);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Note: subscription property exists in Stripe API but may not be in type definitions
    // Using type assertion to access it safely
    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) return;

    const user = await this.userRepository.findOne({ 
      where: { stripe_subscription_id: subscriptionId } 
    });
    if (!user) return;

    user.subscription_status = 'active';
    await this.userRepository.save(user);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Note: subscription property exists in Stripe API but may not be in type definitions
    // Using type assertion to access it safely
    const subscriptionId = (invoice as any).subscription as string;
    if (!subscriptionId) return;

    const user = await this.userRepository.findOne({ 
      where: { stripe_subscription_id: subscriptionId } 
    });
    if (!user) return;

    user.subscription_status = 'expired';
    await this.userRepository.save(user);
  }

  /**
   * Get subscription status for a user
   */
  async getSubscriptionStatus(userId: string): Promise<{
    status: string;
    trialEndDate?: Date;
    subscriptionEndDate?: Date;
    hasAccess: boolean;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    let hasAccess = true;

    // Check if in trial period
    if (user.subscription_status === 'trial' && user.trial_end_date) {
      hasAccess = now < user.trial_end_date;
    } else if (user.subscription_status === 'active' && user.subscription_end_date) {
      hasAccess = now < user.subscription_end_date;
    } else if (user.subscription_status === 'expired' || user.subscription_status === 'canceled') {
      hasAccess = false;
    }

    return {
      status: user.subscription_status || 'trial',
      trialEndDate: user.trial_end_date,
      subscriptionEndDate: user.subscription_end_date,
      hasAccess,
    };
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.stripe_subscription_id) {
      throw new Error('No active subscription found');
    }

    await this.stripe.subscriptions.cancel(user.stripe_subscription_id);
    
    user.subscription_status = 'canceled';
    await this.userRepository.save(user);
  }
}
