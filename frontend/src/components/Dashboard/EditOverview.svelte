<script lang="ts">
  import Modal from '../Modal.svelte';
  import { timers } from '../../stores/timers';
  import { targetsStore, targets } from '../../stores/targets';
  import { timerlogs } from '../../stores/timelogs';
  import type { Timer, TargetWithSpecs } from '../../types';
  import { getActiveTargetSpec, isTargetArchived } from '../../lib/utils/targetSpec';
  import { dayjs } from '../../types';
  import { _ } from '../../lib/i18n';
  import { formatMinutesCompact } from '../../../../lib/utils/timeFormat';

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

<Modal title={$_('dashboard.editTimersTargets')} maxWidth="max-w-2xl" maxHeight="max-h-[80vh]" onclose={close}>
  {#snippet children()}
    <div class="space-y-6">
      <!-- Targets Section -->
      <div>
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <span class="bg-green-600 icon-[si--clipboard-check-alt-duotone]" style="width: 24px; height: 24px;"></span>
              {$_('dashboard.targets')}
            </h3>
            <button
                onclick={addTarget}
                class="icon-[si--add-circle-duotone] bg-blue-400 dark:bg-orange-500 hover:bg-blue-600 dark:hover:bg-orange-600"
                aria-label={$_('common.add')}
                style="width: 24px; height: 24px;"
            ></button>
        </div>
        
        {#if activeTargets.length === 0}
          <p class="text-gray-500 dark:text-gray-400 text-sm italic">{$_('dashboard.noActiveTargets')}</p>
        {:else}
          <div class="space-y-2">
            {#each activeTargets.slice().sort((a, b) => a.name.localeCompare(b.name)) as target}
              {@const progress = calculateTargetProgress(target)}
              <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="font-medium text-gray-800 dark:text-gray-100">{target.name}</h4>
                  <button
                    onclick={() => editTarget(target)}
                    class="p-1 text-blue-600 dark:text-orange-400 hover:text-blue-700 dark:hover:text-orange-300 icon-[si--edit-detailed-duotone]"
                    style="width: 20px; height: 20px;"
                    aria-label={$_('target.editTarget')}
                  ></button>
                </div>
                
                <!-- Progress bar -->
                <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden mb-1">
                  <div
                    class="h-full rounded-full transition-all duration-500 bg-blue-500 dark:bg-orange-500"
                    style="width: {progress.percentage}%"
                  ></div>
                </div>
                
                <div class="flex justify-between items-center text-xs">
                  <span class="text-gray-500 dark:text-gray-400">
                    {progress.percentage}% ({formatMinutesCompact(progress.totalMinutes)} / {formatMinutesCompact(progress.targetDuration)})
                  </span>
                  {#each [getActiveTargetSpec(target)] as activeSpec}
                    {#if activeSpec}
                      <span class="text-gray-400 dark:text-gray-500">{getActiveWeekdays(activeSpec)}</span>
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
            <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <span class="bg-blue-500 dark:bg-orange-500 icon-[si--clock-alt-duotone]" style="width: 24px; height: 24px;"></span>
              {$_('common.timers')}
            </h3>
            <button
                onclick={addTimer}
                class="icon-[si--add-circle-duotone] bg-blue-400 dark:bg-orange-500 hover:bg-blue-600 dark:hover:bg-orange-600"
                aria-label={$_('common.add')}
                style="width: 24px; height: 24px;"
            ></button>
        </div>

        {#if activeTimers.length === 0}
          <p class="text-gray-500 dark:text-gray-400 text-sm italic">{$_('dashboard.noActiveTimers')}</p>
        {:else}
          <div class="space-y-2">
            {#each activeTimers as timer}
              <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3 flex-1">
                    <div 
                      class="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                      style="background-color: {timer.color || '#3B82F6'};"
                    >
                      {timer.emoji || '⏱️'}
                    </div>
                    <div>
                      <h4 class="font-medium text-gray-800 dark:text-gray-100">{timer.name}</h4>
                      <div class="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                        {#if timer.auto_subtract_breaks}
                          <span class="flex items-center gap-1">
                            <span class="icon-[proicons--coffee-hot]" style="width: 12px; height: 12px;"></span>
                            {$_('dashboard.autoBreaks')}
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
                      class="p-1 text-blue-600 dark:text-orange-400 hover:text-blue-700 dark:hover:text-orange-300 icon-[si--edit-detailed-duotone]"
                      style="width: 20px; height: 20px;"
                      aria-label={$_('timer.editTimer')}
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
        <div class="border-t-2 border-gray-300 dark:border-gray-600 pt-6 mt-6">
          <h3 class="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
            <span class="bg-gray-400 icon-[si--archive-duotone]" style="width: 24px; height: 24px;"></span>
            {$_('dashboard.archivedEnded')}
          </h3>
          
          <!-- Archived Targets -->
          {#if archivedTargets.length > 0}
            <div class="mb-4">
              <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{$_('dashboard.endedTargets')}</h4>
              <div class="space-y-2 opacity-70">
                {#each archivedTargets.slice().sort((a, b) => a.name.localeCompare(b.name)) as target}
                  <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
                    <div class="flex justify-between items-center mb-2">
                      <h4 class="font-medium text-gray-700 dark:text-gray-300">{target.name}</h4>
                      <button
                        onclick={() => editTarget(target)}
                        class="p-1 text-blue-600 dark:text-orange-400 hover:text-blue-700 dark:hover:text-orange-300 icon-[si--edit-detailed-duotone]"
                        style="width: 20px; height: 20px;"
                        aria-label={$_('target.editTarget')}
                      ></button>
                    </div>
                    
                    <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      {#each [getActiveTargetSpec(target)] as latestSpec}
                        {#if latestSpec}
                          <span>{getActiveWeekdays(latestSpec)}</span>
                          {#if latestSpec.ending_at}
                            <span class="text-red-600 dark:text-red-400 font-medium">{$_('target.endedAt')}: {dayjs(latestSpec.ending_at).format('ll')}</span>
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
              <h4 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{$_('dashboard.timersLinkedToEndedTargets')}</h4>
              <div class="space-y-2 opacity-70">
                {#each archivedTimers as timer}
                  <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
                    <div class="flex justify-between items-center">
                      <div class="flex items-center gap-3 flex-1">
                        <div 
                          class="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                          style="background-color: {timer.color || '#3B82F6'};"
                        >
                          {timer.emoji || '⏱️'}
                        </div>
                        <div>
                          <h4 class="font-medium text-gray-700 dark:text-gray-300">{timer.name}</h4>
                          <div class="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                            {#if timer.auto_subtract_breaks}
                              <span class="flex items-center gap-1">
                                <span class="icon-[proicons--coffee-hot]" style="width: 12px; height: 12px;"></span>
                                {$_('dashboard.autoBreaks')}
                              </span>
                            {/if}
                            {#if timer.target_id}
                              {@const linkedTarget = $targetsStore.items.get(timer.target_id)}
                              {#if linkedTarget}
                                <span class="flex items-center gap-1 text-red-600 dark:text-red-400">
                                  <span class="icon-[proicons--link]" style="width: 12px; height: 12px;"></span>
                                  {linkedTarget.name} ({$_('dashboard.archived.ended')})
                                </span>
                              {/if}
                            {/if}
                          </div>
                        </div>
                      </div>
                      <div class="flex gap-1">
                        <button
                          onclick={() => editTimer(timer)}
                          class="p-1 text-blue-600 dark:text-orange-400 hover:text-blue-700 dark:hover:text-orange-300 icon-[si--edit-detailed-duotone]"
                          style="width: 20px; height: 20px;"
                          aria-label={$_('timer.editButton')}
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
