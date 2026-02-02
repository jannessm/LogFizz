<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from '../lib/navigation';
  import { _ } from '../lib/i18n';

  onMount(() => {
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      navigate('/');
    }, 3000);
  });
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
  <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
    <div class="mb-6">
      <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
        <svg class="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>

    <h1 class="text-2xl font-bold text-gray-900 mb-2">{$_('subscription.paymentSuccessful')}</h1>
    <p class="text-gray-600 mb-6">
      {$_('subscription.thankYouSubscribing')}
    </p>

    <div class="space-y-3">
      <button
        on:click={() => navigate('/')}
        class="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition"
      >
        Go to Dashboard
      </button>
      
      <button
        on:click={() => navigate('/payment')}
        class="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-200 transition"
      >
        View Subscription Details
      </button>
    </div>

    <p class="text-sm text-gray-500 mt-6">
      {$_('subscription.redirectingDashboard')}
    </p>
  </div>
</div>
