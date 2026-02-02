<script lang="ts">
  import type { TargetSpec, State } from "../../types";
  import { statesStore } from '../../stores/states';
  import { onlyUnique } from "../../../../lib/utils/helper";
  import { _ } from '../../lib/i18n';

  type PartialTargetSpec = {
    id: string;
    duration_minutes: number[]; // 7-entry array for Sun-Sat
    exclude_holidays: boolean;
    state_code?: string;
    user_id?: string;
    target_id?: string;
  };

  let {
    targetSpec,
    lastSpec = true,
    deleteSpec,
    saveSpec,
  }: {
    targetSpec: TargetSpec | null,
    lastSpec?: boolean,
    deleteSpec: () => void,
    saveSpec: (spec: PartialTargetSpec) => void
  } = $props();

  let editMode: boolean = $state(false);
  let tempSpec: PartialTargetSpec = $state({
    id: '',
    duration_minutes: [0, 0, 0, 0, 0, 0, 0], // 7-entry array for Sun-Sat
    exclude_holidays: false,
    state_code: undefined,
  });

  // Separate hours and minutes for each day
  let durationHours: number[] = $state([0, 0, 0, 0, 0, 0, 0]);
  let durationMins: number[] = $state([0, 0, 0, 0, 0, 0, 0]);

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  let availableStates: State[] = $derived($statesStore.states || []);
  let availableCountries: string[] = $derived(
    Array.from(new Set(availableStates.map(s => s.country))).sort()
  );
  let selectedCountry: string = $derived(
    tempSpec.state_code 
      ? (availableStates.find(s => s.code === tempSpec.state_code)?.country || '') 
      : availableStates.map(s => s.country).filter(onlyUnique).length === 1
        ? availableStates[0].country
        : ''
  );
  let filteredStates: State[] = $derived(
    selectedCountry 
      ? availableStates.filter(s => s.country === selectedCountry).sort((a, b) => a.state.localeCompare(b.state))
      : []
  );
  let specCountry = $derived(tempSpec.state_code 
    ? (availableStates.find(s => s.code === tempSpec.state_code)?.country || '') 
    : ''
  );
  let specState = $derived(tempSpec.state_code 
    ? (availableStates.find(s => s.code === tempSpec.state_code)?.state || '') 
    : ''
  );

  $effect(() => {
    // Only run on mount or when targetSpec prop changes
    if (targetSpec === null && !tempSpec.id) {
      editMode = true;
      resetTempSpec();
    } else if (targetSpec && targetSpec.id !== tempSpec.id) {
      // Only reset if we're looking at a different spec
      editMode = false;
      resetTempSpec();
    }
  });

  $effect(() => {
    // Separate effect for country selection to avoid circular updates
    if (tempSpec.state_code && availableStates.length > 0 && !selectedCountry) {
      const state = availableStates.find(s => s.code === tempSpec.state_code);
      if (state) {
        selectedCountry = state.country;
      }
    }
  });

  function toggleEditMode() {
    editMode = !editMode;
  }

  function resetTempSpec() {
    if (targetSpec !== null) {
      tempSpec = {
        ...targetSpec,
        duration_minutes: [...targetSpec.duration_minutes], // Copy array
      };
    } else {
      tempSpec = {
        id: crypto.randomUUID(),
        duration_minutes: [0, 480, 480, 480, 480, 480, 0], // Sun-Sat
        exclude_holidays: false,
        state_code: undefined,
      };
    }
    
    // Convert duration_minutes to hours and minutes
    syncHoursMinutesFromDuration();
  }

  function syncHoursMinutesFromDuration() {
    durationHours = tempSpec.duration_minutes.map(mins => Math.floor(mins / 60));
    durationMins = tempSpec.duration_minutes.map(mins => mins % 60);
  }

  function syncDurationFromHoursMinutes() {
    durationHours = durationHours.map(h => Math.max(0, Math.min(23, Number(h) || 0)));
    durationMins = durationMins.map(m => Math.max(0, Math.min(59, Number(m) || 0)));
    tempSpec.duration_minutes = durationHours.map((hours, index) => 
      hours * 60 + durationMins[index]
    );
  }

  function handleSave() {
    // Ensure duration is synced before saving
    syncDurationFromHoursMinutes();
    saveSpec(tempSpec);
    if (!targetSpec) {
      // Reset for creating another spec
      resetTempSpec();
    } else {
      editMode = false;
    }
  }

  function handleCountryChange() {
    tempSpec.state_code = undefined;
  }
