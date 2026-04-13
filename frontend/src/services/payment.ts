import ky from 'ky';

// In development, use proxy (relative path). In production, use env variable or default to same origin
const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_URL || window.location.origin)
  : '';

// Create a ky instance with default options
const api = ky.create({
  prefixUrl: API_BASE_URL,
  credentials: 'include', // Important for session cookies
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface SubscriptionStatus {
  status: string;
  trialEndDate?: string;
  trialDaysRemaining?: number;
  subscriptionEndDate?: string;
  hasAccess: boolean;
}

export const paymentApi = {
  /**
   * Create a Stripe checkout session
   */
  async createCheckoutSession(successUrl: string, cancelUrl: string): Promise<{ url: string }> {
    return api.post('api/payment/create-checkout-session', {
      json: { successUrl, cancelUrl }
    }).json();
  },

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return api.get('api/payment/subscription-status').json();
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<{ message: string }> {
    return api.post('api/payment/cancel-subscription').json();
  },

  /**
   * Get paywall status (public endpoint)
   */
  async getPaywallStatus(): Promise<{ enabled: boolean }> {
    return api.get('api/payment/paywall-status').json();
  },
};
