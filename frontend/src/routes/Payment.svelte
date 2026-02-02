<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from '../lib/navigation';
  import { authStore } from '../stores/auth';
  import { paymentApi, type SubscriptionStatus } from '../services/payment';
  import { loadStripe } from '@stripe/stripe-js';
  import { _ } from '../lib/i18n';

  let subscriptionStatus: SubscriptionStatus | null = null;
  let loading = true;
  let error = '';
  let processingCheckout = false;
  let paywallEnabled = false;

  $: user = $authStore.user;

  onMount(async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      // Check paywall status
      const paywallStatus = await paymentApi.getPaywallStatus();
      paywallEnabled = paywallStatus.enabled;

      // Get subscription status
      subscriptionStatus = await paymentApi.getSubscriptionStatus();
      loading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load subscription status';
      loading = false;
    }
  });

  async function handleSubscribe() {
    processingCheckout = true;
    error = '';

    try {
      const baseUrl = window.location.origin;
      const result = await paymentApi.createCheckoutSession(
        `${baseUrl}/payment/success`,
        `${baseUrl}/payment`
      );

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      error = err.message || 'Failed to create checkout session';
      processingCheckout = false;
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }

    try {
      await paymentApi.cancelSubscription();
      // Reload status
      subscriptionStatus = await paymentApi.getSubscriptionStatus();
    } catch (err: any) {
      error = err.message || 'Failed to cancel subscription';
    }
  }

  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  }

  function getDaysRemaining(dateStr: string | undefined): number {
    if (!dateStr) return 0;
    const endDate = new Date(dateStr);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
</script>

<div class="min-h-screen bg-gray-50 py-12 px-4">
  <div class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">{$_('subscription.subscription')}</h1>

    {#if !paywallEnabled}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800">{$_('subscription.paywallDisabled')}</h3>
            <p class="mt-2 text-sm text-blue-700">
              {$_('subscription.paywallNotActive')}
            </p>
          </div>
        </div>
      </div>
    {/if}

    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p class="text-red-800">{error}</p>
      </div>
    {/if}

    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    {:else if subscriptionStatus}
      <div class="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">{$_('subscription.currentStatus')}</h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between py-3 border-b">
            <span class="text-gray-600">{$_('subscription.status')}</span>
            <span class="font-medium">
              {#if subscriptionStatus.status === 'trial'}
                <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{$_('subscription.freeTrial')}</span>
              {:else if subscriptionStatus.status === 'active'}
                <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">{$_('subscription.active')}</span>
              {:else if subscriptionStatus.status === 'expired'}
                <span class="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">{$_('subscription.expired')}</span>
              {:else if subscriptionStatus.status === 'canceled'}
                <span class="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">{$_('subscription.canceled')}</span>
              {/if}
            </span>
          </div>

          {#if subscriptionStatus.status === 'trial' && subscriptionStatus.trialEndDate}
            <div class="flex items-center justify-between py-3 border-b">
              <span class="text-gray-600">{$_('subscription.trialEnds')}</span>
              <span class="font-medium">{formatDate(subscriptionStatus.trialEndDate)}</span>
            </div>
            <div class="flex items-center justify-between py-3 border-b">
              <span class="text-gray-600">{$_('subscription.daysRemaining')}</span>
              <span class="font-medium text-blue-600">{getDaysRemaining(subscriptionStatus.trialEndDate)} days</span>
            </div>
          {/if}

          {#if subscriptionStatus.status === 'active' && subscriptionStatus.subscriptionEndDate}
            <div class="flex items-center justify-between py-3 border-b">
              <span class="text-gray-600">{$_('subscription.nextBillingDate')}</span>
              <span class="font-medium">{formatDate(subscriptionStatus.subscriptionEndDate)}</span>
            </div>
          {/if}

          <div class="flex items-center justify-between py-3">
            <span class="text-gray-600">{$_('subscription.access')}</span>
            <span class="font-medium">
              {#if subscriptionStatus.hasAccess}
                <span class="text-green-600">{$_('subscription.fullAccess')}</span>
              {:else}
                <span class="text-red-600">{$_('subscription.limitedAccess')}</span>
              {/if}
            </span>
          </div>
        </div>
      </div>

      {#if subscriptionStatus.status === 'trial' || subscriptionStatus.status === 'expired' || subscriptionStatus.status === 'canceled'}
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">{$_('subscription.subscribeToTapShift')}</h2>
          
          <div class="border-2 border-blue-200 rounded-lg p-6 mb-6">
            <div class="flex items-baseline mb-4">
              <span class="text-5xl font-bold text-gray-900">€5</span>
              <span class="text-xl text-gray-500 ml-2">{$_('subscription.perYear')}</span>
            </div>
            
            <ul class="space-y-3 mb-6">
              <li class="flex items-start">
                <svg class="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-gray-700">{$_('subscription.unlimitedTimeTracking')}</span>
              </li>
              <li class="flex items-start">
                <svg class="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-gray-700">{$_('subscription.advancedStats')}</span>
              </li>
              <li class="flex items-start">
                <svg class="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-gray-700">{$_('subscription.prioritySupport')}</span>
              </li>
              <li class="flex items-start">
                <svg class="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-gray-700">{$_('subscription.cancelAnytime')}</span>
              </li>
            </ul>

            <button
              on:click={handleSubscribe}
              disabled={processingCheckout}
              class="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingCheckout ? 'Processing...' : 'Subscribe Now'}
            </button>
          </div>

          <p class="text-sm text-gray-500 text-center">
            {$_('subscription.securePayment')}
          </p>
        </div>
      {/if}

      {#if subscriptionStatus.status === 'active'}
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold mb-4">{$_('subscription.manageSubscription')}</h2>
          
          <button
            on:click={handleCancelSubscription}
            class="w-full bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition"
          >
            {$_('subscription.cancelSubscription')}
          </button>
          
          <p class="text-sm text-gray-500 mt-4 text-center">
            {$_('subscription.accessUntilEnd')}
          </p>
        </div>
      {/if}
    {/if}

    <div class="mt-6 text-center">
      <button
        on:click={() => navigate('/settings')}
        class="text-blue-600 hover:text-blue-800 font-medium"
      >
        ← Back to Settings
      </button>
    </div>
  </div>
</div>
