import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Test to detect hardcoded (untranslated) text in Svelte components.
 * 
 * This test scans all .svelte files and checks for:
 * - Text content between HTML tags that isn't using i18n
 * - Hardcoded placeholder, title, and aria-label attributes
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_SRC = join(__dirname, '..');

// Files to exclude from checking
const EXCLUDED_FILES = [
  'impressum.svelte',    // Legal page - German only
  'datenschutz.svelte',  // Privacy policy - German only
];

// Patterns that are acceptable (not requiring translation)
const ACCEPTABLE_PATTERNS = [
  /^\s*$/,                           // Empty or whitespace only
  /^[0-9.,\-+:/%]+$/,                // Numbers, punctuation, time formats
  /^[•·\-–—|\/\\]+$/,                // Bullets and separators
  /^https?:\/\//,                    // URLs
  /^\{.*\}$/,                        // Svelte expressions
  /^\$_\(/,                          // i18n calls
  /^#[a-fA-F0-9]{3,8}$/,            // Hex colors
  /^TapShift$/i,                     // Brand name
  /^[a-z_]+\([^)]*\)\s*[}>\n]/i,    // Function calls like handleSort('timer')}
  /^\w+\s*=\s*[^;]+[}>\n]/,         // Assignments like archiveDate = null}
  /^[a-z_.]+\s*[<>!=]+\s*\d+\s*[}&]/i, // Comparisons like length > 0}
  /^-->/,                            // HTML comments end
  /^[a-z]+\.[a-z]+/i,                // Object property access like t.id
  /^[a-z]+\s+as\s+[a-z]+/i,          // Svelte each expressions
  /^[a-z_]+\s*\(/i,                  // Standalone function calls
  /^\([^)]+\)\s*[}=]/,               // Ternary/grouped expressions
  /^[a-z_]+\s*\?\s*[a-z_]/i,         // Ternary conditions
  /^\s*[a-z_]+\s*&&\s*/i,            // Logical AND expressions
  /^\s*[a-z_]+\s*\|\|\s*/i,          // Logical OR expressions
  /^[=<>!]+\s*[a-z_]+/i,             // Comparison operators at start
  /^English$/,                       // Language name in native form
  /^Deutsch$/,                       // Language name in native form
  /^UTC$/,                           // Timezone abbreviation
  /^your@email\.com$/,               // Email placeholder example
];

// Attribute patterns to check for hardcoded text
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];

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
        // Skip excluded files
        if (!EXCLUDED_FILES.includes(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walk(dir);
  return files;
}

/**
 * Check if text is acceptable (doesn't need translation)
 */
function isAcceptableText(text: string): boolean {
  const trimmed = text.trim();
  
  // Empty or very short (single char, or 2 chars that aren't words)
  if (trimmed.length === 0) {
    return true;
  }
  
  // Single character or two characters that aren't meaningful words
  if (trimmed.length <= 2 && !/^[A-Z][a-z]$/.test(trimmed)) {
    return true;
  }
  
  // Check against acceptable patterns
  for (const pattern of ACCEPTABLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  // Check if it looks like code/expression (contains operators, parens, braces)
  if (/^[a-z_$][a-z0-9_$]*\s*[({=<>!&|?:]/i.test(trimmed)) {
    return true;
  }
  
  // Check if ends with } or contains => (arrow functions) or starts with code chars
  if (/[})\]]\s*$/.test(trimmed) || /=>/.test(trimmed)) {
    return true;
  }
  
  // Check if it starts with a number followed by code-like content
  if (/^\d+\s*[?&|}<>%]/.test(trimmed)) {
    return true;
  }
  
  // Check if it's primarily code-like (has more operators/parens than text)
  const codeChars = (trimmed.match(/[(){}[\]<>=!&|?:;,]/g) || []).length;
  const textChars = trimmed.length - codeChars;
  if (codeChars > textChars * 0.3 && trimmed.length > 5) {
    return true;
  }
  
  return false;
}

/**
 * Extract the template section from a Svelte file
 */
function extractTemplate(content: string): string {
  // Remove script tags
  let template = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove style tags
  template = template.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  return template;
}

/**
 * Find hardcoded text content between tags
 * Looking for patterns like: >Some Text< that don't use i18n
 */
function findHardcodedTextContent(template: string, filePath: string): string[] {
  const issues: string[] = [];
  
  // Match text content between > and < (or { for Svelte expressions)
  // This regex looks for: >text< where text is not empty and not a Svelte expression
  const textContentRegex = />([^<{]+)</g;
  let match;
  
  while ((match = textContentRegex.exec(template)) !== null) {
    const text = match[1];
    
    if (!isAcceptableText(text)) {
      // Get approximate line number
      const beforeMatch = template.substring(0, match.index);
      const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
      
      issues.push(`${filePath}:${lineNumber} - Hardcoded text: "${text.trim().substring(0, 50)}${text.trim().length > 50 ? '...' : ''}"`);
    }
  }
  
  return issues;
}

/**
 * Find hardcoded translatable attributes
 */
function findHardcodedAttributes(template: string, filePath: string): string[] {
  const issues: string[] = [];
  
  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    // Match attribute="value" where value is hardcoded (not a Svelte expression)
    const attrRegex = new RegExp(`${attr}="([^"{}$]+)"`, 'g');
    let match;
    
    while ((match = attrRegex.exec(template)) !== null) {
      const value = match[1];
      
      if (!isAcceptableText(value)) {
        const beforeMatch = template.substring(0, match.index);
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
        
        issues.push(`${filePath}:${lineNumber} - Hardcoded ${attr}: "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`);
      }
    }
  }
  
  return issues;
}

/**
 * Scan a Svelte file for hardcoded text
 */
function scanFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const template = extractTemplate(content);
  
  const issues: string[] = [];
  issues.push(...findHardcodedTextContent(template, filePath));
  issues.push(...findHardcodedAttributes(template, filePath));
  
  return issues;
}

describe('i18n hardcoded text detection', () => {
  const componentsDir = join(FRONTEND_SRC, 'components');
  const routesDir = join(FRONTEND_SRC, 'routes');
  
  it('should not have hardcoded text in components', () => {
    const files = getSvelteFiles(componentsDir);
    const allIssues: string[] = [];
    
    for (const file of files) {
      const issues = scanFile(file);
      allIssues.push(...issues);
    }
    
    if (allIssues.length > 0) {
      console.error('\n=== Hardcoded text found in components ===\n');
      allIssues.forEach(issue => console.error(issue));
      console.error('\n');
    }
    
    expect(allIssues).toEqual([]);
  });
  
  it('should not have hardcoded text in routes', () => {
    const files = getSvelteFiles(routesDir);
    const allIssues: string[] = [];
    
    for (const file of files) {
      const issues = scanFile(file);
      allIssues.push(...issues);
    }
    
    if (allIssues.length > 0) {
      console.error('\n=== Hardcoded text found in routes ===\n');
      allIssues.forEach(issue => console.error(issue));
      console.error('\n');
    }
    
    expect(allIssues).toEqual([]);
  });
});
