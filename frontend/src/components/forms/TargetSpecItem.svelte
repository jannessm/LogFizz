<script lang="ts">
  import type { TargetSpec } from "../../types";
  import { dayjs } from "../../types";

  type PartialTargetSpec = Partial<TargetSpec> & { 
    id: string;
    duration_minutes: number[];
    weekdays: number[];
    starting_from: string;
    ending_at?: string;
    exclude_holidays: boolean;
    state_code?: string;
   };

  let {
    targetSpec,
    lastSpec = true,
    deleteSpec,
    saveSpec,
  }: {
    targetSpec: TargetSpec | null,
    lastSpec?: boolean,
    deleteSpec: (spec: TargetSpec) => void,
    saveSpec: (spec: TargetSpec) => void
  } = $props();

  let editMode: boolean = $state(false);
  let tempSpec: PartialTargetSpec = $state({
    id: '',
    duration_minutes: [],
    weekdays: [],
    starting_from: dayjs().format('YYYY-MM-DD'),
    ending_at: undefined,
    exclude_holidays: false,
    state_code: undefined,
  });

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  $effect(() => {
    if (targetSpec === null) {
      editMode = true;
    }
    resetTempSpec();
  });

  function toggleEditMode() {
    editMode = !editMode;
  }

  function resetTempSpec() {
    if (targetSpec !== null) {
      const duration_minutes = [0, 0, 0, 0, 0, 0, 0];
      const weekdays = [0, 1, 2, 3, 4, 5, 6];
      targetSpec.weekdays.forEach((day, index) => {
        duration_minutes[day] = targetSpec.duration_minutes[index];
      });
      tempSpec = {
        ...targetSpec,
        duration_minutes: duration_minutes,
        weekdays: weekdays
      };
    } else {
      tempSpec = {
        id: crypto.randomUUID(),
        duration_minutes: [0, 480, 480, 480, 480, 480, 0],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        starting_from: dayjs().format('YYYY-MM-DD'),
        ending_at: undefined,
        exclude_holidays: false,
        state_code: undefined,
      };
    }
  }
</script>

<div class="flex flex-row justify-between border border-gray-200 rounded-lg p-2 hover:border-blue-300 transition-colors gap-1">
  <div class="flex flex-col flex-1 justify-between items-start gap-3">
    {#if !editMode}
      <div class="grid grid-cols-7 gap-1 w-full">
        {#each tempSpec.duration_minutes as duration, index}
          <div class="flex flex-col border rounded p-2 border-gray-200 items-center"
            class:bg-blue-200={duration > 0}
          >
            <div class="text-sm text-gray-700">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</div>
            <div class="text-xs text-gray-500">{weekdayNames[tempSpec.weekdays[index]]}</div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="grid grid-cols-4 gap-1 w-full">
        {#each tempSpec.duration_minutes as duration, index}
          <div class="flex flex-col border rounded p-2 border-gray-200 items-center"
            class:bg-blue-200={duration > 0}
          >
            <input
              type="number"
              min="0"
              max="1000"
              class="w-16 text-center border border-gray-300 rounded px-1 py-0.5"
              bind:value={tempSpec.duration_minutes[index]}
            />
            <div class="text-xs text-gray-500">{weekdayNames[tempSpec.weekdays[index]]}</div>
          </div>
        {/each}
        <div class="flex flex-col justify-end gap-1 col-span-4 mt-2">
          <button
            type="button"
            onclick={() => {toggleEditMode(); resetTempSpec();}}
            class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={() => {toggleEditMode(); saveSpec(tempSpec as TargetSpec);}}
            class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {!!targetSpec ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    {/if}
    <div class="flex-1">
      <div class="text-sm text-gray-700 mb-1">
      </div>
        {#if tempSpec.exclude_holidays || true}
        <div class="flex items-center gap-1 text-xs text-gray-500">
            <span class="icon-[si--sun-set-duotone] w-3 h-3"></span>
            Excludes public holidays
            {#if tempSpec.state_code}
            ({tempSpec.state_code})
            {/if}
        </div>
        {/if}
    </div>
  </div>

  {#if !editMode}
  <div class="flex gap-1 p-2 justify-start">
      <button
        type="button"
        onclick={toggleEditMode}
        class="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        title="Edit"
      >
      <span class="icon-[si--edit-detailed-duotone] w-4 h-4"></span>
      </button>
      {#if !lastSpec}
        <button
            type="button"
            onclick={() => deleteSpec(tempSpec as TargetSpec)}
            class="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete schedule"
        >
            <span class="icon-[si--bin-duotone] w-4 h-4"></span>
        </button>
      {:else}
        <button
            type="button"
            disabled
            class="p-1.5 text-gray-400 cursor-not-allowed rounded opacity-50"
            title="Cannot delete the only schedule - a target must have at least one"
        >
            <span class="icon-[si--bin-duotone] w-4 h-4"></span>
        </button>
      {/if}
  </div>
  {/if}
</div>
