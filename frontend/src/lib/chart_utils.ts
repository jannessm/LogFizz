export function numberToHoursMinutes(x: number): string {
  const hours = Math.floor(x);
  const mins = Math.round((x - hours) * 60);
  return `${hours}h ${mins}m`;
}