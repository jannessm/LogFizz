<script lang="ts">
  import { dayjs, type TimeLog, type Timer, type TimeLogType, type Balance, type Holiday } from '../../types';
  import { type TargetWithSpecs } from '../../types';
  import { userTimezone } from '../../../../lib/utils/dayjs';
  import { TimelogForm } from '../forms';
  import { calculateDueMinutes } from '../../../../lib/utils/balance';
  import { deleteTimelog, saveTimelog } from '../../services/formHandlers';
  import { dailyBalances, monthlyBalances } from '../../stores/balances';
  import { holidaysStore } from '../../stores/holidays';
  import { get } from 'svelte/store';
  import { _, locale } from '../../lib/i18n';
  import { formatMinutesCompact } from '../../../../lib/utils/timeFormat';

  type SortColumn = 'timer' | 'target' | 'type' | 'start' | 'end' | 'total_duration' | 'effective_duration' | 'due_time' | 'diff';
  type SortDirection = 'asc' | 'desc';

  export interface ColumnVisibility {
    timer: boolean;
    target: boolean;
    type: boolean;
    start: boolean;
    end: boolean;
    timezone: boolean;
    totalDuration: boolean;
    effectiveDuration: boolean;
    dueTime: boolean;
    diff: boolean;
    notes: boolean;
  }

  let {
    timelogs = [],
    timers = [],
    targets = [],
    selectable = false,
    selectedIds = $bindable(new Set<string>()),
    dateFrom = dayjs(),
    dateTo = null,
    visibleColumns = {
      timer: true,
      target: true,
      type: true,
      start: true,
      end: true,
      timezone: true,
      totalDuration: true,
      effectiveDuration: true,
      dueTime: true,
      diff: true,
      notes: true,
    },
  }: {
    timelogs: TimeLog[];
    timers: Timer[];
    targets: TargetWithSpecs[];
    selectable?: boolean;
    selectedIds?: Set<string>;
    dateFrom: dayjs.Dayjs;
    dateTo?: dayjs.Dayjs | null;
    visibleColumns?: ColumnVisibility;
  } = $props();

  // Calculate visible column count for colspan
  let visibleColumnCount = $derived(
    (selectable ? 1 : 0) +
    (visibleColumns.timer ? 1 : 0) +
    (visibleColumns.target ? 1 : 0) +
    (visibleColumns.type ? 1 : 0) +
    (visibleColumns.start ? 1 : 0) +
    (visibleColumns.end ? 1 : 0) +
    (visibleColumns.timezone ? 1 : 0) +
    (visibleColumns.totalDuration ? 1 : 0) +
    (visibleColumns.effectiveDuration ? 1 : 0) +
    (visibleColumns.dueTime ? 1 : 0) +
    (visibleColumns.diff ? 1 : 0) +
    (visibleColumns.notes ? 1 : 0)
  );

  // Editing state
  let editingTimelog = $state<TimeLog | null>(null);

  // Sort state
  let sortColumn = $state<SortColumn>('start');
  let sortDirection = $state<SortDirection>('asc');

  // Touch tracking for mobile scroll vs click
  let touchStartY = 0;
  let touchStartX = 0;
  let isTouchMove = false;

  function getTimerName(timerId: string): string {
    const timer = timers.find(t => t.id === timerId);
    return timer ? `${timer.emoji || ''} ${timer.name}`.trim() : $_('common.unknown');
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

  function formatBalance(minutes: number): string {
    if (isNaN(minutes)) return '0h 0m';
    const isNegative = minutes < 0;
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const sign = isNegative ? '-' : '+';

    if (hours === 0) {
      return `${sign}${mins}m`;
    }
    return `${sign}${hours}h ${mins}m`;
  }

  function getTypeLabel(type: TimeLogType): string {
    const labels: Record<TimeLogType, string> = {
      'normal': $_('timelog.typeNormal'),
      'homeoffice': $_('timelog.typeHomeoffice'),
      'sick': $_('timelog.typeSick'),
      'holiday': $_('timelog.typeHoliday'),
      'business-trip': $_('timelog.typeBusinessTrip'),
      'child-sick': $_('timelog.typeChildSick'),
    };
    return labels[type] || type;
  }

  function getTypeBadgeClass(type: TimeLogType): string {
    const classes: Record<TimeLogType, string> = {
      'normal': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'homeoffice': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      'sick': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'holiday': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'business-trip': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'child-sick': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return classes[type] || '';
  }

  function buildHolidaysForDate(date: string, target: TargetWithSpecs): Map<string, Set<string>> {
    const holidaysMap = new Map<string, Set<string>>();
    const [year, month] = date.split('-').map(Number);
    for (const spec of target.target_specs || []) {
      if (spec.exclude_holidays && spec.state_code && !holidaysMap.has(spec.state_code)) {
        const dates = new Set<string>(
          holidaysStore.getHolidaysForMonth(spec.state_code, year, month).map(h => h.date)
        );
        holidaysMap.set(spec.state_code, dates);
      }
    }
    return holidaysMap;
  }

  function getTotalDuration(timelog: TimeLog): number | undefined {
    if (timelog.whole_day) {
      // For whole_day entries, return due minutes from target
      const targetId = getTargetId(timelog.timer_id);
      if (targetId) {
        const target = targets.find(t => t.id === targetId);
        if (target) {
          const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
          return calculateDueMinutes(date, target as any, buildHolidaysForDate(date, target));
        }
      }
      return undefined;
    }
    
    if (!timelog.end_timestamp) return undefined;
    const start = dayjs(timelog.start_timestamp);
    const end = dayjs(timelog.end_timestamp);
    return end.diff(start, 'minute');
  }

  function getEffectiveDuration(timelog: TimeLog): number {
    if (timelog.whole_day) {
      // For whole_day entries, return due minutes from target
      const targetId = getTargetId(timelog.timer_id);
      if (targetId) {
        const target = targets.find(t => t.id === targetId);
        if (target) {
          const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
          return calculateDueMinutes(date, target as any, buildHolidaysForDate(date, target));
        }
      }
      return 0;
    }
    
    return timelog.duration_minutes;
  }

  // Map of "date|targetId" -> timelogs sorted by start_timestamp (ascending).
  // Used to compute how much effective work preceding entries already covered
  // so the due time for later entries on the same day+target is reduced accordingly.
  let priorWorkMap = $derived.by(() => {
    const map = new Map<string, TimeLog[]>();
    for (const timelog of timelogs) {
      const targetId = getTargetId(timelog.timer_id);
      if (!targetId) continue;
      const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
      const key = `${date}|${targetId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(timelog);
    }
    // Sort each bucket by start time
    for (const bucket of map.values()) {
      bucket.sort((a, b) => new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime());
    }
    return map;
  });

  // Returns how many minutes of effective work for the same date+target come
  // from timelogs that started BEFORE this one (i.e. already "used up" due time).
  function getPriorWork(timelog: TimeLog): number {
    const targetId = getTargetId(timelog.timer_id);
    if (!targetId) return 0;
    const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
    const key = `${date}|${targetId}`;
    const bucket = priorWorkMap.get(key);
    if (!bucket) return 0;
    let prior = 0;
    for (const t of bucket) {
      if (t.id === timelog.id) break;
      prior += getEffectiveDuration(t);
    }
    return prior;
  }

  function getDueTime(timelog: TimeLog): number {
    const targetId = getTargetId(timelog.timer_id);
    if (!targetId) return 0;
    
    const target = targets.find(t => t.id === targetId);
    if (!target) return 0;
    
    const date = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
    const fullDue = calculateDueMinutes(date, target as any, buildHolidaysForDate(date, target));
    const prior = getPriorWork(timelog);
    return Math.max(0, fullDue - prior);
  }

  function getDiff(timelog: TimeLog): number | undefined {
    const effective = getEffectiveDuration(timelog);
    const due = getDueTime(timelog);
    return effective - due;
  }

  function formatDiff(minutes: number | undefined): string {
    if (minutes === undefined || isNaN(minutes)) return '-';
    const isNegative = minutes < 0;
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const sign = isNegative ? '-' : '+';
    if (hours === 0) {
      return `${sign}${mins}m`;
    }
    return `${sign}${hours}h ${mins}m`;
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
        case 'due_time':
          const aDue = getDueTime(a) ?? -1;
          const bDue = getDueTime(b) ?? -1;
          comparison = aDue - bDue;
          break;
        case 'diff':
          const aDiff = getDiff(a) ?? 0;
          const bDiff = getDiff(b) ?? 0;
          comparison = aDiff - bDiff;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  });

  // Expand multi-day timelogs into separate entries for each day
  interface ExpandedTimelog {
    timelog: TimeLog;
    displayDate: string; // YYYY-MM-DD - the date this entry represents
    isMultiDay: boolean;
  }

  function expandTimelogs(logs: TimeLog[]): ExpandedTimelog[] {
    const expanded: ExpandedTimelog[] = [];
    
    for (const timelog of logs) {
      const startDate = dayjs.utc(timelog.start_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD');
      const endDate = timelog.end_timestamp 
        ? dayjs.utc(timelog.end_timestamp).tz(timelog.timezone || userTimezone).format('YYYY-MM-DD')
        : startDate;
      
      if (startDate === endDate) {
        // Single day timelog
        expanded.push({ timelog, displayDate: startDate, isMultiDay: false });
      } else {
        // Multi-day timelog - add entry for each day
        let currentDate = dayjs(startDate);
        const end = dayjs(endDate);
        
        while (currentDate.isSameOrBefore(end, 'day')) {
          expanded.push({
            timelog,
            displayDate: currentDate.format('YYYY-MM-DD'),
            isMultiDay: true,
          });
          currentDate = currentDate.add(1, 'day');
        }
      }
    }
    
    return expanded;
  }

  // Group timelogs with accumulated balances
  // Group by different criteria based on sort column
  interface GroupData {
    groupKey: string;        // Unique key for the group
    groupLabel: string;      // Display label for the group header
    holidayName: string | null; // Holiday name if this date is a public holiday
    timelogs: ExpandedTimelog[];
    balances: Map<string, number>; // targetId -> accumulated balance (only for date-based grouping)
    showBalances: boolean;   // Whether to show balances for this group
    totalDuration: number;   // Total duration minutes for this group
    totalDue: number;        // Total due minutes for this group
    totalWorked: number;     // Total effective worked minutes for this group
    totalDiff: number;       // Total difference (worked - due) for this group
  }

  // Get all relevant state codes from targets for holiday lookup
  function getStateCodes(): string[] {
    const stateCodes = new Set<string>();
    for (const target of targets) {
      for (const spec of target.target_specs || []) {
        if (spec.state_code) {
          stateCodes.add(spec.state_code);
        }
      }
    }
    console.log('Derived state codes for holiday lookup:', targets);
    return Array.from(stateCodes);
  }

  let groupedTimelogs = $derived.by(() => {
    const groups: GroupData[] = [];
    const groupMap = new Map<string, GroupData>();

    // Determine what to group by
    let shouldGroupByDate = sortColumn === 'start' || sortColumn === 'end';
    let shouldGroupByValue = ['timer', 'target', 'type'].includes(sortColumn);
    
    // Expand multi-day timelogs
    const expandedTimelogs = expandTimelogs(sortedTimelogs);
    
    // For duration columns, don't group
    if (!shouldGroupByDate && !shouldGroupByValue) {
      return [{
        groupKey: 'flat',
        groupLabel: '',
        holidayName: null,
        timelogs: expandedTimelogs,
        balances: new Map<string, number>(),
        showBalances: false,
      }];
    }

    // Get daily balances and state codes for holiday lookup
    const _dailyBalances = get(dailyBalances);
    const _monthlyBalances = get(monthlyBalances);
    const stateCodes = getStateCodes();

    // For date-based grouping, determine the date range from both timelogs and daily balances
    let minDate = dateFrom.format('YYYY-MM-DD');
    let maxDate = dateTo ? dateTo.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
    if (shouldGroupByDate) {
      // Include all days from daily balances within this range (e.g., holidays without work entries)
      for (const balance of _dailyBalances) {
        const date = balance.date;
        // Only include dates within the overall range
        if (date >= minDate && date <= maxDate && !groupMap.has(date)) {
          const dateDayjs = dayjs(date);
          const holidays = holidaysStore.getHolidaysForDate(date, stateCodes);
          const h0 = holidays[0];
          const holidayName = h0 ? (get(locale) === 'de' && h0.localName ? h0.localName : h0.name) : null;
          
          if (!holidayName && balance.worked_minutes === 0 && balance.due_minutes === 0) {
            // Skip non-holiday dates with no work
            continue;
          }
          
          const group: GroupData = {
            groupKey: date,
            groupLabel: dateDayjs.format('L'),
            holidayName,
            timelogs: [],
            balances: new Map(),
            showBalances: true,
            totalDuration: 0,
            totalDue: balance.due_minutes,
            totalWorked: balance.worked_minutes,
            totalDiff: balance.worked_minutes - balance.due_minutes,
          };
          groups.push(group);
          groupMap.set(date, group);
        }
      }
    }

    // Group timelogs
    for (const expanded of expandedTimelogs) {
      let groupKey = '';
      let groupLabel = '';
      let holidayName: string | null = null;
      
      if (shouldGroupByDate) {
        groupKey = expanded.displayDate;
        const date = dayjs(expanded.displayDate);
        groupLabel = date.format('L');
        
        // Check for holiday
        const holidays = holidaysStore.getHolidaysForDate(groupKey, stateCodes);
        const h0 = holidays[0];
        holidayName = h0 ? (get(locale) === 'de' && h0.localName ? h0.localName : h0.name) : null;
      } else if (sortColumn === 'timer') {
        groupKey = expanded.timelog.timer_id;
        groupLabel = getTimerName(expanded.timelog.timer_id);
      } else if (sortColumn === 'target') {
        const targetId = getTargetId(expanded.timelog.timer_id);
        groupKey = targetId || 'no-target';
        groupLabel = targetId ? getTargetName(expanded.timelog.timer_id) : 'No Target';
      } else if (sortColumn === 'type') {
        groupKey = expanded.timelog.type;
        groupLabel = getTypeLabel(expanded.timelog.type);
      }
      
      if (!groupMap.has(groupKey)) {
        const group: GroupData = {
          groupKey,
          groupLabel,
          holidayName,
          timelogs: [],
          balances: new Map(),
          showBalances: shouldGroupByDate,
          totalDuration: 0,
          totalDue: 0,
          totalWorked: 0,
          totalDiff: 0,
        };
        groups.push(group);
        groupMap.set(groupKey, group);
      }
      
      groupMap.get(groupKey)!.timelogs.push(expanded);
      // Update holiday name if not set
      if (holidayName && !groupMap.get(groupKey)!.holidayName) {
        groupMap.get(groupKey)!.holidayName = holidayName;
      }
    }

    // Sort timelogs within each group by start date when grouping by value
    if (shouldGroupByValue) {
      for (const group of groups) {
        group.timelogs.sort((a, b) => {
          const timeA = new Date(a.timelog.start_timestamp).getTime();
          const timeB = new Date(b.timelog.start_timestamp).getTime();
          return timeA - timeB;
        });
      }
    }

    // Calculate balances using daily balances from the store
    if (shouldGroupByDate) {
      // Get all months from the groups
      const months = new Set(groups.map(g => g.groupKey.substring(0, 7)));
      const firstMonth = [...months].sort((a, b) => a.localeCompare(b))[0];
      
      // Get start balances (cumulative from previous months)
      const startBalances = _monthlyBalances.filter(b => b.date < firstMonth);
      
      // Sort groups chronologically for balance calculation
      const chronologicalGroups = [...groups].sort((a, b) => a.groupKey.localeCompare(b.groupKey));

      // Track running balances per target
      const runningBalances = new Map<string, number>();

      // Initialize running balances from the last month before the first displayed month
      for (const target of targets) {
        const targetBalances = startBalances
          .filter(b => b.target_id === target.id)
          .sort((a, b) => b.date.localeCompare(a.date));
        
        if (targetBalances.length > 0) {
          const lastBalance = targetBalances[0];
          // End-of-month balance = cumulative + (worked - due)
          runningBalances.set(target.id, lastBalance.cumulative_minutes + (lastBalance.worked_minutes - lastBalance.due_minutes));
        }
      }

      // Use daily balances to calculate running balances
      for (const group of chronologicalGroups) {
        const date = group.groupKey;
        
        // Find daily balances for this date
        const dayBalances = _dailyBalances.filter(b => b.date === date);
        
        for (const dayBalance of dayBalances) {
          const targetId = dayBalance.target_id;
          const currentBalance = runningBalances.get(targetId) || 0;
          const newBalance = currentBalance + (dayBalance.worked_minutes - dayBalance.due_minutes);
          runningBalances.set(targetId, newBalance);
          group.balances.set(targetId, newBalance);
        }
      }
    }

    // Sort groups based on sort direction
    if (shouldGroupByDate) {
      groups.sort((a, b) => {
        const cmp = a.groupKey.localeCompare(b.groupKey);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

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
        {#if visibleColumns.timer}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            onclick={() => handleSort('timer')}
          >
            <div class="flex items-center gap-1">
              {$_('common.timer')}
              {#if sortColumn === 'timer'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.target}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            onclick={() => handleSort('target')}
          >
            <div class="flex items-center gap-1">
              {$_('common.target')}
              {#if sortColumn === 'target'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.type}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            onclick={() => handleSort('type')}
          >
            <div class="flex items-center gap-1">
              {$_('common.type')}
              {#if sortColumn === 'type'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.start}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            onclick={() => handleSort('start')}
          >
            <div class="flex items-center gap-1">
              {$_('common.start')}
              {#if sortColumn === 'start'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.end}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            onclick={() => handleSort('end')}
          >
            <div class="flex items-center gap-1">
              {$_('common.end')}
              {#if sortColumn === 'end'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.timezone}
          <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {$_('export.timezone')}
          </th>
        {/if}
        {#if visibleColumns.totalDuration}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[93px]"
            onclick={() => handleSort('total_duration')}
          >
            <div class="flex items-center gap-1">
              {$_('table.totalDuration')}
              {#if sortColumn === 'total_duration'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.effectiveDuration}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[93px]"
            onclick={() => handleSort('effective_duration')}
          >
            <div class="flex items-center gap-1">
              {$_('table.effectiveDuration')}
              {#if sortColumn === 'effective_duration'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.dueTime}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[93px]"
            onclick={() => handleSort('due_time')}
          >
            <div class="flex items-center gap-1">
              {$_('table.dueTime')}
              {#if sortColumn === 'due_time'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.diff}
          <th
            class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 min-w-[93px]"
            onclick={() => handleSort('diff')}
          >
            <div class="flex items-center gap-1">
              {$_('table.diff')}
              {#if sortColumn === 'diff'}
                <span class="{sortDirection === 'asc' ? 'icon-[proicons--chevron-up]' : 'icon-[proicons--chevron-down]'} w-4 h-4"></span>
              {/if}
            </div>
          </th>
        {/if}
        {#if visibleColumns.notes}
          <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{$_('timelog.notes')}</th>
        {/if}
      </tr>
    </thead>
    <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
      {#each groupedTimelogs as group (group.groupKey)}
        <!-- Group separator row -->
        {#if group.groupLabel}
          <tr class="bg-gray-100 dark:bg-gray-800 font-medium align-bottom">
            {#if selectable}
              <td class="px-3 py-2"></td>
            {/if}
            {#if visibleColumns.timer}
              <td class="px-3 py-2 align-bottom" colspan={visibleColumns.target && visibleColumns.type && visibleColumns.start && visibleColumns.end ? 5 : 1}>
                <div class="space-y-1 mt-2">
                  <div class="font-semibold text-gray-900 dark:text-gray-100">
                    {group.groupLabel}
                    {#if group.holidayName}
                      <span class="ml-2 text-sm font-normal text-green-600 dark:text-green-400">
                        ({group.holidayName})
                      </span>
                    {/if}
                  </div>
                  {#if group.showBalances && group.balances.size > 0}
                    <div class="flex gap-3 text-xs font-normal">
                      {#each Array.from(group.balances.entries()) as [targetId, balance]}
                        {@const target = targets.find(t => t.id === targetId)}
                        {#if target}
                          <span class="text-gray-500 dark:text-gray-500">
                            {target.name}: 
                            <span class:text-balance-positive={balance >= 0} class:text-balance-negative={balance < 0}>
                              {formatBalance(balance)}
                            </span>
                          </span>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              </td>
            {:else}
              <td class="px-3 py-2 align-bottom" colspan={(() => {
                let count = 0;
                if (visibleColumns.target) count++;
                if (visibleColumns.type) count++;
                if (visibleColumns.start) count++;
                if (visibleColumns.end) count++;
                return count || 1;
              })()}>
                <div class="space-y-1 mt-2">
                  <div class="font-semibold text-gray-900 dark:text-gray-100">
                    {group.groupLabel}
                    {#if group.holidayName}
                      <span class="ml-2 text-sm font-normal text-green-600 dark:text-green-400">
                        ({group.holidayName})
                      </span>
                    {/if}
                  </div>
                  {#if group.showBalances && group.balances.size > 0}
                    <div class="flex gap-3 text-xs font-normal">
                      {#each Array.from(group.balances.entries()) as [targetId, balance]}
                        {@const target = targets.find(t => t.id === targetId)}
                        {#if target}
                          <span class="text-gray-500 dark:text-gray-500">
                            {target.name}: 
                            <span class:text-balance-positive={balance >= 0} class:text-balance-negative={balance < 0}>
                              {formatBalance(balance)}
                            </span>
                          </span>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              </td>
            {/if}
            {#if visibleColumns.timezone}
              <td class="px-3 py-2 align-bottom text-sm text-gray-600 dark:text-gray-400">
              </td>
            {/if}
            {#if visibleColumns.totalDuration}
              <td class="px-3 py-2 align-bottom text-sm text-gray-600 dark:text-gray-400">
              </td>
            {/if}
            {#if visibleColumns.effectiveDuration}
              <td class="px-3 py-2 align-bottom text-sm text-gray-600 dark:text-gray-400">
              </td>
            {/if}
            {#if visibleColumns.dueTime}
              <td class="px-3 py-2 align-bottom text-sm text-gray-600 dark:text-gray-400">
              </td>
            {/if}
            {#if visibleColumns.diff}
              <td class="px-3 py-2 align-bottom text-sm">
              </td>
            {/if}
            {#if visibleColumns.notes}
              <td class="px-3 py-2"></td>
            {/if}
          </tr>
        {/if}

        <!-- Timelogs for this group -->
        {#each group.timelogs as expanded (expanded.timelog.id + '_' + expanded.displayDate)}
          {@const timelog = expanded.timelog}
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
            {#if visibleColumns.timer}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {getTimerName(timelog.timer_id)}
              </td>
            {/if}
            
            <!-- Target -->
            {#if visibleColumns.target}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {getTargetName(timelog.timer_id)}
              </td>
            {/if}
            
            <!-- Type -->
            {#if visibleColumns.type}
              <td class="px-3 py-2 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium rounded-full {getTypeBadgeClass(timelog.type)}">
                  {getTypeLabel(timelog.type)}
                </span>
              </td>
            {/if}
            
            <!-- Start -->
            {#if visibleColumns.start}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {#if group.showBalances && ['start', 'end'].includes(sortColumn)}
                  {formatDateTimeConditional(timelog.start_timestamp, timelog.timezone || userTimezone, group.groupKey)}
                {:else}
                  {formatDateTime(timelog.start_timestamp, timelog.timezone || userTimezone)}
                {/if}
              </td>
            {/if}
            
            <!-- End -->
            {#if visibleColumns.end}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {#if group.showBalances && ['start', 'end'].includes(sortColumn)}
                  {formatDateTimeConditional(timelog.end_timestamp, timelog.timezone || userTimezone, group.groupKey)}
                {:else}
                  {formatDateTime(timelog.end_timestamp, timelog.timezone || userTimezone)}
                {/if}
              </td>
            {/if}
            
            <!-- Timezone -->
            {#if visibleColumns.timezone}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {timelog.timezone || userTimezone}
              </td>
            {/if}
            
            <!-- Total Duration -->
            {#if visibleColumns.totalDuration}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatMinutesCompact(getTotalDuration(timelog), $_('timelog.running'))}
              </td>
            {/if}
            
            <!-- Effective Duration -->
            {#if visibleColumns.effectiveDuration}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatMinutesCompact(getEffectiveDuration(timelog), $_('timelog.running'))}
              </td>
            {/if}
            
            <!-- Due Time -->
            {#if visibleColumns.dueTime}
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                {formatMinutesCompact(getDueTime(timelog), $_('timelog.running'))}
              </td>
            {/if}
            
            <!-- Diff (Effective - Due) -->
            {#if visibleColumns.diff}
              {@const diff = getDiff(timelog)}
              <td class="px-3 py-2 whitespace-nowrap text-sm">
                <span class:text-green-600={diff !== undefined && diff >= 0} class:text-red-600={diff !== undefined && diff < 0} class:text-gray-900={diff === undefined} class:dark:text-gray-100={diff === undefined}>
                  {formatDiff(diff)}
                </span>
              </td>
            {/if}
            
            <!-- Notes -->
            {#if visibleColumns.notes}
              <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                <span title={timelog.notes || ''}>{timelog.notes || '-'}</span>
              </td>
            {/if}
          </tr>
        {/each}
      {:else}
        <tr>
          <td colspan={visibleColumnCount} class="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
            {$_('table.noTimelogsFound')}
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
