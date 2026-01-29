<script lang="ts">
  import { dayjs, type TimeLog, type Timer, type TimeLogType, type Balance } from '../../types';
  import type { TargetWithSpecs } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import { TimelogForm } from '../forms';
  import { calculateDueMinutes } from '../../../../lib/utils/balance';
  import { deleteTimelog, saveTimelog } from '../../services/formHandlers';

  type SortColumn = 'timer' | 'target' | 'type' | 'start' | 'end' | 'total_duration' | 'effective_duration';
  type SortDirection = 'asc' | 'desc';

  let {
    timelogs = [],
    timers = [],
    targets = [],
    monthlyBalances = [],
    selectable = false,
    selectedIds = $bindable(new Set<string>()),
  }: {
    timelogs: TimeLog[];
    timers: Timer[];
    targets: TargetWithSpecs[];
    monthlyBalances?: Balance[];
    selectable?: boolean;
    selectedIds?: Set<string>;
  } = $props();

  // Editing state
  let editingTimelog = $state<TimeLog | null>(null);

  // Sort state
  let sortColumn = $state<SortColumn>('start');
  let sortDirection = $state<SortDirection>('asc');

  // Touch tracking for mobile scroll vs click
  let touchStartY = 0;
  let touchStartX = 0;
  let isTouchMove = false;

  const typeOptions: TimeLogType[] = ['normal', 'sick', 'holiday', 'business-trip', 'child-sick'];

  function getTimerName(timerId: string): string {
    const timer = timers.find(t => t.id === timerId);
    return timer ? `${timer.emoji || ''} ${timer.name}`.trim() : 'Unknown';
  }

  function getTargetName(timerId: string): string {
    const timer = timers.find(t => t.id === timerId);
    if (!timer?.target_id) return '-';
    const target = targets.find(t => t.id === timer.target_id);
    return target?.name || '-';
  }

  function getTargetId(timerId: string): string | undefined {
    const timer = timers.find(t => t.id === timerId);
    return timer?.target_id;
  }

  function formatDateTime(timestamp: string | undefined, tz: string): string {
    if (!timestamp) return '-';
    return dayjs.utc(timestamp).tz(tz).format('L LT');
  }

  function formatDateTimeConditional(timestamp: string | undefined, tz: string, groupDate: string): string {
    if (!timestamp) return '-';
    const dt = dayjs.utc(timestamp).tz(tz);
    const dateStr = dt.format('YYYY-MM-DD');
    
    // If the date matches the group date, only show time
    if (dateStr === groupDate) {
      return dt.format('LT');
    }
    // Otherwise show full date and time
    return dt.format('L LT');
  }

  function formatDuration(minutes: number | undefined): string {
    if (minutes === undefined) return 'Running';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function formatBalance(minutes: number): string {
    const isNegative = minutes < 0;
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const sign = isNegative ? '-' : '+';
    return `${sign}${hours}h ${mins}m`;
  }

  function getTypeLabel(type: TimeLogType): string {
    const labels: Record<TimeLogType, string> = {
      'normal': 'Normal',
      'sick': 'Sick',
      'holiday': 'Holiday',
      'business-trip': 'Business Trip',
      'child-sick': 'Child Sick',
    };
    return labels[type] || type;
  }

  function getTypeBadgeClass(type: TimeLogType): string {
    const classes: Record<TimeLogType, string> = {
      'normal': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'sick': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'holiday': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'business-trip': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'child-sick': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return classes[type] || '';
  }

  function getTotalDuration(timelog: TimeLog): number | undefined {
    if (timelog.whole_day) {
      // For whole_day entries, return due minutes from target
      const targetId = getTargetId(timelog.timer_id);
      if (targetId) {
        const target = targets.find(t => t.id === targetId);
        if (target) {
          const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
          return calculateDueMinutes(date, target as any, new Set());
        }
      }
      return undefined;
    }
    
    if (!timelog.end_timestamp) return undefined;
    const start = dayjs(timelog.start_timestamp);
    const end = dayjs(timelog.end_timestamp);
    return end.diff(start, 'minute');
  }

  function getEffectiveDuration(timelog: TimeLog): number | undefined {
    if (timelog.whole_day) {
      // For whole_day entries, return due minutes from target
      const targetId = getTargetId(timelog.timer_id);
      if (targetId) {
        const target = targets.find(t => t.id === targetId);
        if (target) {
          const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
          return calculateDueMinutes(date, target as any, new Set());
        }
      }
      return undefined;
    }
    
    return timelog.duration_minutes;
  }

  function toggleSelectAll() {
    if (selectedIds.size === timelogs.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(timelogs.map(t => t.id));
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedIds = newSet;
  }

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      // Toggle direction or reset
      if (sortDirection === 'desc') {
        sortDirection = 'asc';
      } else if (sortDirection === 'asc') {
        // Reset to default (no sorting applied, or sort by start desc)
        sortDirection = 'desc';
        sortColumn = 'start';
      }
    } else {
      sortColumn = column;
      sortDirection = 'desc';
    }
  }

  function handleRowClick(timelog: TimeLog) {
    if (!isTouchMove) {
      editingTimelog = timelog;
    }
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    isTouchMove = false;
  }

  function handleTouchMove(e: TouchEvent) {
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
    if (deltaY > 10 || deltaX > 10) {
      isTouchMove = true;
    }
  }

  function handleCloseEditForm() {
    editingTimelog = null;
  }

  async function handleSaveTimelog(newLog: TimeLog) {
    if (editingTimelog) {
      saveTimelog(newLog, editingTimelog);
      editingTimelog = null;
    }
  }

  async function handleDeleteTimelog(timelog: TimeLog) {
    deleteTimelog(timelog);
    editingTimelog = null;
  }

  // Sorted timelogs
  let sortedTimelogs = $derived.by(() => {
    let sorted = [...timelogs];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'timer':
          comparison = getTimerName(a.timer_id).localeCompare(getTimerName(b.timer_id));
          break;
        case 'target':
          comparison = getTargetName(a.timer_id).localeCompare(getTargetName(b.timer_id));
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'start':
          comparison = new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime();
          break;
        case 'end':
          const aEnd = a.end_timestamp || '';
          const bEnd = b.end_timestamp || '';
          comparison = aEnd.localeCompare(bEnd);
          break;
        case 'total_duration':
          const aDur = getTotalDuration(a) ?? -1;
          const bDur = getTotalDuration(b) ?? -1;
          comparison = aDur - bDur;
          break;
        case 'effective_duration':
          const aEff = getEffectiveDuration(a) ?? -1;
          const bEff = getEffectiveDuration(b) ?? -1;
          comparison = aEff - bEff;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  });

  // Group timelogs with accumulated balances
  // Group by different criteria based on sort column
  interface GroupData {
    groupKey: string;        // Unique key for the group
    groupLabel: string;      // Display label for the group header
    timelogs: TimeLog[];
    balances: Map<string, number>; // targetId -> accumulated balance (only for date-based grouping)
    showBalances: boolean;   // Whether to show balances for this group
  }

  let groupedTimelogs = $derived.by(() => {
    const groups: GroupData[] = [];
    const groupMap = new Map<string, GroupData>();

    // Determine what to group by
    let shouldGroupByDate = sortColumn === 'start' || sortColumn === 'end';
    let shouldGroupByValue = ['timer', 'target', 'type'].includes(sortColumn);
    
    // For duration columns, don't group
    if (!shouldGroupByDate && !shouldGroupByValue) {
      return [{
        groupKey: 'flat',
        groupLabel: '',
        timelogs: sortedTimelogs,
        balances: new Map<string, number>(),
        showBalances: false,
      }];
    }

    // Group timelogs
    for (const timelog of sortedTimelogs) {
      let groupKey = '';
      let groupLabel = '';
      
      if (shouldGroupByDate) {
        // For 'end' column, group by end date; for 'start', group by start date
        const timestamp = sortColumn === 'end' && timelog.end_timestamp 
          ? timelog.end_timestamp 
          : timelog.start_timestamp;
        const date = dayjs.utc(timestamp).tz(timelog.timezone || userTimezone);
        groupKey = date.format('YYYY-MM-DD');
        groupLabel = date.format('dddd, MMMM D, YYYY');
      } else if (sortColumn === 'timer') {
        groupKey = timelog.timer_id;
        groupLabel = getTimerName(timelog.timer_id);
      } else if (sortColumn === 'target') {
        const targetId = getTargetId(timelog.timer_id);
        groupKey = targetId || 'no-target';
        groupLabel = targetId ? getTargetName(timelog.timer_id) : 'No Target';
      } else if (sortColumn === 'type') {
        groupKey = timelog.type;
        groupLabel = getTypeLabel(timelog.type);
      }
      
      if (!groupMap.has(groupKey)) {
        const group: GroupData = {
          groupKey,
          groupLabel,
          timelogs: [],
          balances: new Map(),
          showBalances: shouldGroupByDate,
        };
        groups.push(group);
        groupMap.set(groupKey, group);
      }
      
      groupMap.get(groupKey)!.timelogs.push(timelog);
    }

    // Sort timelogs within each group by start date when grouping by value
    if (shouldGroupByValue) {
      for (const group of groups) {
        group.timelogs.sort((a, b) => {
          const timeA = new Date(a.start_timestamp).getTime();
          const timeB = new Date(b.start_timestamp).getTime();
          // Sort by start time ascending (oldest first) to match default behavior
          return timeA - timeB;
        });
      }
    }

    // Calculate balances only for date-based grouping
    if (shouldGroupByDate) {
      // Sort groups chronologically for balance calculation
      const chronologicalGroups = [...groups].sort((a, b) => 
        a.groupKey.localeCompare(b.groupKey)
      );

      // Track running balances per target across all days
      const runningBalances = new Map<string, number>();

      // Initialize balances from monthly balances
      if (chronologicalGroups.length > 0 && monthlyBalances.length > 0) {
        const firstMonth = chronologicalGroups[0].groupKey.substring(0, 7); // YYYY-MM
        
        // Group balances by target
        const targetBalances = new Map<string, Balance[]>();
        for (const balance of monthlyBalances) {
          if (balance.target_id) {
            if (!targetBalances.has(balance.target_id)) {
              targetBalances.set(balance.target_id, []);
            }
            targetBalances.get(balance.target_id)!.push(balance);
          }
        }
        
        // For each target, find the last balance before or at the first month
        for (const [targetId, balances] of targetBalances.entries()) {
          const sortedBalances = balances.sort((a, b) => a.date.localeCompare(b.date));
          let cumulativeBalance = 0;
          
          for (const balance of sortedBalances) {
            if (balance.date <= firstMonth) {
              cumulativeBalance = balance.cumulative_minutes + (balance.worked_minutes - balance.due_minutes);
            } else {
              break;
            }
          }
          
          runningBalances.set(targetId, cumulativeBalance);
        }
      }

      // Calculate balances for each day
      for (const group of chronologicalGroups) {
        const date = group.groupKey;
        const targetDailyWork = new Map<string, number>();
        const targetDailyDue = new Map<string, number>();

        // Aggregate worked minutes per target for this day
        for (const timelog of group.timelogs) {
          const targetId = getTargetId(timelog.timer_id);
          if (targetId && timelog.duration_minutes !== undefined) {
            const current = targetDailyWork.get(targetId) || 0;
            targetDailyWork.set(targetId, current + timelog.duration_minutes);
          }
        }

        // Calculate due minutes per target for this day
        for (const targetId of targetDailyWork.keys()) {
          const target = targets.find(t => t.id === targetId);
          if (target) {
            const dueMinutes = calculateDueMinutes(date, target as any, new Set());
            targetDailyDue.set(targetId, dueMinutes);
          }
        }

        // Update running balances
        for (const targetId of targetDailyWork.keys()) {
          const worked = targetDailyWork.get(targetId) || 0;
          const due = targetDailyDue.get(targetId) || 0;
          const currentBalance = runningBalances.get(targetId) || 0;
          const newBalance = currentBalance + (worked - due);
          runningBalances.set(targetId, newBalance);
          group.balances.set(targetId, newBalance);
        }
      }
    }

    // Return groups in the order they appear after sorting
    // (not chronological for date-based if sorted desc)
    return groups;
  });
</script>

<div class="overflow-x-auto h-full">
  <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
      <tr>
        {#if selectable}
          <th class="px-3 py-3 text-left">
            <input
              type="checkbox"
              checked={selectedIds.size === timelogs.length && timelogs.length > 0}
              onchange={toggleSelectAll}
              class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
            />
          </th>
        {/if}
        <th
          class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={() => handleSort('timer')}
        >
          <div class="flex items-center gap-1">
            Timer
            {#if sortColumn === 'timer'}
              <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
            {/if}
          </div>
        </th>
        <th
          class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={() => handleSort('target')}
        >
          <div class="flex items-center gap-1">
            Target
            {#if sortColumn === 'target'}
              <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
            {/if}
          </div>
        </th>
        <th
          class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={() => handleSort('type')}
        >
          <div class="flex items-center gap-1">
            Type
            {#if sortColumn === 'type'}
              <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
            {/if}
          </div>
        </th>
        <th
          class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={() => handleSort('start')}
        >
          <div class="flex items-center gap-1">
            Start
            {#if sortColumn === 'start'}
              <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
            {/if}
          </div>
        </th>
        <th
          class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={() => handleSort('end')}
        >
          <div class="flex items-center gap-1">
            End
            {#if sortColumn === 'end'}
              <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
            {/if}
          </div>
        </th>
        <th
          class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={() => handleSort('total_duration')}
        >
          <div class="flex items-center gap-1">
            Total Duration
            {#if sortColumn === 'total_duration'}
              <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
            {/if}
          </div>
        </th>
        <th
          class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          onclick={() => handleSort('effective_duration')}
        >
          <div class="flex items-center gap-1">
            Effective Duration
            {#if sortColumn === 'effective_duration'}
              <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
            {/if}
          </div>
        </th>
        <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
      </tr>
    </thead>
    <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
      {#each groupedTimelogs as group (group.groupKey)}
        <!-- Group separator row -->
        {#if group.groupLabel}
          <tr class="bg-gray-100 dark:bg-gray-800">
            <td colspan={selectable ? 9 : 8} class="px-3 py-2">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-gray-900 dark:text-gray-100">
                  {group.groupLabel}
                </span>
                {#if group.showBalances}
                  <div class="flex gap-4 text-sm">
                    {#each Array.from(group.balances.entries()) as [targetId, balance]}
                      {@const target = targets.find(t => t.id === targetId)}
                      {#if target}
                        <span class="text-gray-600 dark:text-gray-400">
                          {target.name}: 
                          <span class:text-green-600={balance >= 0} class:text-red-600={balance < 0}>
                            {formatBalance(balance)}
                          </span>
                        </span>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </div>
            </td>
          </tr>
        {/if}

        <!-- Timelogs for this group -->
        {#each group.timelogs as timelog (timelog.id)}
          <tr 
            class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
            onclick={() => handleRowClick(timelog)}
            ontouchstart={handleTouchStart}
            ontouchmove={handleTouchMove}
          >
            {#if selectable}
              <td class="px-3 py-2" onclick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(timelog.id)}
                  onchange={() => toggleSelect(timelog.id)}
                  class="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
                />
              </td>
            {/if}
            
            <!-- Timer -->
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {getTimerName(timelog.timer_id)}
            </td>
            
            <!-- Target -->
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
              {getTargetName(timelog.timer_id)}
            </td>
            
            <!-- Type -->
            <td class="px-3 py-2 whitespace-nowrap">
              <span class="px-2 py-1 text-xs font-medium rounded-full {getTypeBadgeClass(timelog.type)}">
                {getTypeLabel(timelog.type)}
              </span>
            </td>
            
            <!-- Start -->
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {#if group.showBalances && ['start', 'end'].includes(sortColumn)}
                {formatDateTimeConditional(timelog.start_timestamp, timelog.timezone || userTimezone, group.groupKey)}
              {:else}
                {formatDateTime(timelog.start_timestamp, timelog.timezone || userTimezone)}
              {/if}
            </td>
            
            <!-- End -->
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {#if group.showBalances && ['start', 'end'].includes(sortColumn)}
                {formatDateTimeConditional(timelog.end_timestamp, timelog.timezone || userTimezone, group.groupKey)}
              {:else}
                {formatDateTime(timelog.end_timestamp, timelog.timezone || userTimezone)}
              {/if}
            </td>
            
            <!-- Total Duration -->
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {formatDuration(getTotalDuration(timelog))}
            </td>
            
            <!-- Effective Duration -->
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {formatDuration(getEffectiveDuration(timelog))}
            </td>
            
            <!-- Notes -->
            <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
              <span title={timelog.notes || ''}>{timelog.notes || '-'}</span>
            </td>
          </tr>
        {/each}
      {:else}
        <tr>
          <td colspan={selectable ? 9 : 8} class="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
            No timelogs found
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if editingTimelog}
  <TimelogForm
    selectedDate={dayjs.utc(editingTimelog.start_timestamp).tz(editingTimelog.timezone || userTimezone)}
    existingLog={editingTimelog}
    save={handleSaveTimelog}
    close={handleCloseEditForm}
    del={handleDeleteTimelog}
  />
{/if}
