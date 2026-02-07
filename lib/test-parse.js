import dayjs from './utils/dayjs.js';

const DATE_TIME_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'DD.MM.YYYY HH:mm:ss',
  'DD.MM.YYYY HH:mm',
  'DD/MM/YYYY HH:mm:ss',
  'DD/MM/YYYY HH:mm',
  'MM/DD/YYYY HH:mm:ss',
  'MM/DD/YYYY HH:mm',
];

const value = '03.11.2025 08:00';

console.log('Testing parseDateTime logic:');
for (const format of DATE_TIME_FORMATS) {
  const parsed = dayjs(value, format, true);
  console.log(`Format: ${format.padEnd(25)} Valid: ${parsed.isValid()} Month: ${parsed.month()} Date: ${parsed.date()}`);
}

console.log('\nNative Date:');
const nativeDate = new Date(value);
console.log('Month:', nativeDate.getMonth(), 'Date:', nativeDate.getDate());
