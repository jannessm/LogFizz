import { parseDateTime, validateAndConvertTimelogs } from './dist/utils/csvImport.js';

// Test timezone parsing
const dateString = '2025-11-03 08:00';

console.log('Testing timezone parsing:');
console.log('Input:', dateString);

const utcDate = parseDateTime(dateString, 'UTC');
console.log('UTC:', utcDate?.toISOString());

const berlinDate = parseDateTime(dateString, 'Europe/Berlin');
console.log('Europe/Berlin:', berlinDate?.toISOString());

// Test that different timezones produce different results
const rows = [{
  startValue: '2025-11-03 08:00',
  endValue: '2025-11-03 16:00',
  rowIndex: 0
}];

const utcResult = validateAndConvertTimelogs(rows, { timezone: 'UTC' });
console.log('\nUTC conversion:', utcResult.valid[0].start_timestamp);

const berlinResult = validateAndConvertTimelogs(rows, { timezone: 'Europe/Berlin' });
console.log('Berlin conversion:', berlinResult.valid[0].start_timestamp);

console.log('\nTimezone conversion working:', utcResult.valid[0].start_timestamp !== berlinResult.valid[0].start_timestamp);
