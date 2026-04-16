import Stripe from 'stripe';
import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { dayjs } from '../../../lib/utils/dayjs.js';

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
      user.subscription_end_date = dayjs(periodEnd * 1000).toDate();
    } else {
      user.subscription_end_date = dayjs().add(1, 'year').toDate(); // Fallback if period end is not available
    }
    await this.userRepository.save(user);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const user = await this.userRepository.findOne({ 
      where: { stripe_subscription_id: subscription.id } 
    });
    if (!user) return;

    // Note: current_period_end exists in Stripe API but may not be in type definitions
    // Using type assertion to access it safely
    const periodEnd = (subscription as any).current_period_end;
    if (periodEnd) {
      user.subscription_end_date = new Date(periodEnd * 1000);
    }

    // If cancel_at_period_end is set, the subscription is scheduled to cancel — mark as canceled
    // but access continues until subscription_end_date. If it was unset (resume), mark as active.
    if ((subscription as any).cancel_at_period_end) {
      user.subscription_status = 'canceled';
    } else if (subscription.status === 'active') {
      user.subscription_status = 'active';
    } else {
      user.subscription_status = 'expired';
    }

    await this.userRepository.save(user);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const user = await this.userRepository.findOne({ 
      where: { stripe_subscription_id: subscription.id } 
    });
    if (!user) return;

    // Subscription has fully ended (either at period end after cancel_at_period_end, or due to payment failure)
    user.subscription_status = 'expired';
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

    // Update subscription_end_date from the invoice period end
    const periodEnd = (invoice as any).lines?.data?.[0]?.period?.end
      ?? (invoice as any).period_end;
    if (periodEnd) {
      user.subscription_end_date = new Date(periodEnd * 1000);
    }

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
    trialEndDate: Date;
    trialDaysRemaining?: number;
    subscriptionEndDate?: Date;
    hasAccess: boolean;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    let hasAccess = false;
    let trialDaysRemaining: number | undefined;

    // Calculate trial days remaining
    if (user.trial_end_date) {
      const diffMs = user.trial_end_date.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Grant access if either trial_end_date or subscription_end_date is in the future
    const trialValid = !!user.trial_end_date && now < user.trial_end_date;
    const subscriptionValid = user.subscription_status === 'active' || 
      (!!user.subscription_end_date && now < user.subscription_end_date);

    hasAccess = trialValid || subscriptionValid;

    return {
      status: user.subscription_status || 'trial',
      trialEndDate: user.trial_end_date,
      trialDaysRemaining,
      subscriptionEndDate: user.subscription_end_date,
      hasAccess,
    };
  }

  /**
   * Cancel a subscription (scheduled at period end, not immediately)
   */
  async cancelSubscription(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.stripe_subscription_id) {
      throw new Error('No active subscription found. If you just subscribed, the webhook may not have been processed yet.');
    }

    try {
      await this.stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch (stripeError: any) {
      console.error('Stripe cancelSubscription error:', stripeError?.message, stripeError?.raw);
      throw new Error(stripeError?.message || 'Failed to cancel subscription in Stripe');
    }

    user.subscription_status = 'canceled';
    await this.userRepository.save(user);
  }

  /**
   * Resume a subscription that was scheduled to cancel at period end
   */
  async resumeSubscription(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.stripe_subscription_id) {
      throw new Error('No subscription found for this user.');
    }

    try {
      await this.stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
    } catch (stripeError: any) {
      console.error('Stripe resumeSubscription error:', stripeError?.message, stripeError?.raw);
      throw new Error(stripeError?.message || 'Failed to resume subscription in Stripe');
    }

    user.subscription_status = 'active';
    await this.userRepository.save(user);
  }

  /**
   * Create a Stripe Billing Portal session so the user can manage payment details
   */
  async createBillingPortalSession(userId: string, returnUrl: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.stripe_customer_id) {
      throw new Error('No Stripe customer found for this user.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });

    return session.url;
  }
}
