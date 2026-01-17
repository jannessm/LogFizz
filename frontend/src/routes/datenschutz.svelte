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
      <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Datenschutzbestimmung</h1>

      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <p><strong>Einleitung</strong></p>
        <p>Diese Datenschutzbestimmung erklärt, wie wir personenbezogene Daten verarbeiten und schützen. Dies ist ein Platzhaltertext. Bitte passen Sie die Inhalte an Ihre tatsächliche Datenverarbeitung an.</p>

        <p><strong>Kontakt</strong></p>
        <p>Bei Fragen zum Datenschutz kontaktieren Sie uns unter: <a href="mailto:privacy@example.com" class="text-blue-600 dark:text-orange-400 hover:underline">privacy@example.com</a></p>

        <p><strong>Rechte der betroffenen Personen</strong></p>
        <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten.</p>

        <div class="mt-4">
          <button on:click={goBack} class="text-sm text-gray-600 hover:underline">Zurück zu Einstellungen</button>
        </div>
      </div>
    </div>
  </div>

  <BottomNav currentTab="settings" />
</div>
