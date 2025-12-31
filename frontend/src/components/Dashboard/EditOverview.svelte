<script lang="ts">
  import { timersStore } from '../../stores/timers';
  import { targetsStore } from '../../stores/targets';
  import { timeLogsStore } from '../../stores/timelogs';
  import type { Timer, TargetWithSpecs } from '../../types';
  import { getActiveTargetSpec, isTargetEnded, getWeekdayNames } from '../../lib/utils/targetSpec';
  import { dayjs } from '../../types';

  let {
    editTimer,
    editTarget,
    addTimer,
    addTarget,
    close
  }: {
    editTimer: (timer: Timer) => void;
    editTarget: (target: TargetWithSpecs) => void;
    addTimer: () => void;
    addTarget: () => void;
    close: () => void;
  } = $props();

  async function handleDeleteTimer(timer: Timer) {
    if (confirm(`Delete timer "${timer.name}"?`)) {
      await timersStore.delete(timer);
    }
  }

  async function handleDeleteTarget(target: TargetWithSpecs) {
    if (confirm(`Delete target "${target.name}"?`)) {
      await targetsStore.delete(target);
    }
  }

  // Calculate progress for each target
  function calculateTargetProgress(target: TargetWithSpecs) {
    const assignedTimers = $timersStore.items.filter(b => b.target_id === target.id);
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    
    let totalMinutes = 0;

    for (const timer of assignedTimers) {
      // Get today's logs for this timer
      const timerLogs = $timeLogsStore.items.filter(log =>
        log.timer_id === timer.id &&
        log.start_timestamp &&
        dayjs(log.start_timestamp).isAfter(todayStart) &&
        dayjs(log.start_timestamp).isBefore(todayEnd)
      );
      
      // Sum durations from completed sessions
      for (const log of timerLogs) {
        if (log.end_timestamp) {
          // Use pre-calculated duration if available
          if (log.duration_minutes !== undefined && log.duration_minutes !== null) {
            totalMinutes += log.duration_minutes;
          } else {
            // Calculate from timestamps
            const start = dayjs(log.start_timestamp);
            const end = dayjs(log.end_timestamp);
            totalMinutes += end.diff(start, 'minute');
          }
        } else {
          // Active session - calculate from start to now
          const start = dayjs(log.start_timestamp);
          totalMinutes += dayjs().diff(start, 'minute');
        }
      }
    }
    
    // Get active target spec for today
    const activeSpec = getActiveTargetSpec(target);
    const today = dayjs().day(); // 0 (Sun) to 6 (Sat)
    const todayIndex = activeSpec?.weekdays.indexOf(today) ?? -1;
    const targetDuration = todayIndex >= 0 && activeSpec ? activeSpec.duration_minutes[todayIndex] : (activeSpec?.duration_minutes[0] || 60);
    
    const percentage = Math.min(100, Math.round((totalMinutes / targetDuration) * 100));
    
    return { totalMinutes, targetDuration, percentage };
  }

  function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }

  // Get active targets (not ended)
  let activeTargets: TargetWithSpecs[] = $state([]);
  let archivedTargets: TargetWithSpecs[] = $state([]);
  let activeTimers: Timer[] = $state([]);
  let archivedTimers: Timer[] = $state([]);


  $effect(() => {
    const _archivedTargets: TargetWithSpecs[] = [];
    const _activeTargets: TargetWithSpecs[] = [];

    $targetsStore.items.forEach(t => {
      if (isTargetEnded(t)) {
        _archivedTargets.push(t);
      } else {
        _activeTargets.push(t);
      }
    });
    activeTargets = _activeTargets;
    archivedTargets = _archivedTargets;

    const _archivedTimers: Timer[] = [];
    const _activeTimers: Timer[] = [];
    $timersStore.items.forEach(b => {
      const linkedTarget = $targetsStore.items.find(t => t.id === b.target_id);
      if (linkedTarget && isTargetEnded(linkedTarget)) {
        _archivedTimers.push(b);
      } else {
        _activeTimers.push(b);
      }
    });
    archivedTimers = _archivedTimers;
    activeTimers = _activeTimers;
  });
</script>

