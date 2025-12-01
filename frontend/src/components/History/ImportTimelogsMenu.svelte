<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  let isOpen = false;

  function toggleMenu() {
    isOpen = !isOpen;
  }

  function closeMenu() {
    isOpen = false;
  }

  function handleImportCSV() {
    closeMenu();
    dispatch('import', { type: 'csv' });
  }

  function handleImportPDF() {
    closeMenu();
    dispatch('import', { type: 'pdf' });
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.import-menu-container')) {
      closeMenu();
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="import-menu-container relative">
  <button
    on:click|stopPropagation={toggleMenu}
    class="p-2 hover:bg-gray-200 rounded-lg transition-colors icon-[si--more-vert-duotone]"
    style="width: 28px; height: 28px;"
    aria-label="Import options"
    aria-haspopup="true"
    aria-expanded={isOpen}
  ></button>

  {#if isOpen}
    <div 
      class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      role="menu"
    >
      <button
        on:click={handleImportCSV}
        class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
        role="menuitem"
      >
        <span class="icon-[si--file-upload-duotone]" style="width: 20px; height: 20px;"></span>
        Import from CSV
      </button>
      <button
        on:click={handleImportPDF}
        class="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
        role="menuitem"
      >
        <span class="icon-[si--file-upload-duotone]" style="width: 20px; height: 20px;"></span>
        Import from PDF
      </button>
    </div>
  {/if}
</div>
