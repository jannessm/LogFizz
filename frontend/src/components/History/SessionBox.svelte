<script lang="ts">
  import { dayjs } from '../../types';
  import { formatMinutesCompact as formatMinutes } from '../../../../lib/utils/timeFormat.js';
  import type { Timer } from '../../../../lib/types';
  import type { Session } from '../../lib/utils/computeIndentation';

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let {
    session,
    timer,
    timelineStart = null,
    timelineEnd = null,
    timelineHeight = 400,
    edit,
    indentLevel = 0,
    selectedDate = null
  }: {
    session: Session;
    timer: Timer;
    timelineStart?: dayjs.Dayjs | null;
    timelineEnd?: dayjs.Dayjs | null;
    timelineHeight?: number;
    edit?: (s: Session) => void;
    indentLevel?: number;
    selectedDate?: dayjs.Dayjs | null;
  } = $props();

  // computed style for absolute positioning within the timeline
  let style = $state('');

  // Get log timezone and check if it differs from user timezone
  let logTimezone = $derived(session.log?.timezone || userTimezone);
  let isDifferentTimezone = $derived(logTimezone !== userTimezone);

  // Determine if session is clipped at start or end
  let isClippedAtStart = $derived(() => {
    if (!selectedDate) return false;
    const dayStart = selectedDate.startOf('day');
    const sessionStart = dayjs(session.startTime);
    return sessionStart.isBefore(dayStart);
  });

  let isClippedAtEnd = $derived(() => {
    if (!selectedDate || !session.endTime) return false;
    const dayEnd = selectedDate.endOf('day');
    const sessionEnd = dayjs(session.endTime);
    return sessionEnd.isAfter(dayEnd);
  });

  // Get display times (clipped to day boundaries)
  let displayStart = $derived(() => {
    if (!selectedDate) return dayjs(session.startTime);
    const dayStart = selectedDate.startOf('day');
    const sessionStart = dayjs(session.startTime);
    return sessionStart.isBefore(dayStart) ? dayStart : sessionStart;
  });

  let displayEnd = $derived(() => {
    if (!selectedDate) {
      return session.endTime ? dayjs(session.endTime) : dayjs();
    }
    const dayEnd = selectedDate.endOf('day');
    const sessionEnd = session.endTime ? dayjs(session.endTime) : dayjs();
    return sessionEnd.isAfter(dayEnd) ? dayEnd : sessionEnd;
  });

  function computeStyle() {
    if (!timelineStart || !timelineEnd) return '';

    const start = displayStart();
    const end = displayEnd();

    const totalMinutes = timelineEnd.diff(timelineStart, 'minute');
    if (!totalMinutes || totalMinutes <= 0) return '';

    const startOffset = start.diff(timelineStart, 'minute');
    const duration = end.diff(start, 'minute');

    const topPercent = (startOffset / totalMinutes) * 90;
    const heightPercent = (duration / totalMinutes) * 90;

    // Ensure minimum height of 60px for very short entries
    const minHeightPercent = (60 / timelineHeight) * 90; // 60px min height relative to timelineHeight
    const finalHeightPercent = Math.max(heightPercent, minHeightPercent);

    const color = timer?.color || '#3B82F6';

    const leftPx = Math.max(0, indentLevel) * 60; // 60px per indent level
    // Keep a small right offset so boxes don't overflow fully to the right
    const rightPx = 12;

    return `top: ${topPercent}%; height: ${finalHeightPercent}%; min-height: 60px; background-color: ${color}; margin-top: 12px; left: ${leftPx}px; right: ${rightPx}px;`;
  }

  $effect(() => {
    style = computeStyle();
  });

  function handleClick() {
    if (edit) edit(session);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && edit) edit(session);
  }
</script>

<div
  class="absolute left-2 right-2 rounded-lg p-2 cursor-pointer transition-all hover:shadow-lg group"
  style={style}
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="button"
  tabindex="0"
>
  <div class="flex items-start justify-between gap-2 h-full">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1 text-white font-medium text-sm">
        {#if timer.emoji}
          <span>{timer.emoji}</span>
        {/if}
        <span class="truncate">{timer.name}
          {#if session.duration}
            <span class="font-semibold">({formatMinutes(session.duration)})</span>
          {/if}
        </span>
      </div>
      <div class="text-xs text-white opacity-90 mt-1">
        {#if isClippedAtStart()}
          {displayStart().format('LL LT')}
        {:else}
          {displayStart().format('LT')}
        {/if}
        {#if session.endTime}
          - 
          {#if isClippedAtEnd()}
            {displayEnd().format('LL LT')}
          {:else}
            {displayEnd().format('LT')}
          {/if}
        {:else}
          - Running
        {/if}
        {#if isDifferentTimezone}
          <span class="text-xs opacity-75 ml-1">({logTimezone})</span>
        {/if}
      </div>
    </div>

    <!-- Action buttons (visible on hover) -->
    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onclick={(e) => {e.stopPropagation(); edit?.(session);}}
        class="p-1 bg-white rounded icon-[si--edit-detailed-duotone] text-white"
        style="width: 20px; height: 20px;"
        aria-label="Edit entry"
      ></button>
    </div>
  </div>
</div>
