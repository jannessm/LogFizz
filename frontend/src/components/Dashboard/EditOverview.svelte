<script lang="ts">
  import Modal from '../Modal.svelte';
  import { timersStore, timers } from '../../stores/timers';
  import { targetsStore, targets } from '../../stores/targets';
  import { timeLogsStore, timerlogs } from '../../stores/timelogs';
  import type { Timer, TargetWithSpecs } from '../../types';
  import { getActiveTargetSpec, isTargetArchived } from '../../lib/utils/targetSpec';
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
      await timersStore.delete($state.snapshot(timer));
    }
  }

  async function handleDeleteTarget(target: TargetWithSpecs) {
    if (confirm(`Delete target "${target.name}"?`)) {
      await targetsStore.delete($state.snapshot(target));
    }
  }

  // Calculate progress for each target
  function calculateTargetProgress(target: TargetWithSpecs) {
    const assignedTimers = $timers.filter(b => b.target_id === target.id);
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    
    let totalMinutes = 0;

    for (const timer of assignedTimers) {
      // Get today's logs for this timer
      const timerLogs = $timerlogs.filter(log =>
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
    const targetDuration = activeSpec?.duration_minutes[today] || 60;
    
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

  function getActiveWeekdays(spec: any): string {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activeDays = spec.duration_minutes
      .map((duration: number, index: number) => duration > 0 ? dayNames[index] : null)
      .filter((day: string | null) => day !== null);
    return activeDays.join(', ');
  }

  let activeTargets: TargetWithSpecs[] = $state([]);
  let archivedTargets: TargetWithSpecs[] = $state([]);
  let activeTimers: Timer[] = $state([]);
  let archivedTimers: Timer[] = $state([]);

  $effect(() => {
    const _archivedTargets: TargetWithSpecs[] = [];
    const _activeTargets: TargetWithSpecs[] = [];

    $targets.forEach(t => {
      if (isTargetArchived(t)) {
        _archivedTargets.push(t);
      } else {
        _activeTargets.push(t);
      }
    });
    activeTargets = _activeTargets;
    archivedTargets = _archivedTargets;

    const _archivedTimers: Timer[] = [];
    const _activeTimers: Timer[] = [];
    $timers.forEach(b => {
      if (!b.target_id) {
        _activeTimers.push(b);
        return;
      }
      const linkedTarget = $targetsStore.items.get(b.target_id!);
      if (linkedTarget && isTargetArchived(linkedTarget)) {
        _archivedTimers.push(b);
      } else {
        _activeTimers.push(b);
      }
    });
    archivedTimers = _archivedTimers;
    activeTimers = _activeTimers;
  });
</script>

<Modal title="Edit Timers & Targets" maxWidth="max-w-2xl" maxHeight="max-h-[80vh]" onclose={close}>
  {#snippet children()}
    <div class="space-y-6">
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
                      <span class="text-gray-400">{getActiveWeekdays(activeSpec)}</span>
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
                          {@const linkedTarget = $targetsStore.items.get(timer.target_id)}
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
                          <span>{getActiveWeekdays(latestSpec)}</span>
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
                              {@const linkedTarget = $targetsStore.items.get(timer.target_id)}
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
  {/snippet}
</Modal>