</script>

<div class="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
  {#if !editMode}
    <!-- View Mode -->
    <div class="flex justify-between items-start gap-3">
      <div class="flex-1">
        <!-- Duration Grid -->
        <div class="flex flex-row flex-wrap gap-1 justify-evenly">
          {#each tempSpec.duration_minutes as duration, index}
            <div class="flex flex-1 flex-col border rounded p-2 border-gray-200 items-center"
              class:bg-blue-200={duration > 0}
            >
              <div class="text-sm text-gray-700">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</div>
              <div class="text-xs text-gray-500">{weekdayNames[index]}</div>
            </div>
          {/each}
        </div>
        
        <!-- Info -->
        <div class="text-xs text-gray-600 space-y-1">
          {#if tempSpec.exclude_holidays}
            <div class="flex items-center gap-1 text-grey-400">
              <span class="icon-[si--sun-set-duotone] w-3 h-3"></span>
              Excludes holidays {#if tempSpec.state_code && specState && specCountry} ({specState}, {specCountry}){/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col gap-1">
        <button
          type="button"
          onclick={toggleEditMode}
          class="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={$_('target.editSchedule')}
        >
          <span class="icon-[si--edit-detailed-duotone] w-4 h-4"></span>
        </button>
        {#if !lastSpec}
          <button
            type="button"
            onclick={() => deleteSpec()}
            class="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title={$_('target.deleteSchedule')}
          >
            <span class="icon-[si--bin-duotone] w-4 h-4"></span>
          </button>
        {:else}
          <button
            type="button"
            disabled
            class="p-1.5 text-gray-400 cursor-not-allowed rounded opacity-50"
            title={$_('target.cannotDeleteOnlySchedule')}
          >
            <span class="icon-[si--bin-duotone] w-4 h-4"></span>
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Edit Mode -->
    <div class="space-y-3">
      <!-- Duration Grid -->
      <div class="flex flex-row justify-center flex-wrap gap-1">
        {#each tempSpec.duration_minutes as duration, index}
          <div class="flex flex-col items-center gap-1 p-2 border border-gray-300 rounded"
            class:bg-blue-100={duration > 0}
          >
            <!-- Hours input -->
            <div class="flex items-center gap-0.5">
              <input
                type="number"
                min="0"
                max="23"
                placeholder="h"
                class="w-15 text-center border border-gray-300 rounded px-0.5 py-1 text-xs"
                bind:value={durationHours[index]}
                onblur={() => syncDurationFromHoursMinutes()}
              />
              <span class="text-xs text-gray-500">:</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="m"
                class="w-15 text-center border border-gray-300 rounded px-0.5 py-1 text-xs"
                bind:value={durationMins[index]}
                onblur={() => syncDurationFromHoursMinutes()}
              />
            </div>
            <div class="text-xs text-gray-500">{weekdayNames[index]}</div>
          </div>
        {/each}
      </div>

      <!-- Holiday Exclusion -->
      <div>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            bind:checked={tempSpec.exclude_holidays}
            class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>{$_('target.excludePublicHolidays')}</span>
        </label>
      </div>

      {#if tempSpec.exclude_holidays}
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="country">{$_('target.country')}</label>
            <select
              bind:value={selectedCountry}
              onchange={handleCountryChange}
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{$_('target.selectCountry')}</option>
              {#each availableCountries as country}
                <option value={country}>{country}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1" for="state">{$_('target.state')}</label>
            <select
              bind:value={tempSpec.state_code}
              disabled={!selectedCountry}
              class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">{$_('target.selectState')}</option>
              {#each filteredStates as state}
                <option value={state.code}>{state.state}</option>
              {/each}
            </select>
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex gap-2">
        {#if targetSpec !== null}
          <button
            type="button"
            onclick={() => {editMode = false; resetTempSpec();}}
            class="flex-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            {$_('common.cancel')}
          </button>
        {/if}
        <button
          type="button"
          onclick={handleSave}
          class="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {$_('common.save')}
        </button>
      </div>
    </div>
  {/if}
</div>
