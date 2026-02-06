import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Test to detect non-locale-aware date format patterns in Svelte components.
 * 
 * Locale-aware format tokens (OK):
 * - L, LL, LLL, LLLL (localized date)
 * - LT, LTS (localized time)
 * - l, ll, lll, llll (short localized date)
 * 
 * Data/URL format patterns (OK - not displayed):
 * - YYYY-MM-DD (ISO date)
 * - YYYY-MM (year-month)
 * - HH:mm (when used for input values)
 * 
 * Patterns that need review (when displayed to user):
 * - MMMM, MMM (month names)
 * - dddd, ddd (day names)
 * - D, DD (day numbers when standalone)
 * - Custom patterns with h:mm, etc.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC = join(__dirname, '..');

// Files to exclude from checking
const EXCLUDED_FILES = [
  'impressum.svelte',
  'datenschutz.svelte',
];

// Locale-aware format tokens - these are OK
const LOCALE_AWARE_TOKENS = [
  'L',    // 09/04/1986
  'LL',   // September 4, 1986
  'LLL',  // September 4, 1986 8:30 PM
  'LLLL', // Thursday, September 4, 1986 8:30 PM
  'LT',   // 8:30 PM
  'LTS',  // 8:30:00 PM
  'l',    // 9/4/1986
  'll',   // Sep 4, 1986
  'lll',  // Sep 4, 1986 8:30 PM
  'llll', // Thu, Sep 4, 1986 8:30 PM
];

// Patterns used for data/URLs - not displayed to user, OK
const DATA_URL_PATTERNS = [
  'YYYY-MM-DD',
  'YYYY-MM',
  'HH:mm',      // Often used for input binding
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-DD HH:mm:ss',
  'D',          // Day number (1-31) - same in all locales
];

/**
 * Check if a format string is locale-aware or for data purposes
 */
function isAcceptableFormat(format: string): boolean {
  // Pure locale-aware tokens
  if (LOCALE_AWARE_TOKENS.includes(format)) {
    return true;
  }
  
  // Combination of locale-aware tokens (e.g., 'L LT', 'dddd, LL', 'LL LT')
  const parts = format.split(/\s+/);
  if (parts.every(part => LOCALE_AWARE_TOKENS.includes(part) || part === ',')) {
    return true;
  }
  
  // Check for locale-aware combinations like 'dddd, LL' or 'MMMM YYYY' with locale tokens
  // 'dddd, LL' is actually locale-aware because LL is locale-aware
  if (format.includes('LL') || format.includes('LT')) {
    // If it contains locale tokens combined with day name, it's OK
    // e.g., 'dddd, LL' uses LL which is locale-aware for the date part
    return true;
  }
  
  // Data/URL patterns - not displayed
  if (DATA_URL_PATTERNS.includes(format)) {
    return true;
  }
  
  return false;
}

/**
 * Context patterns that indicate data/URL usage (not display)
 */
const DATA_CONTEXT_PATTERNS = [
  /params\.set\(/,
  /\.get\(/,
  /dateStr\s*=/,
  /=\s*[^;]*\.format\(/,
  /const\s+\w+\s*=\s*[^;]*\.format\(/,
  /let\s+\w+\s*=\s*[^;]*\.format\(/,
  /minDate|maxDate/,
  /startOf|endOf/,
];

/**
 * Check if a format call is in a data/URL context (not displayed)
 */
function isDataContext(line: string, prevLines: string[]): boolean {
  const combinedContext = [...prevLines, line].join('\n');
  
  for (const pattern of DATA_CONTEXT_PATTERNS) {
    if (pattern.test(combinedContext)) {
      return true;
    }
  }
  
  // Check if it's inside a script tag by looking at context
  return false;
}

/**
 * Get all Svelte files in a directory recursively
 */
function getSvelteFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.svelte')) {
        if (!EXCLUDED_FILES.includes(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walk(dir);
  return files;
}

interface FormatIssue {
  file: string;
  line: number;
  format: string;
  context: string;
}

/**
 * Find non-locale-aware format calls that appear to be displayed
 */
function findDisplayedFormatIssues(filePath: string): FormatIssue[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: FormatIssue[] = [];
  
  // Track if we're in script or template section
  let inScript = false;
  let inTemplate = false;
  let scriptContent = '';
  let templateContent = '';
  
  // Simple tracking of script vs template sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (/<script[^>]*>/.test(line)) {
      inScript = true;
      inTemplate = false;
    } else if (/<\/script>/.test(line)) {
      inScript = false;
    } else if (!inScript && !/<style[^>]*>/.test(line) && !/<\/style>/.test(line)) {
      inTemplate = true;
    }
    
    // Look for .format('...') patterns
    const formatRegex = /\.format\(['"]([^'"]+)['"]\)/g;
    let match;
    
    while ((match = formatRegex.exec(line)) !== null) {
      const format = match[1];
      
      // Skip if acceptable format
      if (isAcceptableFormat(format)) {
        continue;
      }
      
      // Get context (previous 2 lines)
      const prevLines = lines.slice(Math.max(0, i - 2), i);
      
      // If in script, check if it's data context
      if (inScript) {
        if (isDataContext(line, prevLines)) {
          continue;
        }
      }
      
      // If in template (between { }), it's likely displayed
      // Check if the format call is inside template interpolation
      if (inTemplate || /\{[^}]*\.format\(/.test(line)) {
        issues.push({
          file: filePath,
          line: i + 1,
          format,
          context: line.trim().substring(0, 80),
        });
      }
    }
  }
  
  return issues;
}

describe('i18n date format compliance', () => {
  const componentsDir = join(FRONTEND_SRC, 'components');
  const routesDir = join(FRONTEND_SRC, 'routes');
  
  it('should use locale-aware date formats in components', () => {
    const files = getSvelteFiles(componentsDir);
    const allIssues: FormatIssue[] = [];
    
    for (const file of files) {
      const issues = findDisplayedFormatIssues(file);
      allIssues.push(...issues);
    }
    
    if (allIssues.length > 0) {
      console.error('\n=== Non-locale-aware date formats in components ===\n');
      allIssues.forEach(issue => {
        console.error(`${issue.file}:${issue.line}`);
        console.error(`  Format: "${issue.format}"`);
        console.error(`  Context: ${issue.context}`);
        console.error('');
      });
    }
    
    expect(allIssues).toEqual([]);
  });
  
  it('should use locale-aware date formats in routes', () => {
    const files = getSvelteFiles(routesDir);
    const allIssues: FormatIssue[] = [];
    
    for (const file of files) {
      const issues = findDisplayedFormatIssues(file);
      allIssues.push(...issues);
    }
    
    if (allIssues.length > 0) {
      console.error('\n=== Non-locale-aware date formats in routes ===\n');
      allIssues.forEach(issue => {
        console.error(`${issue.file}:${issue.line}`);
        console.error(`  Format: "${issue.format}"`);
        console.error(`  Context: ${issue.context}`);
        console.error('');
      });
    }
    
    expect(allIssues).toEqual([]);
  });
});
