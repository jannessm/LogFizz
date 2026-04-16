<script lang="ts">
  import BottomNav from '../components/BottomNav.svelte';
  import { navigate } from '../lib/navigation';

  function goBack() {
    navigate('/settings');
  }
</script>

<div class="h-screen flex flex-col">
  <div class="w-full px-4 py-6 flex-1 overflow-auto">
    <div class="w-full max-w-lg mx-auto">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Impressum</h1>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p><strong>Angaben gemäß § 5 TMG:</strong></p>
        <p>Max Mustermann<br/>Musterstraße 1<br/>12345 Musterstadt</p>

        <p><strong>Kontakt:</strong></p>
        <p>E-Mail: <a href="mailto:info@example.com" class="text-blue-600 dark:text-orange-400 hover:underline">info@example.com</a></p>

        <p>Diese Impressumsangaben sind Platzhalter. Bitte ersetzen Sie diese mit Ihren tatsächlichen Unternehmens- oder persönlichen Daten.</p>

        <div class="mt-4">
          <button on:click={goBack} class="text-sm text-gray-600 dark:text-gray-400 hover:underline">Zurück zu Einstellungen</button>
        </div>
      </div>
    </div>
  </div>

  <BottomNav currentTab={null} />
</div>
