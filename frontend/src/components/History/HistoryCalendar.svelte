<script lang="ts">
  import dayjs from 'dayjs';
  import weekOfYear from 'dayjs/plugin/weekOfYear';
  import utc from 'dayjs/plugin/utc';
  import timezone from 'dayjs/plugin/timezone';
  import { holidaysStore } from '../../stores/holidays';

  dayjs.extend(weekOfYear);
  dayjs.extend(utc);
  dayjs.extend(timezone);

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let { currentMonth, selectedDate, buttons, timeLogs, onSelectDate, countries = [] }: {
    currentMonth: dayjs.Dayjs;
    selectedDate: dayjs.Dayjs;
    buttons: any[];
    timeLogs: any[];
    onSelectDate: (date: dayjs.Dayjs) => void;
    countries: string[];
  } = $props();

  let calendarDays: dayjs.Dayjs[];
  let weekNumbers: number[];
  let buttonColors: Map<string, string[]> = new Map();

  // Get calendar days for current month - ensure we have exactly 6 weeks (42 days)
  function getCalendarDays() {
    const firstDay = currentMonth.startOf('month');

    // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.day();
    
    // Calculate how many days to show before the first of the month
    const startDate = firstDay.subtract(firstDayOfWeek, 'day');
    
    // Always show 6 weeks (42 days) for consistent layout
    const days = [];
    let current = startDate;
    
    for (let i = 0; i < 42; i++) {
      days.push(current);
      current = current.add(1, 'day');
    }
    
    return days;
  }

  // Get week numbers for the calendar (6 weeks)
  function getWeekNumbers() {
    const weeks = [];
    const days = getCalendarDays();
    
    // Get week number for the first day of each week (every 7 days)
    for (let i = 0; i < 42; i += 7) {
      weeks.push(days[i].week());
    }
    
    return weeks;
  }

  $effect(() => {
    if (currentMonth && selectedDate) {
      calendarDays = getCalendarDays();
      weekNumbers = getWeekNumbers();
    }
    if (timeLogs.length > 0) {
      buttonColors = getButtonColorsMap();
    }
  });

  function getButtonColorsMap(): Map<string, string[]> {
    const colorMap = new Map<string, string[]>();
    for (const day of calendarDays) {
      const colors = getButtonColorsForDate(day);
      colorMap.set(day.format('YYYY-MM-DD'), colors); 
    }
    return colorMap;
  }

  // Get timelog type colors
  function getTypeColor(type: string): string | null {
    switch(type) {
      case 'sick': return '#EF4444'; // Red
      case 'holiday': return '#10B981'; // Green
      case 'business-trip': return '#F59E0B'; // Orange/Amber
      case 'child-sick': return '#EC4899'; // Pink
      case 'normal':
      default: return null; // null means use button color
    }
  }

  // Get button colors for date (for dots display)
  // Always use button colors for dots
  function getButtonColorsForDate(date: dayjs.Dayjs): string[] {
    const dateStr = date.format('YYYY-MM-DD');
    const dateTimeLogs = timeLogs.filter(tl => {
      if (!tl.start_timestamp) return false;
      
      // Convert UTC timestamp to user's timezone for comparison
      const logTimezone = tl.timezone || userTimezone;
      const logDate = dayjs.utc(tl.start_timestamp).tz(logTimezone);
      return logDate.format('YYYY-MM-DD') === dateStr;
    });
    
    // Group by button and use button colors
    const colorMap = new Map<string, string>();
    
    for (const tl of dateTimeLogs) {
      if (!colorMap.has(tl.timer_id)) {
        const button = buttons.find(b => b.id === tl.timer_id);
        colorMap.set(tl.timer_id, button?.color || '#3B82F6');
      }
    }
    
    return Array.from(colorMap.values()).slice(0, 3);
  }

  // Check if date is within a multi-day timelog range
  function getMultiDayRange(date: dayjs.Dayjs): { 
    isInRange: boolean; 
    isStart: boolean; 
    isEnd: boolean; 
    color: string | null;
    isMiddle: boolean;
  } {
    const dateStr = date.format('YYYY-MM-DD');
    
    for (const tl of timeLogs) {
      if (!tl.type || tl.type === 'normal') continue;
      if (!tl.start_timestamp || !tl.end_timestamp) continue;
      
      // Convert timestamps to user's timezone
      const logTimezone = tl.timezone || userTimezone;
      const start = dayjs.utc(tl.start_timestamp).tz(logTimezone);
      const end = dayjs.utc(tl.end_timestamp).tz(logTimezone);
      
      // Check if this is a multi-day log (more than 1 day)
      const daysDiff = end.diff(start, 'day');
      if (daysDiff >= 1) {
        const current = date.startOf('day');
        const rangeStart = start.startOf('day');
        const rangeEnd = end.startOf('day');
        
        if (current.isSame(rangeStart, 'day')) {
          return { 
            isInRange: true, 
            isStart: true, 
            isEnd: false, 
            isMiddle: false,
            color: getTypeColor(tl.type) 
          };
        } else if (current.isSame(rangeEnd, 'day')) {
          return { 
            isInRange: true, 
            isStart: false, 
            isEnd: true,
            isMiddle: false, 
            color: getTypeColor(tl.type) 
          };
        } else if (current.isAfter(rangeStart) && current.isBefore(rangeEnd)) {
          return { 
            isInRange: true, 
            isStart: false, 
            isEnd: false,
            isMiddle: true, 
            color: getTypeColor(tl.type) 
          };
        }
      }
    }
    
    return { isInRange: false, isStart: false, isEnd: false, isMiddle: false, color: null };
  }

  // Check if date has any special type timelogs (non-normal) - single day only
  function hasSpecialType(date: dayjs.Dayjs): { hasSpecial: boolean; color: string | null } {
    // First check if it's part of a multi-day range
    const multiDay = getMultiDayRange(date);
    if (multiDay.isInRange) {
      return { hasSpecial: false, color: null }; // Will be handled by range display
    }
    
    const dateStr = date.format('YYYY-MM-DD');
    const dateTimeLogs = timeLogs.filter(tl => {
      if (!tl.start_timestamp) return false;
      
      // Convert UTC timestamp to user's timezone for comparison
      const logTimezone = tl.timezone || userTimezone;
      const logDate = dayjs.utc(tl.start_timestamp).tz(logTimezone);
      return logDate.format('YYYY-MM-DD') === dateStr;
    });
    
    for (const tl of dateTimeLogs) {
      if (tl.type && tl.type !== 'normal') {
        // Make sure it's not a multi-day log
        if (tl.end_timestamp) {
          const logTimezone = tl.timezone || userTimezone;
          const start = dayjs.utc(tl.start_timestamp).tz(logTimezone);
          const end = dayjs.utc(tl.end_timestamp).tz(logTimezone);
          const daysDiff = end.diff(start, 'day');
          if (daysDiff < 1) {
            return { hasSpecial: true, color: getTypeColor(tl.type) };
          }
        }
      }
    }
    
    return { hasSpecial: false, color: null };
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
        {@const _buttonColors = buttonColors.get(day.format('YYYY-MM-DD')) || []}
        {@const today = isToday(day)}
        {@const selected = isSelected(day)}
        {@const currentMonthDay = isCurrentMonth(day)}
        {@const specialType = hasSpecialType(day)}
        {@const multiDayRange = getMultiDayRange(day)}
        {@const isHoliday = isPublicHoliday(day)}
        <button
          onclick={() => onSelectDate(day)}
          class="relative w-full aspect-square flex flex-col items-center justify-center transition-all hover:scale-105 py-1"
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
                class="absolute inset-0 rounded-full border-2 opacity-30"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color};"
              ></div>
            {:else if multiDayRange.isStart}
              <!-- Start of range -->
              <div 
                class="absolute inset-y-0 left-0 right-0 border-2 opacity-30 rounded-l-full"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color};"
              ></div>
            {:else if multiDayRange.isEnd}
              <!-- End of range -->
              <div 
                class="absolute inset-y-0 left-0 right-0 border-2 opacity-30 rounded-r-full"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color};"
              ></div>
            {:else if multiDayRange.isMiddle}
              <!-- Middle of range -->
              <div 
                class="absolute inset-y-0 left-0 right-0 border-2 opacity-30"
                style="background-color: {multiDayRange.color}; border-color: {multiDayRange.color}; border-radius: 0;"
              ></div>
            {/if}
          {/if}
          
          <!-- Holiday indicator (subtle purple background) -->
          {#if isHoliday && currentMonthDay && !selected}
            <div class="absolute inset-0 rounded-full bg-purple-100 border border-purple-300 opacity-50"></div>
          {/if}

          <!-- Today indicator (light blue circle behind) -->
          {#if today && !selected}
            <div class="absolute inset-0 rounded-full bg-blue-100 border-2 border-blue-300"></div>
          {/if}
          
          <!-- Special type indicator (colored circle behind, not today and not selected) - single day only -->
          {#if specialType.hasSpecial && !today && !selected && specialType.color}
            <div 
              class="absolute inset-0 rounded-full border-2 opacity-30"
              style="background-color: {specialType.color}; border-color: {specialType.color};"
            ></div>
          {/if}
          
          <!-- Selected indicator (solid blue circle) -->
          {#if selected}
            <div class="absolute inset-0 rounded-full bg-blue-600 shadow-lg"></div>
          {/if}
          
          <!-- Date number -->
          <span class="relative text-sm z-10 mb-1">
            {day.format('D')}
          </span>
          
          <!-- Activity dots -->
          {#if _buttonColors && _buttonColors.length > 0}
            <div class="relative flex gap-0.5 z-10">
              {#each _buttonColors as color}
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
        <span class="text-gray-600">Activity dots (buttons)</span>
      </div>
    </div>
  </div>
</div>
