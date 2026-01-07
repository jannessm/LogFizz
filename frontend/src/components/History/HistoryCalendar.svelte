<script lang="ts">
  import { onMount } from 'svelte';
  import { holidaysStore } from '../../stores/holidays';
  import { dayjs, type TargetWithSpecs, type TimeLog, type Timer } from '../../types';
  import { getMultiDayRange, hasSpecialType, type CalendarTimeLogData } from '../../services/calendar';

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let {
    timers,
    timeLogs,
    calendarData,
    targets,
    onDateChange
  }: {
    timers: Timer[];
    timeLogs: TimeLog[];
    calendarData: CalendarTimeLogData;
    targets: TargetWithSpecs[];
    onDateChange?: (selectedDate: dayjs.Dayjs, currentMonth: dayjs.Dayjs) => void;
  } = $props();

  // Initialize from URL query parameters if available
  function getInitialDates() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    const monthParam = params.get('month');
    
    let selected = dayjs();
    let current = dayjs();
    
    if (dateParam) {
      const parsed = dayjs(dateParam);
      if (parsed.isValid()) {
        selected = parsed;
      }
    }
    
    if (monthParam) {
      const parsed = dayjs(monthParam);
      if (parsed.isValid()) {
        current = parsed;
      }
    } else if (dateParam) {
      // If no month param but date param exists, set current month to selected date's month
      current = selected.startOf('month');
    }
    
    return { selected, current };
  }

  const initialDates = getInitialDates();
  let selectedDate = $state(initialDates.selected); // actual selected date
  let currentMonth = $state(initialDates.current);  // month being viewed in calendar

  // Update URL when dates change
  function updateURL() {
    const params = new URLSearchParams();
    params.set('date', selectedDate.format('YYYY-MM-DD'));
    params.set('month', currentMonth.format('YYYY-MM'));
    
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }

  // Watch for date changes and update URL + notify parent
  $effect(() => {
    if (selectedDate && currentMonth) {
      updateURL();
      if (onDateChange) {
        onDateChange(selectedDate, currentMonth);
      }
    }
  });

  // Get unique state codes from all daily targets
  function getTargetCountries(): string[] {
    const countries: string[] = [];
    for (const t of targets) {
      for (const spec of t.target_specs || []) {
        if (spec.state_code) {
          countries.push(spec.state_code);
        }
      }
    }
    return Array.from(new Set(countries)); // Remove duplicates
  }

  let countries = $derived(getTargetCountries());

  // Sync holidays for all countries in targets
  async function syncHolidays() {
    const countryList = getTargetCountries();
    if (countryList.length === 0) {
      // Fallback to user's country from browser locale if no targets have state codes
      const locale = navigator.language || 'en-US';
      const country = locale.split('-')[1]?.toUpperCase() || 'US';
      countryList.push(country);
    }
    
    const year = currentMonth.year();
    await holidaysStore.fetchHolidaysForStates(countryList, year);
  }

  onMount(async () => {
    // Sync holidays for the initial month
    await syncHolidays();
  });

  // Sync holidays when the month/year changes
  $effect(() => {
    if (currentMonth) {
      syncHolidays();
    }
  });

  // Month navigation functions
  function previousMonth() {
    currentMonth = currentMonth.subtract(1, 'month');
  }

  function nextMonth() {
    currentMonth = currentMonth.add(1, 'month');
  }

  function goToToday() {
    currentMonth = dayjs();
    selectedDate = dayjs();
  }

  function changeMonth(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newMonth = parseInt(target.value);
    currentMonth = currentMonth.month(newMonth);
  }

  function changeYear(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newYear = parseInt(target.value);
    currentMonth = currentMonth.year(newYear);
  }

  // Generate month options (0-11 for dayjs)
  function getMonthOptions() {
    return [
      { value: 0, label: 'January' },
      { value: 1, label: 'February' },
      { value: 2, label: 'March' },
      { value: 3, label: 'April' },
      { value: 4, label: 'May' },
      { value: 5, label: 'June' },
      { value: 6, label: 'July' },
      { value: 7, label: 'August' },
      { value: 8, label: 'September' },
      { value: 9, label: 'October' },
      { value: 10, label: 'November' },
      { value: 11, label: 'December' }
    ];
  }

  // Generate year options (current year ± 5 years)
  function getYearOptions() {
    const currentYear = dayjs().year();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  }

  let monthOptions = $derived(getMonthOptions());
  let yearOptions = $derived(getYearOptions());

  function selectDate(date: dayjs.Dayjs) {
    selectedDate = date;
  }

  let calendarDays = $derived.by(() => {
    const firstDay = currentMonth.startOf('month');
    const firstDayOfWeek = firstDay.day();
    const startDate = firstDay.subtract(firstDayOfWeek, 'day');
    
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
    return hasSpecialType(date, timeLogsByDate, timeLogs);
  }

  // Check if date is within a multi-day timelog range - use pre-computed data
  function getMultiDayRangeForDate(date: dayjs.Dayjs) {
    const dateStr = date.format('YYYY-MM-DD');
    return multiDayRanges.get(dateStr) || {
      isInRange: false,
      isStart: false,
      isEnd: false,
      isMiddle: false,
      color: null,
    };
  }

  function isToday(date: dayjs.Dayjs): boolean {
    return date.isSame(dayjs(), 'day');
  }

  function isSelected(date: dayjs.Dayjs): boolean {
    return date.isSame(selectedDate, 'day');
  }

  function isCurrentMonth(date: dayjs.Dayjs): boolean {
    return date.isSame(currentMonth, 'month');
  }

  function isPublicHoliday(date: dayjs.Dayjs): boolean {
    if (countries.length === 0) return false;
    const dateStr = date.format('YYYY-MM-DD');
    // Check if it's a holiday in ANY of the configured countries
    const holiday = $holidaysStore.holidays.find(
      h => countries.includes(h.country) && h.date === dateStr
    );
    return !!holiday;
  }
</script>

<!-- Month Navigation -->
<div class="flex justify-between items-center mb-4">
  <div class="flex items-center gap-2">
    <button
      onclick={previousMonth}
      class="p-2 hover:bg-gray-200 rounded-lg transition-colors icon-[si--chevron-left-alt-duotone]"
      aria-label="Previous month"
    ></button>
    
    <!-- Month Dropdown -->
    <select
      onchange={changeMonth}
      value={currentMonth.month()}
      class="text-lg text-gray-800 bg-transparent border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Select month"
    >
      {#each monthOptions as month}
        <option value={month.value}>{month.label}</option>
      {/each}
    </select>
    
    <!-- Year Dropdown -->
    <select
      onchange={changeYear}
      value={currentMonth.year()}
      class="text-lg text-gray-800 bg-transparent border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Select year"
    >
      {#each yearOptions as year}
        <option value={year}>{year}</option>
      {/each}
    </select>
    
    <button
      onclick={nextMonth}
      class="p-2 hover:bg-gray-200 rounded-lg transition-colors icon-[si--chevron-right-alt-duotone]"
      aria-label="Next month"
    ></button>
    
    <!-- Today Button -->
    <button
      onclick={goToToday}
      class="px-3 py-1 text-sm font-medium text-white hover:bg-blue-600 rounded-lg transition-colors"
      class:bg-blue-500={!selectedDate.isSame(dayjs(), 'day')}
      class:bg-gray-300={selectedDate.isSame(dayjs(), 'day')}
      disabled={selectedDate.isSame(dayjs(), 'day')}
      aria-label="Go to today"
    >
      Today
    </button>
  </div>
</div>

<div class="bg-white rounded-lg shadow-md p-4 mb-6">

  <div>
    <!-- Calendar header (day names) -->
    <div class="grid gap-1 mb-2" style="grid-template-columns: 32px repeat(7, 1fr);">
      <div class="text-center text-xs font-semibold text-gray-500 py-2">
        
      </div>
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
        <div class="text-center text-xs font-semibold text-gray-600 py-2">
          {day}
        </div>
      {/each}
    </div>

    <!-- Calendar days with week numbers -->
    <div class="grid gap-x-1" style="grid-template-columns: 32px repeat(7, 1fr);">
      {#each Array(6) as _, weekIndex}
        <!-- Week number -->
        <div class="flex items-center justify-center text-xs font-medium text-gray-400 bg-gray-100">
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
        {@const isHoliday = isPublicHoliday(day)}
        <button
          onclick={() => selectDate(day)}
          class="relative w-full aspect-square flex flex-col items-center justify-center transition-all hover:scale-105 p-1"
          class:text-gray-400={!currentMonthDay}
          class:text-gray-800={currentMonthDay && !selected}
          class:text-white={selected}
          class:font-bold={today || selected}
        >
          <!-- Multi-day range indicator (rounded rectangle connecting days) -->
          {#if multiDayRange.isInRange && !today && !selected && multiDayRange.color}
            {#if multiDayRange.isStart && multiDayRange.isEnd}
              <!-- Single day range (shouldn't happen but handle it) -->
              <div 
                class="absolute inset-1 rounded-full border-2 opacity-30"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color};"
              ></div>
            {:else if multiDayRange.isStart}
              <!-- Start of range -->
              <div 
                class="absolute top-1 bottom-1 left-1 right-0 border-2 opacity-30 rounded-l-full"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color};"
              ></div>
            {:else if multiDayRange.isEnd}
              <!-- End of range -->
              <div 
                class="absolute top-1 bottom-1 left-0 right-1 border-2 opacity-30 rounded-r-full"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color};"
              ></div>
            {:else if multiDayRange.isMiddle}
              <!-- Middle of range -->
              <div 
                class="absolute top-1 bottom-1 left-0 right-0 border-2 opacity-30"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color}; border-radius: 0;"
              ></div>
            {/if}
          {/if}
          
          <!-- Holiday indicator (subtle purple background) -->
          {#if isHoliday && currentMonthDay && !selected}
            <div class="absolute inset-1 rounded-full bg-purple-100 border border-purple-300 opacity-50"></div>
          {/if}

          <!-- Today indicator (light blue circle behind) - FULL SIZE -->
          {#if today && !selected}
            <div class="absolute inset-0 rounded-full bg-blue-100 border-2 border-blue-300"></div>
          {/if}
          
          <!-- Special type indicator (colored circle behind, not today and not selected) - single day only -->
          {#if specialType.hasSpecial && !today && !selected && specialType.color}
            <div 
              class="absolute inset-1 rounded-full border-2 opacity-30"
              style="background-color: {specialType.color}; border-color: {specialType.color};"
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
          
          <!-- Activity dots -->
          {#if _timelogsColors && _timelogsColors.length > 0}
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
  <div class="mt-4 pt-4 border-t border-gray-200">
    <h4 class="text-xs font-semibold text-gray-600 mb-2">Legend</h4>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <!-- Type indicators -->
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-300 flex-shrink-0"></div>
        <span class="text-gray-600">Today</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-red-500 opacity-30 border-2 border-red-500 flex-shrink-0"></div>
        <span class="text-gray-600">Sick</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-green-500 opacity-30 border-2 border-green-500 flex-shrink-0"></div>
        <span class="text-gray-600">Holiday</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-amber-500 opacity-30 border-2 border-amber-500 flex-shrink-0"></div>
        <span class="text-gray-600">Business Trip</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded-full bg-pink-500 opacity-30 border-2 border-pink-500 flex-shrink-0"></div>
        <span class="text-gray-600">Child Sick</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex gap-0.5 w-4 justify-center items-center flex-shrink-0">
          <div class="w-1 h-1 rounded-full bg-blue-600"></div>
          <div class="w-1 h-1 rounded-full bg-green-600"></div>
          <div class="w-1 h-1 rounded-full bg-purple-600"></div>
        </div>
        <span class="text-gray-600">Activity dots (timers)</span>
      </div>
    </div>
  </div>
</div>
