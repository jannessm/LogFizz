<script lang="ts">
  import BottomNav from '../components/BottomNav.svelte';
  import SessionBox from '../components/history/SessionBox.svelte';
  import TimelogForm from '../components/forms/TimelogForm.svelte';
  import { timers } from '../stores/timers';
  import { targets } from '../stores/targets';
  import { timeLogsStore } from '../stores/timelogs';
  import { dayjs } from '../types';
  import type { TimeLog, Holiday } from '../../../lib/types';
  import { createCalendarStore, loadCalendarMonth } from '../services/calendar';
  import { navigate } from '../lib/navigation';
  import { onMount } from 'svelte';
  import { _, locale } from '../lib/i18n';
  import { computeIndentation, type Session } from '../lib/utils/computeIndentation';
  import {
    getHourLabels, getSessionsForSelectedDate,
  } from '../services/timeline';
  import { saveTimelog } from '../services/formHandlers';
  import { formatMinutesCompact } from '../../../lib/dist/utils/timeFormat';
  import { getDayAbbreviation } from '../lib/dateFormatting';
  import { userSettingsStore } from '../stores/userSettings';

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let firstDayOfWeek = $derived<'sunday' | 'monday'>(
    ($userSettingsStore.settings?.first_day_of_week as 'sunday' | 'monday') || 'sunday'
  );

  // Compute start of week respecting firstDayOfWeek setting.
  // date.day() must be evaluated in the user's local timezone because
  // dayjs.tz.setDefault('UTC') is set globally — without .tz(), a date like
  // "Sun 1 Mar 00:00 local" resolves to "Sat 28 Feb 23:00 UTC" and returns
  // day=6 instead of day=0, causing the week to snap to the wrong Monday/Sunday.
  function getWeekStart(date: dayjs.Dayjs): dayjs.Dayjs {
    const localDate = date.tz(userTimezone);
    const dow = localDate.day(); // 0=Sun .. 6=Sat, in local tz
    if (firstDayOfWeek === 'monday') {
      const offset = dow === 0 ? 6 : dow - 1;
      return localDate.subtract(offset, 'day').startOf('day');
    }
    return localDate.subtract(dow, 'day').startOf('day');
  }

  // Initialize week anchor from URL query parameter
  function getInitialAnchor(): dayjs.Dayjs {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    if (weekParam) {
      const parsed = dayjs(weekParam);
      if (parsed.isValid()) return parsed.startOf('day');
    }
    return dayjs().startOf('day');
  }

  let rawWeekAnchor = $state(getInitialAnchor());
  let weekStart = $derived(getWeekStart(rawWeekAnchor));

  let weekDays = $derived(
    Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'))
  );

  // Update URL when week changes
  $effect(() => {
    const params = new URLSearchParams();
    params.set('week', weekStart.format('YYYY-MM-DD'));
    window.history.replaceState({}, '', `/week?${params.toString()}`);
  });

  // Calendar stores for the months covered by this week
  let calendarStoreMonth1 = $derived(
    createCalendarStore(weekStart.year(), weekStart.month() + 1, 1, $timers, $targets)
  );
  let calendarStoreMonth2 = $derived(
    (() => {
      const weekEnd = weekStart.add(6, 'day');
      if (weekEnd.month() !== weekStart.month() || weekEnd.year() !== weekStart.year()) {
        return createCalendarStore(weekEnd.year(), weekEnd.month() + 1, 1, $timers, $targets);
      }
      return null;
    })()
  );

  let calendarData1 = $derived($calendarStoreMonth1);
  let calendarData2 = $derived(calendarStoreMonth2 ? $calendarStoreMonth2 : null);

  function getTimeLogsForDate(dateStr: string): TimeLog[] {
    const logs1 = calendarData1.timeLogsByDate.get(dateStr) || [];
    const logs2 = calendarData2?.timeLogsByDate.get(dateStr) || [];
    const seen = new Set<string>();
    const merged: TimeLog[] = [];
    for (const log of [...logs1, ...logs2]) {
      if (!seen.has(log.id)) {
        seen.add(log.id);
        merged.push(log);
      }
    }
    return merged;
  }

  function getHolidaysForDate(dateStr: string): Holiday[] {
    const h1 = calendarData1.relevantHolidays.get(dateStr) || [];
    const h2 = calendarData2?.relevantHolidays.get(dateStr) || [];
    const seen = new Set<string>();
    const merged: Holiday[] = [];
    for (const h of [...h1, ...h2]) {
      const key = `${h.name}-${h.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(h);
      }
    }
    return merged;
  }

  // Per-day computed data
  type DayData = {
    day: dayjs.Dayjs;
    dateStr: string;
    sessions: Session[];
    multiDaySessions: Session[];
    displaySessions: Session[];
    holidays: Holiday[];
  };

  let daysData: DayData[] = $derived(
    weekDays.map(day => {
      const dateStr = day.format('YYYY-MM-DD');
      const timeLogs = getTimeLogsForDate(dateStr);
      const sessionsData = getSessionsForSelectedDate(day, timeLogs);
      return {
        day,
        dateStr,
        sessions: sessionsData.sessions,
        multiDaySessions: sessionsData.multiDaySessions,
        displaySessions: computeIndentation(sessionsData.sessions),
        holidays: getHolidaysForDate(dateStr),
      };
    })
  );

  // Unified timeline across all days
  let unifiedTimeline = $derived.by(() => {
    const allSessions = daysData.flatMap(d => d.sessions);
    if (allSessions.length === 0) {
      const defaultStart = weekStart.hour(8).minute(0);
      const defaultEnd = weekStart.hour(18).minute(0);
      return {
        timelineStart: defaultStart,
        timelineEnd: defaultEnd,
        timelineHours: 10,
        timelineHeight: 600,
      };
    }

    let earliestMinutes = 24 * 60;
    let latestMinutes = 0;

    for (const dayData of daysData) {
      for (const session of dayData.sessions) {
        const logTimezone = session.log?.timezone || userTimezone;
        const start = dayjs.utc(session.startTime).tz(logTimezone);
        const end = session.endTime ? dayjs.utc(session.endTime).tz(logTimezone) : dayjs();

        const startMin = start.hour() * 60 + start.minute();
        let endMin = end.hour() * 60 + end.minute();
        // If session crosses midnight or ends at midnight
        if (endMin === 0 && (!session.endTime || end.date() !== start.date())) {
          endMin = 24 * 60;
        }
        // If end is on a different day, cap at midnight
        if (end.format('YYYY-MM-DD') !== start.format('YYYY-MM-DD') && endMin < startMin) {
          endMin = 24 * 60;
        }

        if (startMin < earliestMinutes) earliestMinutes = startMin;
        if (endMin > latestMinutes) latestMinutes = endMin;
      }
    }

    // Round to hour boundaries
    const startHour = Math.floor(earliestMinutes / 60);
    const endHour = Math.min(24, Math.ceil(latestMinutes / 60) + 1);
    const timelineStart = weekStart.hour(startHour).minute(0);
    const timelineEnd = weekStart.hour(endHour).minute(0);
    const timelineHours = endHour - startHour;

    const MIN_LABEL_SPACING_PX = 50;
    const minHeight = Math.max(400, Math.ceil((MIN_LABEL_SPACING_PX * timelineHours) / 0.9));

    return { timelineStart, timelineEnd, timelineHours, timelineHeight: minHeight };
  });

  let hourLabels = $derived(getHourLabels(unifiedTimeline.timelineStart, unifiedTimeline.timelineHours));

  let hasMultiDay = $derived(daysData.some(d => d.multiDaySessions.length > 0 || d.holidays.length > 0));

  // Timelog form state
  let showTimelogForm = $state(false);
  let editingTimelog: Session | null = $state(null);
  let editingDate: dayjs.Dayjs | null = $state(null);

  function handleEditTimelog(session: Session, day: dayjs.Dayjs) {
    editingTimelog = session;
    editingDate = day;
    showTimelogForm = true;
  }

  function handleSaveTimelog(newLog: TimeLog) {
    saveTimelog(newLog, editingTimelog?.log).then(() => {
      showTimelogForm = false;
      editingTimelog = null;
      editingDate = null;
    });
  }

  function handleCloseForm() {
    showTimelogForm = false;
    editingTimelog = null;
    editingDate = null;
  }

  async function handleDelete(log: TimeLog) {
    await timeLogsStore.delete(log);
    showTimelogForm = false;
  }

  // Load settings and calendar data
  onMount(async () => {
    rawWeekAnchor = getInitialAnchor();
    await loadMonthsForWeek();
  });

  $effect(() => {
    const _week = weekStart;
    loadMonthsForWeek();
  });

  async function loadMonthsForWeek() {
    const promises = [
      loadCalendarMonth(weekStart.year(), weekStart.month() + 1)
    ];
    const weekEnd = weekStart.add(6, 'day');
    if (weekEnd.month() !== weekStart.month() || weekEnd.year() !== weekStart.year()) {
      promises.push(loadCalendarMonth(weekEnd.year(), weekEnd.month() + 1));
    }
    await Promise.all(promises);
  }

  function previousWeek() {
    rawWeekAnchor = weekStart.subtract(7, 'day');
  }

  function nextWeek() {
    rawWeekAnchor = weekStart.add(7, 'day');
  }

  function navigateBackToHistory() {
    const params = new URLSearchParams();
    params.set('date', weekStart.format('YYYY-MM-DD'));
    params.set('month', weekStart.format('YYYY-MM-DD'));
    navigate(`/history?${params.toString()}`);
  }

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  const TYPE_COLORS: Record<string, string> = {
    'sick': '#EF4444',
    'holiday': '#10B981',
    'business-trip': '#F59E0B',
    'child-sick': '#EC4899',
  };
</script>

<div class="flex flex-col h-screen">
  <!-- Header -->
  <div class="w-full px-4 pt-6 pb-2">
    <div class="w-full max-w-7xl mx-auto flex justify-between items-center">
      <div class="flex items-center gap-2">
        <button
          onclick={navigateBackToHistory}
          class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--arrow-left-duotone] text-gray-600 dark:text-gray-400"
          style="width: 28px; height: 28px;"
          aria-label={$_('history.backToHistory')}
        ></button>
        <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">{$_('history.weekView')}</h1>
      </div>
    </div>
  </div>

  <!-- Week Navigation -->
  <div class="w-full px-4 pb-2">
    <div class="w-full max-w-7xl mx-auto flex items-center justify-center gap-4">
      <button
        onclick={previousWeek}
        class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--chevron-left-alt-duotone] text-gray-600 dark:text-gray-400"
        aria-label={$_('history.previousWeek')}
      ></button>
      <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 min-w-[250px] text-center">
        {weekStart.format('ll')} – {weekStart.add(6, 'day').format('ll')}
      </h2>
      <button
        onclick={nextWeek}
        class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--chevron-right-alt-duotone] text-gray-600 dark:text-gray-400"
        aria-label={$_('history.nextWeek')}
      ></button>
    </div>
  </div>

  <!-- Week Timeline Grid -->
  <div class="w-full flex-1 overflow-auto min-h-0">
    <div class="w-full px-4 pb-4 max-w-7xl mx-auto">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">

        <!-- Day Headers -->
        <div class="grid gap-0 mb-2" style="grid-template-columns: 50px repeat(7, 1fr);">
          <!-- Empty cell above hour labels -->
          <div></div>
          {#each daysData as dayData}
            <div
              class="text-center px-1 py-2 border-l border-gray-200 dark:border-gray-700"
              class:bg-primary-50={isToday(dayData.day)}
            >
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {getDayAbbreviation(dayData.day.day())}
              </div>
              <div
                class="text-sm font-semibold mt-0.5 {isToday(dayData.day) ? 'text-primary' : 'text-gray-800 dark:text-gray-100'}"
              >
                {dayData.day.format('D')}
              </div>
            </div>
          {/each}
        </div>

        <!-- Multi-day entries & holidays row -->
        {#if hasMultiDay}
          <div class="grid gap-0 mb-2 border-b border-gray-200 dark:border-gray-700 pb-2" style="grid-template-columns: 50px repeat(7, 1fr);">
            <div></div>
            {#each daysData as dayData}
              <div class="px-1 border-l border-gray-200 dark:border-gray-700 space-y-1">
                {#each dayData.holidays as holiday}
                  {@const holidayDisplayName = $locale === 'de' && holiday.localName ? holiday.localName : holiday.name}
                  <div class="text-xs rounded px-1 py-0.5 truncate" style="background-color: #A855F710; color: #A855F7;" title={holidayDisplayName}>
                    🎉 {holidayDisplayName}
                  </div>
                {/each}
                {#each dayData.multiDaySessions as session}
                  {@const timer = $timers.find(t => t.id === session.timer_id)}
                  {@const type = session.log?.type || 'normal'}
                  {@const typeColor = TYPE_COLORS[type] || '#6B7280'}
                  {#if timer}
                    <button
                      onclick={() => handleEditTimelog(session, dayData.day)}
                      class="w-full text-left text-xs rounded px-1 py-0.5 truncate hover:opacity-80 transition-opacity"
                      style="background-color: {typeColor}15; color: {typeColor};"
                      title="{timer.emoji || ''} {timer.name}"
                    >
                      {timer.emoji || ''} {timer.name}
                    </button>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Timeline Grid: hour labels + 7 day columns -->
        <div class="grid gap-0" style="grid-template-columns: 50px repeat(7, 1fr);">
          <!-- Hour Labels Column -->
          <div class="relative" style="height: {unifiedTimeline.timelineHeight}px;">
            {#each hourLabels as label, index}
              <div
                class="absolute right-1 text-xs text-gray-500 dark:text-gray-400 text-right"
                style="top: {unifiedTimeline.timelineHours > 0 ? (index / unifiedTimeline.timelineHours) * 90 : 0}%; transform: translateY(-50%);"
              >
                {label}
              </div>
            {/each}
          </div>

          <!-- Day Columns -->
          {#each daysData as dayData}
            <div
              class="relative border-l border-gray-200 dark:border-gray-700 {isToday(dayData.day) ? 'bg-primary-50 dark:bg-primary-900/10' : ''}"
              style="height: {unifiedTimeline.timelineHeight}px;"
            >
              <!-- Hour grid lines -->
              {#each hourLabels as _, index}
                <div
                  class="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/50"
                  style="top: {unifiedTimeline.timelineHours > 0 ? (index / unifiedTimeline.timelineHours) * 90 : 0}%;"
                ></div>
              {/each}

              <!-- Session boxes -->
              {#each dayData.displaySessions as session}
                {@const timer = $timers.find(t => t.id === session.timer_id)}
                {@const dayTimelineStart = unifiedTimeline.timelineStart
                  ? dayData.day.hour(unifiedTimeline.timelineStart.hour()).minute(unifiedTimeline.timelineStart.minute()).second(0)
                  : null}
                {@const dayTimelineEnd = unifiedTimeline.timelineEnd
                  ? dayData.day.hour(unifiedTimeline.timelineEnd.hour()).minute(unifiedTimeline.timelineEnd.minute()).second(0)
                  : null}
                {#if timer}
                  <SessionBox
                    {session}
                    {timer}
                    timelineStart={dayTimelineStart}
                    timelineEnd={dayTimelineEnd}
                    timelineHeight={unifiedTimeline.timelineHeight}
                    selectedDate={dayData.day}
                    indentLevel={session.indentLevel}
                    edit={(s) => handleEditTimelog(s, dayData.day)}
                  />
                {/if}
              {/each}

              <!-- Empty state -->
              {#if dayData.sessions.length === 0 && dayData.multiDaySessions.length === 0 && dayData.holidays.length === 0}
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-xs text-gray-400 dark:text-gray-600">–</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <BottomNav currentTab="history" />
</div>

<!-- Timelog Form Modal -->
{#if showTimelogForm}
  <TimelogForm
    selectedDate={editingDate || dayjs()}
    existingLog={editingTimelog?.log}
    save={handleSaveTimelog}
    close={handleCloseForm}
    del={handleDelete}
  />
{/if}
