import { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from '../services/payment.service.js';
import { SettingsService } from '../services/settings.service.js';

const paymentService = new PaymentService();
const settingsService = new SettingsService();

/**
 * Middleware to check if user has valid subscription access
 * Only enforces if paywall is enabled
 */
export async function requireSubscription(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check if paywall is enabled
  const paywallEnabled = settingsService.isPaywallEnabled();
  
  if (!paywallEnabled) {
    // Paywall is disabled, allow access
    return;
  }

  // Check if user is authenticated
  if (!request.session?.userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    const subscriptionStatus = await paymentService.getSubscriptionStatus(request.session.userId);
    
    if (!subscriptionStatus.hasAccess) {
      return reply.code(402).send({ 
        error: 'Payment required',
        message: 'Your trial has expired or subscription is not active. Please subscribe to continue.',
        status: subscriptionStatus.status,
        trialEndDate: subscriptionStatus.trialEndDate,
        subscriptionEndDate: subscriptionStatus.subscriptionEndDate,
      });
    }
  } catch (error: any) {
    console.error('Error checking subscription:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
}
