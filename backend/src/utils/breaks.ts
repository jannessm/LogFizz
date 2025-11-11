/**
 * Calculate automatic break time based on German labor laws
 * >= 6 hours: 30 minutes break
 * >= 9 hours: 45 minutes break
 */
export function calculateBreakTime(durationMinutes: number): number {
  const hours = durationMinutes / 60;
  
  if (hours >= 9) {
    return 45; // 45 minutes for 9+ hours
  } else if (hours >= 6) {
    return 30; // 30 minutes for 6+ hours
  }
  
  return 0; // No automatic break for less than 6 hours
}
