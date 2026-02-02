<script lang="ts">
  import { timers } from '../../stores/timers';
  import { TimerForm } from '../../components/forms';
  import { _ } from '../../lib/i18n';

  let {
    value = $bindable(''),
    placeholder = 'Select a timer...',
    onchange = undefined,
  }: {
    value?: string;
    placeholder?: string;
    onchange?: (value: string) => void;
  } = $props();

  let showTimerForm = $state(false);

  function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target.value === '__create_new__') {
      showTimerForm = true;
      target.value = value; // Reset to previous value
    } else {
      value = target.value;
      onchange?.(target.value);
    }
  }

  function handleTimerFormClose() {
    // After timer is created, auto-select the newest timer
    const sortedTimers = [...$timers].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    if (sortedTimers.length > 0) {
      const newTimer = sortedTimers[0];
      value = newTimer.id;
      onchange?.(newTimer.id);
    }
    
    showTimerForm = false;
  }
</script>

<select
  {value}
  onchange={handleChange}
  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
>
  <option value="">{placeholder}</option>
  {#each $timers.filter(t => !t.archived) as timer}
    <option value={timer.id}>
      {timer.emoji ? timer.emoji + ' ' : ''}{timer.name}
    </option>
  {/each}
  <option value="__create_new__" class="font-medium text-blue-600 dark:text-orange-400">
    {$_('import.createNewTimer')}
  </option>
</select>

{#if showTimerForm}
  <TimerForm close={handleTimerFormClose} />
{/if}
