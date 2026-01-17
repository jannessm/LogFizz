<script lang="ts">
  let { type = 'error', message = '' }: {
    type?: 'error' | 'success';
    message?: string;
  } = $props();
</script>

{#if message}
  <div class="mb-4 p-3 border rounded {type === 'error' ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'}">
    {message}
  </div>
{/if}