<!-- Modal Overlay -->
<div 
  class="fixed inset-0 z-50 flex items-center justify-center p-4"
  onclick={close}
  onkeydown={(e) => e.key === 'Escape' && close()}
  role="button"
  tabindex="0"
>
  <!-- Modal Content -->
  <div 
    class="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- Header -->
    <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
      <h2 class="text-xl font-semibold text-gray-800">Edit Timers & Targets</h2>
      <div class="flex gap-2">
        <button
          onclick={close}
          class="text-gray-400 hover:text-gray-600 transition-colors icon-[si--close-circle-duotone]"
          style="width: 28px; height: 28px;"
          aria-label="Close"
        ></button>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="overflow-y-auto flex-1 p-6 space-y-6">
      <!-- Targets Section -->
      <div>
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span class="bg-green-600 icon-[si--clipboard-check-alt-duotone]" style="width: 24px; height: 24px;"></span>
              Targets
            </h3>
            <button
                onclick={addTarget}
                class="icon-[si--add-circle-duotone] bg-blue-400 hover:bg-blue-600"
                aria-label="Add"
                style="width: 24px; height: 24px;"
            ></button>
        </div>
        
        {#if activeTargets.length === 0}
          <p class="text-gray-500 text-sm italic">No active targets yet</p>
        {:else}
          <div class="space-y-2">
            {#each activeTargets.slice().sort((a, b) => a.name.localeCompare(b.name)) as target}
              {@const progress = calculateTargetProgress(target)}
              <div class="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="font-medium text-gray-800">{target.name}</h4>
                  <div class="flex gap-1">
                    <button
                      onclick={() => editTarget(target)}
                      class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Edit Target"
                    ></button>
                    <button
                      onclick={() => handleDeleteTarget(target)}
                      class="p-1 text-red-600 hover:text-red-700 icon-[si--bin-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Delete Target"
                    ></button>
                  </div>
                </div>
                
                <!-- Progress bar -->
                <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-1">
                  <div
                    class="h-full rounded-full transition-all duration-500 bg-blue-500"
                    style="width: {progress.percentage}%"
                  ></div>
                </div>
                
                <div class="flex justify-between items-center text-xs">
                  <span class="text-gray-500">
                    {progress.percentage}% ({formatDuration(progress.totalMinutes)} / {formatDuration(progress.targetDuration)})
                  </span>
                  {#each [getActiveTargetSpec(target)] as activeSpec}
                    {#if activeSpec}
                      <span class="text-gray-400">{getWeekdayNames(activeSpec.weekdays)}</span>
                    {/if}
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Timers Section -->
      <div>
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span class="bg-blue-500 icon-[si--clock-alt-duotone]" style="width: 24px; height: 24px;"></span>
              Timers
            </h3>
            <button
                onclick={addTimer}
                class="icon-[si--add-circle-duotone] bg-blue-400 hover:bg-blue-600"
                aria-label="Add"
                style="width: 24px; height: 24px;"
            ></button>
        </div>

        {#if activeTimers.length === 0}
          <p class="text-gray-500 text-sm italic">No active timers yet</p>
        {:else}
          <div class="space-y-2">
            {#each activeTimers as timer}
              <div class="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3 flex-1">
                    <div 
                      class="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                      style="background-color: {timer.color || '#3B82F6'};"
                    >
                      {timer.emoji || '⏱️'}
                    </div>
                    <div>
                      <h4 class="font-medium text-gray-800">{timer.name}</h4>
                      <div class="text-xs text-gray-500 flex gap-2">
                        {#if timer.auto_subtract_breaks}
                          <span class="flex items-center gap-1">
                            <span class="icon-[proicons--coffee-hot]" style="width: 12px; height: 12px;"></span>
                            Auto breaks
                          </span>
                        {/if}
                        {#if timer.target_id}
                          {@const linkedTarget = $targetsStore.items.find(t => t.id === timer.target_id)}
                          {#if linkedTarget}
                            <span class="flex items-center gap-1">
                              <span class="icon-[proicons--link]" style="width: 12px; height: 12px;"></span>
                              {linkedTarget.name}
                            </span>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <button
                      onclick={() => editTimer(timer)}
                      class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Edit Timer"
                    ></button>
                    <button
                      onclick={() => handleDeleteTimer(timer)}
                      class="p-1 text-red-600 hover:text-red-700 icon-[si--bin-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label="Delete Timer"
                    ></button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Archived Section (Ended Targets and Buttons) -->
      {#if archivedTargets.length > 0 || archivedTimers.length > 0}
        <div class="border-t-2 border-gray-300 pt-6 mt-6">
          <h3 class="text-lg font-semibold text-gray-500 mb-3 flex items-center gap-2">
            <span class="bg-gray-400 icon-[si--archive-duotone]" style="width: 24px; height: 24px;"></span>
            Archived (Ended)
          </h3>
          
          <!-- Archived Targets -->
          {#if archivedTargets.length > 0}
            <div class="mb-4">
              <h4 class="text-sm font-medium text-gray-600 mb-2">Ended Targets</h4>
              <div class="space-y-2 opacity-70">
                {#each archivedTargets.slice().sort((a, b) => a.name.localeCompare(b.name)) as target}
                  <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div class="flex justify-between items-center mb-2">
                      <h4 class="font-medium text-gray-700">{target.name}</h4>
                      <div class="flex gap-1">
                        <button
                          onclick={() => editTarget(target)}
                          class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                          style="width: 20px; height: 20px;"
                          aria-label="Edit Target"
                        ></button>
                        <button
                          onclick={() => handleDeleteTarget(target)}
                          class="p-1 text-red-600 hover:text-red-700 icon-[si--bin-duotone]"
                          style="width: 20px; height: 20px;"
                          aria-label="Delete Target"
                        ></button>
                      </div>
                    </div>
                    
                    <div class="flex justify-between items-center text-xs text-gray-500">
                      {#each [getActiveTargetSpec(target)] as latestSpec}
                        {#if latestSpec}
                          <span>{getWeekdayNames(latestSpec.weekdays)}</span>
                          {#if latestSpec.ending_at}
                            <span class="text-red-600 font-medium">Ended: {dayjs(latestSpec.ending_at).format('MMM D, YYYY')}</span>
                          {/if}
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Archived Timers -->
          {#if archivedTimers.length > 0}
            <div>
              <h4 class="text-sm font-medium text-gray-600 mb-2">Timers Linked to Ended Targets</h4>
              <div class="space-y-2 opacity-70">
                {#each archivedTimers as timer}
                  <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div class="flex justify-between items-center">
                      <div class="flex items-center gap-3 flex-1">
                        <div 
                          class="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                          style="background-color: {timer.color || '#3B82F6'};"
                        >
                          {timer.emoji || '⏱️'}
                        </div>
                        <div>
                          <h4 class="font-medium text-gray-700">{timer.name}</h4>
                          <div class="text-xs text-gray-500 flex gap-2">
                            {#if timer.auto_subtract_breaks}
                              <span class="flex items-center gap-1">
                                <span class="icon-[proicons--coffee-hot]" style="width: 12px; height: 12px;"></span>
                                Auto breaks
                              </span>
                            {/if}
                            {#if timer.target_id}
                              {@const linkedTarget = $targetsStore.items.find(t => t.id === timer.target_id)}
                              {#if linkedTarget}
                                <span class="flex items-center gap-1 text-red-600">
                                  <span class="icon-[proicons--link]" style="width: 12px; height: 12px;"></span>
                                  {linkedTarget.name} (Ended)
                                </span>
                              {/if}
                            {/if}
                          </div>
                        </div>
                      </div>
                      <div class="flex gap-1">
                        <button
                          onclick={() => editTimer(timer)}
                          class="p-1 text-blue-600 hover:text-blue-700 icon-[si--edit-detailed-duotone]"
                          style="width: 20px; height: 20px;"
                          aria-label="Edit Button"
                        ></button>
                        <button
                          onclick={() => handleDeleteTimer(timer)}
                          class="p-1 text-red-600 hover:text-red-700 icon-[si--bin-duotone]"
                          style="width: 20px; height: 20px;"
                          aria-label="Delete Button"
                        ></button>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Add backdrop blur effect */
  div[role="button"] {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }
</style>
