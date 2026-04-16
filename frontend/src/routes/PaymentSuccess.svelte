<script lang="ts">
  import { navigate } from '../lib/navigation';
  import { _ } from '../lib/i18n';
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
  <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
    <div class="mb-6">
      <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/50">
        <svg class="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </div>

    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{$_('subscription.paymentSuccessful')}</h1>
    <p class="text-gray-600 dark:text-gray-400 mb-6">
      {$_('subscription.thankYouSubscribing')}
    </p>

    <div class="space-y-3">
      <button
        on:click={() => navigate('/')}
        class="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition"
      >
        {$_('common.goToDashboard')}
      </button>
      
      <button
        on:click={() => navigate('/payment')}
        class="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 px-6 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
      >
        {$_('common.viewSubscriptionDetails')}
      </button>
    </div>
  </div>
</div>
