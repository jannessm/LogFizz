import type { Session } from '../lib/utils/computeIndentation';
import { dayjs, userTimezone } from '../types';

export type SessionData = {
  sessions: Session[];
  multiDaySessions: Session[];
};

export type TimelineProps = {
  timelineStart: dayjs.Dayjs | null;
  timelineEnd: dayjs.Dayjs | null;
  timelineHours: number;
  timelineHeight: number;
};

// Get time logs for selected date - each log is already a session
export function getSessionsForSelectedDate(
  selectedDate: dayjs.Dayjs,
  timeLogs: any[]
): SessionData {
  const dateStr = selectedDate.format('YYYY-MM-DD');
  const now = dayjs.tz(undefined, userTimezone);

  const sessions: Session[] = [];
  const multiDaySessions: Session[] = [];

  const filteredLogs = timeLogs
    .filter(tl => {
      if (!tl.start_timestamp) return false;
      
      // Convert UTC timestamp to user's timezone for comparison
      const logTimezone = tl.timezone || userTimezone;
      const startDate = dayjs.tz(tl.start_timestamp, logTimezone);
      
      // For ended log, check if selected date is within start and end
      if (tl.end_timestamp) {
        const endDate = dayjs.tz(tl.end_timestamp, logTimezone);
        const selectedDay = dayjs.tz(dateStr, logTimezone).startOf('day');
        
        // Check if selected date is within the range (inclusive)
        return selectedDay.isSameOrAfter(startDate, 'day') && selectedDay.isSameOrBefore(endDate, 'day');
      }
      
      // For running logs, check if start date is before or on selected date
      return startDate.isSameOrBefore(selectedDate, 'day');
    })
  
  const sessionsForDate = filteredLogs
    .map(log => {
      // For running sessions (no end_timestamp), calculate duration to current time
      let duration = log.duration_minutes;
      const logTimezone = log.timezone || userTimezone;
      const start = dayjs.tz(log.start_timestamp, logTimezone);
      const end = log.end_timestamp ? dayjs.tz(log.end_timestamp, logTimezone) : now;

      if (!log.end_timestamp && log.start_timestamp) {
        duration = now.diff(start, 'minute');
      }

      return {
        timer_id: log.timer_id,
        startTime: log.start_timestamp,
        endTime: log.end_timestamp,
        duration: duration,
        multiDay: start.isBefore(selectedDate.startOf('day')) && end.isAfter(selectedDate.endOf('day')) || log.whole_day == true,
        log: log,
      };
    })
    .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf());

  for (const session of sessionsForDate) {
    if (session.multiDay) {
      multiDaySessions.push(session);
    } else {
      sessions.push(session);
    }
  }

  console.log('Sessions for date', dateStr, sessions, multiDaySessions);

  return { sessions, multiDaySessions };
}

// Calculate timeline bounds and position for each session
export function calculateTimeline(sessions: any[], selectedDate?: dayjs.Dayjs) {
  if (sessions.length === 0) {
    return {
      timelineStart: null,
      timelineEnd: null,
      timelineHours: 0,
      timelineHeight: 400,
    };
  }

  // Get day boundaries for clipping
  const dayStart = selectedDate ? selectedDate.startOf('day') : null;
  const dayEnd = selectedDate ? selectedDate.endOf('day') : null;

  // Find earliest start and latest end, clipping to day boundaries
  let earliest = dayjs(sessions[0].startTime);
  let latest = dayjs(sessions[0].startTime);

  // Clip to day boundaries if provided
  if (dayStart && earliest.isBefore(dayStart)) {
    earliest = dayStart;
  }
  if (dayEnd && latest.isAfter(dayEnd)) {
    latest = dayEnd;
  }

  for (const session of sessions) {
    let start = dayjs(session.startTime);
    let end = session.endTime ? dayjs(session.endTime) : dayjs();

    // Clip to day boundaries if provided
    if (dayStart && start.isBefore(dayStart)) {
      start = dayStart;
    }
    if (dayEnd && end.isAfter(dayEnd)) {
      end = dayEnd;
    }

    if (start.isBefore(earliest)) earliest = start;
    if (end.isAfter(latest)) latest = end;
  }

  // Round to nearest hour for cleaner display
  let timelineStart = earliest.startOf('hour');
  let timelineEnd = latest.add(1, 'hour').startOf('hour');
  let timelineHours = timelineEnd.diff(timelineStart, 'hour');

  // Compute required timeline height (px) so that the minimum session box height is 60px
  const totalMinutes = timelineEnd.diff(timelineStart, 'minute');
  const MIN_BOX_PX = 60;
  const MIN_HEIGHT_PX = 100; // baseline minimum timeline height
  const MIN_LABEL_SPACING_PX = 60; // ensure at least 60px between hour labels

  let requiredHeight = MIN_HEIGHT_PX;
  if (totalMinutes > 0) {
    for (const session of sessions) {
      let start = dayjs(session.startTime);
      let end = session.endTime ? dayjs(session.endTime) : dayjs();

      // Clip to day boundaries if provided
      if (dayStart && start.isBefore(dayStart)) {
        start = dayStart;
      }
      if (dayEnd && end.isAfter(dayEnd)) {
        end = dayEnd;
      }

      const duration = end.diff(start, 'minute');
      if (!duration || duration <= 0) continue;

      // For a given session, we need H such that (duration / totalMinutes) * 0.9 * H >= MIN_BOX_PX
      // => H >= (MIN_BOX_PX * totalMinutes) / (duration * 0.9)
      const needed = Math.ceil((MIN_BOX_PX * totalMinutes) / (duration * 0.9));
      if (needed > requiredHeight) requiredHeight = needed;
    }
  }

  // Also ensure hour labels are spaced at least MIN_LABEL_SPACING_PX apart
  let minHeightForLabels = MIN_HEIGHT_PX;
  if (timelineHours > 0) {
    // label spacing in px = (timelineHeight * 0.9) / timelineHours
    // so required timelineHeight >= (MIN_LABEL_SPACING_PX * timelineHours) / 0.9
    minHeightForLabels = Math.ceil((MIN_LABEL_SPACING_PX * timelineHours) / 0.9);
  }

  const timelineHeight = Math.max(MIN_HEIGHT_PX, requiredHeight, minHeightForLabels);

  return {
    timelineStart,
    timelineEnd,
    timelineHours,
    timelineHeight,
  };
}

// Generate hour labels for timeline
export function getHourLabels(
  timelineStart: dayjs.Dayjs | null,
  timelineHours: number
): string[] {
  if (!timelineStart || !timelineHours || timelineHours === 0) return [];
  
  const labels: string[] = [];
  for (let i = 0; i <= timelineHours; i++) {
    labels.push(timelineStart.add(i, 'hour').format('HH:mm'));
  }

  return labels;
}