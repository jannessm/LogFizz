<script lang="ts">
  import dayjs from 'dayjs';
  import weekOfYear from 'dayjs/plugin/weekOfYear';

  dayjs.extend(weekOfYear);

  export let currentMonth: dayjs.Dayjs;
  export let selectedDate: dayjs.Dayjs;
  export let buttons: any[];
  export let timeLogs: any[];
  export let onSelectDate: (date: dayjs.Dayjs) => void;
  export let slideDirection: 'left' | 'right' | null = null;

  // Get calendar days for current month - ensure we have exactly 6 weeks (42 days)
  function getCalendarDays() {
    const firstDay = currentMonth.startOf('month');
    const lastDay = currentMonth.endOf('month');
    
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

  $: calendarDays = getCalendarDays();
  $: weekNumbers = getWeekNumbers();

  // Get button activities for a specific date
  function getButtonsForDate(date: dayjs.Dayjs) {
    const dateStr = date.format('YYYY-MM-DD');
    const buttonIds = new Set(
      timeLogs
        .filter(tl => tl.timestamp && tl.timestamp.startsWith(dateStr))
        .map(tl => tl.button_id)
    );
    return buttons.filter(b => buttonIds.has(b.id));
  }

  // Get button colors for date (for dots display)
  function getButtonColorsForDate(date: dayjs.Dayjs): string[] {
    const dateButtons = getButtonsForDate(date);
    return dateButtons.slice(0, 3).map(b => b.color || '#3B82F6');
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
</script>

<div class="bg-white rounded-lg shadow-md p-4 mb-6 overflow-hidden">
  <div class="transition-transform duration-300"
       class:translate-x-full={slideDirection === 'left'}
       class:-translate-x-full={slideDirection === 'right'}>
    <!-- Calendar header (day names) -->
    <div class="grid gap-1 mb-2" style="grid-template-columns: 32px repeat(7, 1fr);">
      <div class="text-center text-xs font-semibold text-gray-500 py-2">
        Wk
      </div>
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
        <div class="text-center text-xs font-semibold text-gray-600 py-2">
          {day}
        </div>
      {/each}
    </div>

    <!-- Calendar days with week numbers -->
    <div class="grid gap-1" style="grid-template-columns: 32px repeat(7, 1fr);">
      {#each Array(6) as _, weekIndex}
        <!-- Week number -->
        <div class="flex items-center justify-center text-xs font-medium text-gray-500">
          {weekNumbers[weekIndex]}
        </div>
        
        <!-- Days of the week -->
        {#each calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7) as day}
        {@const buttonColors = getButtonColorsForDate(day)}
        {@const today = isToday(day)}
        {@const selected = isSelected(day)}
        {@const currentMonthDay = isCurrentMonth(day)}
        <button
          on:click={() => onSelectDate(day)}
          class="relative w-full aspect-square flex flex-col items-center justify-center transition-all hover:scale-105 py-1"
          class:text-gray-400={!currentMonthDay}
          class:text-gray-800={currentMonthDay && !selected}
          class:text-white={selected}
          class:font-bold={today || selected}
        >
          <!-- Today indicator (light blue circle behind) -->
          {#if today && !selected}
            <div class="absolute inset-1 rounded-full bg-blue-100 border-2 border-blue-300"></div>
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
          {#if buttonColors.length > 0}
            <div class="relative flex gap-0.5 z-10">
              {#each buttonColors as color}
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
</div>
