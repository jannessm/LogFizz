import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PaymentService } from '../services/payment.service.js';
import { SettingsService } from '../services/settings.service.js';
import Stripe from 'stripe';

const paymentService = new PaymentService();
const settingsService = new SettingsService();

export async function paymentRoutes(fastify: FastifyInstance) {
  // Create checkout session
  fastify.post('/create-checkout-session', {
    schema: {
      tags: ['Payment'],
      body: Type.Object({
        successUrl: Type.String(),
        cancelUrl: Type.String(),
      }),
      response: {
        200: Type.Object({
          url: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    if (!request.session?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const { successUrl, cancelUrl } = request.body as any;
      const url = await paymentService.createCheckoutSession(
        request.session.userId,
        successUrl,
        cancelUrl
      );
      return { url };
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Get subscription status
  fastify.get('/subscription-status', {
    schema: {
      tags: ['Payment'],
      response: {
        200: Type.Object({
          status: Type.String(),
          trialEndDate: Type.Optional(Type.String()),
          subscriptionEndDate: Type.Optional(Type.String()),
          hasAccess: Type.Boolean(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    if (!request.session?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const status = await paymentService.getSubscriptionStatus(request.session.userId);
      return {
        status: status.status,
        trialEndDate: status.trialEndDate?.toISOString(),
        subscriptionEndDate: status.subscriptionEndDate?.toISOString(),
        hasAccess: status.hasAccess,
      };
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Cancel subscription
  fastify.post('/cancel-subscription', {
    schema: {
      tags: ['Payment'],
      response: {
        200: Type.Object({
          message: Type.String(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    if (!request.session?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      await paymentService.cancelSubscription(request.session.userId);
      return { message: 'Subscription canceled successfully' };
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // Stripe webhook handler
  fastify.post('/webhook', async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-12-15.clover' });
      
      // Get the raw body as string
      const payload = JSON.stringify(request.body);
      
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      await paymentService.handleWebhook(event);
      return { received: true };
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      return reply.code(400).send({ error: error.message });
    }
  });

  // Get paywall status (public endpoint)
  fastify.get('/paywall-status', {
    schema: {
      tags: ['Payment'],
      response: {
        200: Type.Object({
          enabled: Type.Boolean(),
        }),
      },
    },
  }, async (request, reply) => {
    const enabled = await settingsService.isPaywallEnabled();
    return { enabled };
  });

  // Admin: Toggle paywall (requires admin authentication)
  fastify.post('/admin/toggle-paywall', {
    schema: {
      tags: ['Payment'],
      body: Type.Object({
        enabled: Type.Boolean(),
      }),
      response: {
        200: Type.Object({
          message: Type.String(),
          enabled: Type.Boolean(),
        }),
        400: Type.Object({
          error: Type.String(),
        }),
        401: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    // TODO: Add admin authentication check
    // For now, we'll require any authenticated user
    if (!request.session?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const { enabled } = request.body as any;
      await settingsService.setPaywallEnabled(enabled);
      return { 
        message: `Paywall ${enabled ? 'enabled' : 'disabled'} successfully`,
        enabled 
      };
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });
}
