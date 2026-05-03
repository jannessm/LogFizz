<script lang="ts">
  import { dayjs, type TimeLog, userTimezone } from '../../types';
  import { hasSpecialType, loadCalendarMonth, type CalendarTimeLogData } from '../../services/calendar';
  import { onMount, onDestroy } from 'svelte';
  import { _, locale } from '../../lib/i18n';
  import { getDayAbbreviation } from '../../lib/dateFormatting';
  import { userSettingsStore } from '../../stores/userSettings';

  let {
    timeLogs,
    calendarData,
    selectedDate = $bindable(),
  }: {
    timeLogs: TimeLog[];
    calendarData: CalendarTimeLogData;
    selectedDate: { date: dayjs.Dayjs; month: dayjs.Dayjs };
  } = $props();


  // Update URL when dates change
  function updateURL() {
    const params = new URLSearchParams();
    params.set('date', selectedDate.date.format('YYYY-MM-DD'));
    params.set('month', selectedDate.month.format('YYYY-MM'));
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }

  // Watch for date changes and update URL (parent is responsible for loading data)
  $effect(() => {
    if (selectedDate.date && selectedDate.month) {
      updateURL();
    }
  });

  // Month navigation functions
  function previousMonth() {
    selectedDate.month = selectedDate.month.subtract(1, 'month');
  }

  function nextMonth() {
    selectedDate.month = selectedDate.month.add(1, 'month');
  }

  function goToToday() {
    selectedDate.date = dayjs();
    selectedDate.month = dayjs();
  }

  function changeMonth(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newMonth = parseInt(target.value);
    selectedDate.month = selectedDate.month.month(newMonth);
  }

  function changeYear(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newYear = parseInt(target.value);
    selectedDate.month = selectedDate.month.year(newYear);
  }

  // Generate month options (0-11 for dayjs) with locale-aware names
  const monthOptions = $derived(
    Array.from({ length: 12 }, (_, i) => ({
      value: i,
      label: dayjs().month(i).format('MMMM')
    }))
  );

  // Generate year options (current year ± 5 years)
  function getYearOptions() {
    const currentYear = dayjs().year();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  }

  let yearOptions = $derived(getYearOptions());

  function selectDate(date: dayjs.Dayjs) {
    selectedDate.date = date;
  }

  function navigateDate(days: number) {
    const newDate = selectedDate.date.add(days, 'day');
    selectedDate.date = newDate;
    // Auto-switch month when crossing month boundaries
    if (!newDate.isSame(selectedDate.month, 'month')) {
      selectedDate.month = newDate.startOf('month');
    }
  }

  let calendarEl = $state<HTMLElement | null>(null);

  function handleKeydown(e: KeyboardEvent) {
    // Don't intercept if a select/input element is focused
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Only respond when this calendar instance is actually visible in the DOM
    if (!calendarEl || calendarEl.offsetParent === null) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigateDate(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateDate(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateDate(-7);
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateDate(7);
        break;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  let firstDayOfWeek = $derived<'sunday' | 'monday'>(
    ($userSettingsStore.settings?.first_day_of_week as 'sunday' | 'monday') || 'sunday'
  );
  
  // Get language-aware day names based on first day of week setting
  // Uses language setting (en/de) instead of locale (en-US/en-GB/de-DE)
  let dayNames = $derived(
    firstDayOfWeek === 'monday'
      ? Array.from({ length: 7 }, (_, i) => getDayAbbreviation((i + 1) % 7))
      : Array.from({ length: 7 }, (_, i) => getDayAbbreviation(i))
  );
  
  let calendarDays = $derived.by(() => {
    const firstDay = selectedDate.month.startOf('month');

    // Evaluate day-of-week in local timezone — dayjs.tz.setDefault('UTC') is set
    // globally, so firstDay.day() would return the UTC weekday which can be off by
    // one for users east/west of UTC, causing the grid to start on the wrong column.
    let firstDayOfWeekNum: number = firstDay.tz(userTimezone).day();
    
    // Adjust for Monday as first day of week
    if (firstDayOfWeek === 'monday') {
      // Convert Sunday (0) to 6, and shift everything else down by 1
      firstDayOfWeekNum = firstDayOfWeekNum === 0 ? 6 : firstDayOfWeekNum - 1;
    }
    
    // Calculate how many days to show before the first of the month
    const startDate = firstDay.subtract(firstDayOfWeekNum, 'day');
    
    const days = [];
    let current = startDate;
    
    for (let i = 0; i < 42; i++) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  });

  let weekNumbers = $derived.by(() => {
    const weeks = [];
    for (let i = 0; i < 42; i += 7) {
      weeks.push(calendarDays[i].week());
    }
    return weeks;
  });

  // Use the pre-computed data from calendar service
  let timeLogsByDate = $derived(calendarData.timeLogsByDate);
  let dotColors = $derived(calendarData.dotColors);
  let multiDayRanges = $derived(calendarData.multiDayRanges);
  
  // Check if date has any special type timelogs (non-normal) - single day only
  function hasSpecialTypeForDate(date: dayjs.Dayjs): { hasSpecial: boolean; color: string | null } {
    return hasSpecialType(date, timeLogsByDate, timeLogs, getMultiDayRangeForDate(date));
  }

  // Check if date is within a multi-day timelog range - use pre-computed data
  function getMultiDayRangeForDate(date: dayjs.Dayjs) {
    const dateStr = date.format('YYYY-MM-DD');
    const info = multiDayRanges.get(dateStr) || {
      isInRange: false,
      isStart: false,
      isEnd: false,
      isMiddle: false,
      colors: [],
    };
    return info;
  }

  /**
   * Create a gradient CSS string from an array of colors
   */
  function createGradient(colors: string[]): string {
    if (colors.length === 0) return '';
    if (colors.length === 1) return colors[0];
    
    // Create a linear gradient with equal distribution
    const stops = colors.map((color, index) => {
      const percentage = (index / (colors.length - 1)) * 100;
      return `${color} ${percentage}%`;
    }).join(', ');
    
    return `linear-gradient(to right bottom, ${stops})`;
  }

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  function isSelected(date: dayjs.Dayjs): boolean {
    return date.isSame(selectedDate.date, 'day');
  }

  function isCurrentMonth(date: dayjs.Dayjs): boolean {
    return date.isSame(selectedDate.month, 'month');
  }

  /**
   * Get the name of the public holiday for a date if it affects balance calculations.
   * Returns null if not a relevant holiday.
   */
  function getPublicHolidayName(date: dayjs.Dayjs): string | null {
    const dateStr = date.format('YYYY-MM-DD');
    const holidays = calendarData.relevantHolidays.get(dateStr);
    if (!holidays || holidays.length === 0) return null;
    const h = holidays[0];
    return $locale === 'de' && h.localName ? h.localName : h.name;
  }
</script>

<div bind:this={calendarEl}>
<!-- Month Navigation -->
<div class="flex justify-between items-center mb-4">
  <div class="flex items-center gap-2">
    <button
      onclick={previousMonth}
      class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--chevron-left-alt-duotone] text-gray-600 dark:text-gray-400"
      aria-label={$_('history.previousMonth')}
    ></button>
    
    <!-- Month Dropdown -->
    <select
      onchange={changeMonth}
      value={selectedDate.month.month()}
      class="text-lg text-gray-800 dark:text-gray-100 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={$_('history.selectMonth')}
    >
      {#each monthOptions as month}
        <option value={month.value}>{month.label}</option>
      {/each}
    </select>
    
    <!-- Year Dropdown -->
    <select
      onchange={changeYear}
      value={selectedDate.month.year()}
      class="text-lg text-gray-800 dark:text-gray-100 bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={$_('history.selectYear')}
    >
      {#each yearOptions as year}
        <option value={year}>{year}</option>
      {/each}
    </select>
    
    <button
      onclick={nextMonth}
      class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors icon-[si--chevron-right-alt-duotone] text-gray-600 dark:text-gray-400"
      aria-label={$_('history.nextMonth')}
    ></button>
    
    <!-- Today Button -->
    <button
      onclick={goToToday}
      class="px-3 py-1 text-sm font-medium text-white hover:bg-primary-hover rounded-lg transition-colors"
      class:bg-primary={!selectedDate.date.isSame(dayjs(), 'day')}
      class:bg-gray-300={selectedDate.date.isSame(dayjs(), 'day')}
      class:dark:bg-gray-600={selectedDate.date.isSame(dayjs(), 'day')}
      disabled={selectedDate.date.isSame(dayjs(), 'day')}
      aria-label={$_('history.goToToday')}
    >
      {$_('history.today')}
    </button>
  </div>
</div>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">

  <div>
    <!-- Calendar header (day names) -->
    <div class="grid gap-1 mb-2" style="grid-template-columns: 32px repeat(7, 1fr);">
      <div class="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2">
        
      </div>
      {#each dayNames as day}
        <div class="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-2">
          {day}
        </div>
      {/each}
    </div>

    <!-- Calendar days with week numbers -->
    <div class="grid gap-x-1" style="grid-template-columns: 32px repeat(7, 1fr);">
      {#each Array(6) as _, weekIndex}
        <!-- Week number -->
        <div class="flex items-center justify-center text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700">
          {weekNumbers[weekIndex]}
        </div>
        
        <!-- Days of the week -->
        {#each calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7) as day}
        {@const _timelogsColors = dotColors.get(day.format('YYYY-MM-DD')) || []}
        {@const today = isToday(day)}
        {@const selected = isSelected(day)}
        {@const currentMonthDay = isCurrentMonth(day)}
        {@const specialType = hasSpecialTypeForDate(day)}
        {@const multiDayRange = getMultiDayRangeForDate(day)}
        {@const holidayName = getPublicHolidayName(day)}
        {@const isHoliday = holidayName !== null}
        {@const gradient = createGradient(multiDayRange.colors)}
        <button
          onclick={() => selectDate(day)}
          class="relative w-full aspect-square flex flex-col items-center justify-center transition-all hover:scale-105 p-1
            {selected ? 'text-white font-bold' : ''}
            {!selected && !currentMonthDay ? 'text-gray-400 dark:text-gray-600' : ''}
            {!selected && currentMonthDay ? 'text-gray-800 dark:text-gray-200' : ''}
            {!selected && today ? 'font-bold' : ''}"
          title={holidayName || ''}
        >
          <!-- Multi-day range indicator (rounded rectangle connecting days with gradient) -->
          {#if multiDayRange.isInRange && !today && !selected && multiDayRange.colors.length > 0}
            {#if multiDayRange.isStart}
              <!-- Start of range -->
              <div 
                class="absolute top-1 bottom-1 left-1 right-0 opacity-30 rounded-l-full"
                class:border-2={isHoliday}
                class:border-purple-500={isHoliday}
                style="background: {gradient};"

              ></div>
            {:else if multiDayRange.isEnd}
              <!-- End of range -->
              <div 
                class="absolute top-1 bottom-1 left-0 right-1 opacity-30 rounded-r-full"
                class:border-2={isHoliday}
                class:border-purple-500={isHoliday}
                style="background: {gradient};"
              ></div>
            {:else if multiDayRange.isMiddle}
              <!-- Middle of range (including overlaps) -->
              <div 
                class="absolute top-1 bottom-1 left-0 right-0 opacity-30"
                class:border-2={isHoliday}
                class:border-purple-500={isHoliday}
                style="background: {gradient}; border-radius: 0;"
              ></div>
            {/if}
          {/if}
          
          <!-- Holiday indicator (purple border only, when no other circle present) -->
          {#if isHoliday && currentMonthDay && !selected && !multiDayRange.isInRange && !specialType.hasSpecial}
            <div class="absolute inset-1 rounded-full border-2 border-purple-500"></div>
          {/if}

          <!-- Today indicator (light blue circle behind) - FULL SIZE -->
          {#if today && !selected}
            <div class="absolute inset-0 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-blue-300 dark:border-blue-500"></div>
          {/if}
          
          <!-- Special type indicator (colored circle behind, not today and not selected) - single day only -->
          {#if specialType.hasSpecial && !today && !selected && specialType.color}
            <div 
              class="absolute inset-1 rounded-full opacity-30"
              class:border-2={isHoliday}
              class:border-purple-500={isHoliday}
              style="background-color: {specialType.color};"
            ></div>
          {/if}
          
          <!-- Selected indicator (solid blue circle) -->
          {#if selected}
            <div class="absolute inset-0 rounded-full bg-blue-600 shadow-lg"></div>
          {/if}
          
          <!-- Date number -->
          <span class="relative text-sm z-10">
            {day.format('D')}
          </span>
          
          <!-- Activity dots - only show if no circle indicator present -->
          {#if _timelogsColors && _timelogsColors.length > 0 && !today && !selected}
            <div class="relative flex gap-0.5 z-10">
              {#each _timelogsColors as color}
                <div 
                  class="w-1 h-1 rounded-full"
                  style="background-color: {color};"
                ></div>
              {/each}
            </div>
          {/if}
        </button>
        {/each}
      {/each}
    </div>
  </div>

  <!-- Legend -->
  <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
    <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">{$_('history.legend')}</h4>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <!-- Type indicators -->
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-blue-300 dark:border-blue-600 flex-shrink-0"></div>
        <span class="text-gray-600 dark:text-gray-400">{$_('history.today')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full border-2 border-purple-500 flex-shrink-0"></div>
        <span class="text-gray-600 dark:text-gray-400">{$_('history.publicHoliday')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-cyan-500 opacity-30 border-2 border-cyan-500 flex-shrink-0"></div>
        <span class="text-gray-600 dark:text-gray-400">{$_('timelog.typeHomeoffice')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-red-500 opacity-30 border-2 border-red-500 flex-shrink-0"></div>
        <span class="text-gray-600 dark:text-gray-400">{$_('timelog.typeSick')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-green-500 opacity-30 border-2 border-green-500 flex-shrink-0"></div>
        <span class="text-gray-600 dark:text-gray-400">{$_('history.holidayPTO')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-amber-500 opacity-30 border-2 border-amber-500 flex-shrink-0"></div>
        <span class="text-gray-600 dark:text-gray-400">{$_('timelog.typeBusinessTrip')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-pink-500 opacity-30 border-2 border-pink-500 flex-shrink-0"></div>
        <span class="text-gray-600 dark:text-gray-400">{$_('timelog.typeChildSick')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex gap-0.5 w-4 justify-center items-center flex-shrink-0">
          <div class="w-1 h-1 rounded-full bg-blue-600"></div>
          <div class="w-1 h-1 rounded-full bg-green-600"></div>
          <div class="w-1 h-1 rounded-full bg-purple-600"></div>
        </div>
        <span class="text-gray-600 dark:text-gray-400">{$_('history.loggedTimers')}</span>
      </div>
    </div>
  </div>
</div>
</div>
