<script lang="ts">
  import dayjs from 'dayjs';
  import { formatMinutesCompact as formatMinutes } from '../../../../lib/utils/timeFormat.js';
  export let session: any;
  export let button: any;
  // timeline bounds provided by parent so the component can calculate its own position
  export let timelineStart: any = null;
  export let timelineEnd: any = null;
  export let timelineHeight: number = 400;
  export let onEdit: (s: any) => void = () => {};
  export let indentLevel: number = 0;

  // computed style for absolute positioning within the timeline
  let style = '';

  function computeStyle() {
    if (!timelineStart || !timelineEnd) return '';

    const start = dayjs(session.startTime);
    const end = session.endTime ? dayjs(session.endTime) : dayjs();

    const totalMinutes = timelineEnd.diff(timelineStart, 'minute');
    if (!totalMinutes || totalMinutes <= 0) return '';

    const startOffset = start.diff(timelineStart, 'minute');
    const duration = end.diff(start, 'minute');

    const topPercent = (startOffset / totalMinutes) * 90;
    const heightPercent = (duration / totalMinutes) * 90;

    // Ensure minimum height of 60px for very short entries
    const minHeightPercent = (60 / timelineHeight) * 90; // 60px min height relative to timelineHeight
    const finalHeightPercent = Math.max(heightPercent, minHeightPercent);

    const color = button?.color || '#3B82F6';

    const leftPx = Math.max(0, indentLevel) * 60; // 60px per indent level
    // Keep a small right offset so boxes don't overflow fully to the right
    const rightPx = 12;

    return `top: ${topPercent}%; height: ${finalHeightPercent}%; min-height: 60px; background-color: ${color}; margin-top: 12px; left: ${leftPx}px; right: ${rightPx}px;`;
  }

  $: if (style || timelineStart || timelineEnd) style = computeStyle();

  function handleClick() {
    onEdit(session);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') onEdit(session);
  }
</script>

<div
  class="absolute left-2 right-2 rounded-lg p-2 cursor-pointer transition-all hover:shadow-lg group"
  style={style}
  on:click={handleClick}
  on:keydown={handleKeydown}
  role="button"
  tabindex="0"
>
  <div class="flex items-start justify-between gap-2 h-full">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1 text-white font-medium text-sm">
        {#if button.emoji}
          <span>{button.emoji}</span>
        {/if}
        <span class="truncate">{button.name}
          {#if session.duration}
            <span class="font-semibold">({formatMinutes(session.duration)})</span>
          {/if}
        </span>
      </div>
      <div class="text-xs text-white opacity-90 mt-1">
        {dayjs(session.startTime).format('HH:mm')}
        {#if session.endTime}
          - {dayjs(session.endTime).format('HH:mm')}
        {:else}
          - Running
        {/if}
      </div>
    </div>

    <!-- Action buttons (visible on hover) -->
    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        on:click|stopPropagation={() => onEdit(session)}
        class="p-1 bg-white rounded icon-[si--edit-detailed-duotone] text-white"
        style="width: 20px; height: 20px;"
        aria-label="Edit entry"
      ></button>
    </div>
  </div>
</div>
