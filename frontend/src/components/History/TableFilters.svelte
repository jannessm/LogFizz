<script lang="ts">
  import { dayjs, type Timer, type TimeLogType } from '../../types';
  import type { TargetWithSpecs } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import DateTimeInput from '../forms/DateTimeInput.svelte';

  export interface FilterState {
    dateFrom: dayjs.Dayjs | null;
    dateTo: dayjs.Dayjs | null;
    timerIds: string[];
    targetIds: string[];
    types: TimeLogType[];
    searchText: string;
  }

  let {
    filters = $bindable<FilterState>({
      dateFrom: null,
      dateTo: null,
      timerIds: [],
      targetIds: [],
      types: [],
      searchText: '',
    }),
    timers = [],
    targets = [],
    onReset = undefined,
  }: {
    filters: FilterState;
    timers: Timer[];
    targets: TargetWithSpecs[];
    onReset?: () => void;
  } = $props();

  const typeOptions: { value: TimeLogType; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'sick', label: 'Sick' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'business-trip', label: 'Business Trip' },
    { value: 'child-sick', label: 'Child Sick' },
  ];

  let showAdvanced = $state(false);

  // Local state for date inputs (since DateTimeInput needs dayjs objects)
  let dateFrom = $state(filters.dateFrom || dayjs().startOf('month'));
  let dateTo = $state(filters.dateTo || dayjs().endOf('month'));
  let useDateFilter = $state(filters.dateFrom !== null);

  // Sync local date state to filters
  $effect(() => {
    if (useDateFilter) {
      filters.dateFrom = dateFrom;
      filters.dateTo = dateTo;
    } else {
      filters.dateFrom = null;
      filters.dateTo = null;
    }
  });

  function toggleType(type: TimeLogType) {
    if (filters.types.includes(type)) {
      filters.types = filters.types.filter(t => t !== type);
    } else {
      filters.types = [...filters.types, type];
    }
  }

  function toggleTimer(timerId: string) {
    if (filters.timerIds.includes(timerId)) {
      filters.timerIds = filters.timerIds.filter(id => id !== timerId);
    } else {
      filters.timerIds = [...filters.timerIds, timerId];
    }
  }

  function toggleTarget(targetId: string) {
    if (filters.targetIds.includes(targetId)) {
      filters.targetIds = filters.targetIds.filter(id => id !== targetId);
    } else {
      filters.targetIds = [...filters.targetIds, targetId];
    }
  }

  function resetFilters() {
    filters = {
      dateFrom: null,
      dateTo: null,
      timerIds: [],
      targetIds: [],
      types: [],
      searchText: '',
    };
    useDateFilter = false;
    dateFrom = dayjs().startOf('month');
    dateTo = dayjs().endOf('month');
    onReset?.();
  }

  let hasActiveFilters = $derived(
    filters.dateFrom !== null ||
    filters.timerIds.length > 0 ||
    filters.targetIds.length > 0 ||
    filters.types.length > 0 ||
    filters.searchText.trim() !== ''
  );
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
  <!-- Search and Date Range (always visible) -->
  <div class="flex flex-col sm:flex-row gap-4">
    <!-- Search -->
    <div class="flex-1">
      <label for="search" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Search
      </label>
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 icon-[si--search-line] w-4 h-4 text-gray-400"></span>
        <input
          id="search"
          type="text"
          bind:value={filters.searchText}
          placeholder="Search notes, timers, targets..."
          class="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </div>

    <!-- Date Range Toggle -->
    <div class="flex items-end gap-2">
      <label class="flex items-center gap-2 pb-2">
        <input
          type="checkbox"
          bind:checked={useDateFilter}
          class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
        />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Date Filter</span>
      </label>
    </div>
  </div>

  <!-- Date Range (shown when enabled) -->
  {#if useDateFilter}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <DateTimeInput
        bind:value={dateFrom}
        timezone={userTimezone}
        dateOnly
        dateLabel="From Date"
        dateId="dateFrom"
      />
      <DateTimeInput
        bind:value={dateTo}
        timezone={userTimezone}
        dateOnly
        dateLabel="To Date"
        dateId="dateTo"
      />
    </div>
  {/if}

  <!-- Advanced Filters Toggle -->
  <button
    type="button"
    onclick={() => showAdvanced = !showAdvanced}
    class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
  >
    <span class="{showAdvanced ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
    {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
  </button>

  <!-- Advanced Filters -->
  {#if showAdvanced}
    <div class="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
      <!-- Type Filter -->
      <div>
        <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type
        </span>
        <div class="flex flex-wrap gap-2">
          {#each typeOptions as { value, label }}
            <button
              type="button"
              onclick={() => toggleType(value)}
              class="px-3 py-1 text-sm rounded-full border transition-colors"
              class:bg-primary={filters.types.includes(value)}
              class:text-white={filters.types.includes(value)}
              class:border-primary={filters.types.includes(value)}
              class:bg-white={!filters.types.includes(value)}
              class:dark:bg-gray-700={!filters.types.includes(value)}
              class:text-gray-700={!filters.types.includes(value)}
              class:dark:text-gray-300={!filters.types.includes(value)}
              class:border-gray-300={!filters.types.includes(value)}
              class:dark:border-gray-600={!filters.types.includes(value)}
              class:hover:border-primary={!filters.types.includes(value)}
            >
              {label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Timer Filter -->
      {#if timers.length > 0}
        <div>
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Timers
          </span>
          <div class="flex flex-wrap gap-2">
            {#each timers as timer}
              <button
                type="button"
                onclick={() => toggleTimer(timer.id)}
                class="px-3 py-1 text-sm rounded-full border transition-colors"
                class:bg-primary={filters.timerIds.includes(timer.id)}
                class:text-white={filters.timerIds.includes(timer.id)}
                class:border-primary={filters.timerIds.includes(timer.id)}
                class:bg-white={!filters.timerIds.includes(timer.id)}
                class:dark:bg-gray-700={!filters.timerIds.includes(timer.id)}
                class:text-gray-700={!filters.timerIds.includes(timer.id)}
                class:dark:text-gray-300={!filters.timerIds.includes(timer.id)}
                class:border-gray-300={!filters.timerIds.includes(timer.id)}
                class:dark:border-gray-600={!filters.timerIds.includes(timer.id)}
                class:hover:border-primary={!filters.timerIds.includes(timer.id)}
              >
                {timer.emoji || ''} {timer.name}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Target Filter -->
      {#if targets.length > 0}
        <div>
          <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Targets
          </span>
          <div class="flex flex-wrap gap-2">
            {#each targets as target}
              <button
                type="button"
                onclick={() => toggleTarget(target.id)}
                class="px-3 py-1 text-sm rounded-full border transition-colors"
                class:bg-primary={filters.targetIds.includes(target.id)}
                class:text-white={filters.targetIds.includes(target.id)}
                class:border-primary={filters.targetIds.includes(target.id)}
                class:bg-white={!filters.targetIds.includes(target.id)}
                class:dark:bg-gray-700={!filters.targetIds.includes(target.id)}
                class:text-gray-700={!filters.targetIds.includes(target.id)}
                class:dark:text-gray-300={!filters.targetIds.includes(target.id)}
                class:border-gray-300={!filters.targetIds.includes(target.id)}
                class:dark:border-gray-600={!filters.targetIds.includes(target.id)}
                class:hover:border-primary={!filters.targetIds.includes(target.id)}
              >
                {target.name}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Reset Button -->
  {#if hasActiveFilters}
    <div class="flex justify-end pt-2">
      <button
        type="button"
        onclick={resetFilters}
        class="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
      >
        <span class="icon-[si--close-line] w-4 h-4"></span>
        Reset Filters
      </button>
    </div>
  {/if}
</div>
