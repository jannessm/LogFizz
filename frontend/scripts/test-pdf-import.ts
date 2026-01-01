#!/usr/bin/env node
/**
 * PDF Import Test Script
 * 
 * This script tests PDF data extraction for the frontend PDF import feature.
 * Run with: npm run test:pdf-import
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PDFRow {
  date?: string;
  startTime?: string;
  endTime?: string;
  project?: string;
  description?: string;
  duration?: string;
}

/**
 * Basic PDF text extraction
 * This is a simplified version for testing purposes
 */
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  try {
    // Try to use pdfjs-dist if available
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error using pdfjs-dist:', error);
    console.log('\nFalling back to basic text extraction...\n');
    
    // Fallback: basic text extraction
    return extractTextBasic(pdfPath);
  }
}

/**
 * Basic fallback text extraction from PDF
 */
function extractTextBasic(pdfPath: string): string {
  const buffer = fs.readFileSync(pdfPath);
  const decoder = new TextDecoder('latin1');
  const rawText = decoder.decode(buffer);
  
  // Look for text streams in PDF
  const textMatches = rawText.match(/\(([^)]+)\)/g);
  if (textMatches) {
    return textMatches
      .map(m => m.slice(1, -1))
      .filter(t => t.trim().length > 0)
      .join(' ');
  }
  
  return rawText;
}

/**
 * Parse PDF text into structured table data
 */
function parseTableData(text: string): PDFRow[] {
  console.log('📄 Raw extracted text (first 2000 chars):');
  console.log('─'.repeat(80));
  console.log(text.substring(0, 2000));
  if (text.length > 2000) {
    console.log(`\n... and ${text.length - 2000} more characters`);
  }
  console.log('─'.repeat(80));
  console.log();
  
  // Try to identify table structure
  const rows: PDFRow[] = [];
  
  // Look for date pattern: DD.MM. followed by day name (Mo, Di, Mi, etc.)
  // Example: "01.09.   Mo   1   07:46   12:36   13:19   15:17   6:48   6:48   6:36"
  // The format is: Date Day TM von bis von bis Brutto Netto Soll...
  // We want the 4 "von/bis" times (enter, break_start, break_end, leave)
  const rowPattern = /(\d{1,2}\.\d{1,2}\.)\s+(Mo|Di|Mi|Do|Fr|Sa|So)\s+\d+\s+((?:[\d:*G]+\s+){4,})/g;
  
  let match;
  while ((match = rowPattern.exec(text)) !== null) {
    const date = match[1];
    const dayName = match[2];
    const timesSection = match[3];
    
    // Extract times from the section (looking for HH:MM format only)
    const times = timesSection.match(/\d{1,2}:\d{2}/g);
    
    if (times && times.length >= 4) {
      // Filter out 0:00 entries (usually indicate no work)
      if (times[0] === '0:00' || times[3] === '0:00') {
        continue;
      }
      
      // In German timesheet format:
      // Position 0: Arrival time (von)
      // Position 1: Break start (bis) 
      // Position 2: Break end (von)
      // Position 3: Departure time (bis)
      // Then come durations and other data
      const row: PDFRow = {
        date,
        startTime: times[0], // First time is arrival
        endTime: times[3], // Fourth time is departure (after break)
      };
      
      rows.push(row);
    } else if (times && times.length === 2) {
      // Some entries might only have start and end (no break)
      if (times[0] === '0:00' || times[1] === '0:00') {
        continue;
      }
      
      rows.push({
        date,
        startTime: times[0],
        endTime: times[1],
      });
    }
  }
  
  // If no matches with the strict pattern, try a more lenient approach
  if (rows.length === 0) {
    console.log('⚠️  Trying lenient parsing mode...\n');
    
    // Try to find any date followed by times
    const lenientPattern = /(\d{1,2}\.\d{1,2}\.)\s+\w+\s+.*?(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/g;
    
    while ((match = lenientPattern.exec(text)) !== null) {
      const date = match[1];
      const startTime = match[2];
      const endTime = match[3];
      
      // Skip 0:00 entries
      if (startTime === '0:00' || endTime === '0:00') {
        continue;
      }
      
      rows.push({ date, startTime, endTime });
    }
  }
  
  return rows;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 PDF Import Test Script\n');
  
  // Look for test PDF files
  const testDataDir = path.join(__dirname, '../src/test/testdata');
  const pdfFiles = fs.existsSync(testDataDir) 
    ? fs.readdirSync(testDataDir).filter(f => f.endsWith('.pdf'))
    : [];
  
  if (pdfFiles.length === 0) {
    console.error('❌ No PDF files found in test data directory');
    console.log(`   Expected location: ${testDataDir}`);
    console.log('\n💡 Add a PDF file to test or specify a path as an argument:');
    console.log('   npm run test:pdf-import -- /path/to/file.pdf');
    process.exit(1);
  }
  
  // Use provided path or first test file
  const pdfPath = process.argv[2] || path.join(testDataDir, pdfFiles[0]);
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF file not found: ${pdfPath}`);
    process.exit(1);
  }
  
  console.log(`📁 Reading PDF: ${path.basename(pdfPath)}`);
  console.log(`   Path: ${pdfPath}\n`);
  
  // Extract text
  const text = await extractTextFromPDF(pdfPath);
  
  if (!text || text.trim().length === 0) {
    console.error('❌ No text extracted from PDF');
    console.log('\n💡 This PDF might be:');
    console.log('   • Scanned (image-based)');
    console.log('   • Encrypted');
    console.log('   • In an unsupported format');
    process.exit(1);
  }
  
  // Parse into table data
  const rows = parseTableData(text);
  
  if (rows.length === 0) {
    console.error('❌ No table data found in PDF');
    console.log('\n💡 The PDF text was extracted but could not be parsed into table rows.');
    console.log('   Check the raw extracted text above.');
    process.exit(1);
  }
  
  // Display results
  console.log(`\n✅ Successfully parsed ${rows.length} row(s) from PDF:\n`);
  console.log('─'.repeat(80));
  
  rows.forEach((row, i) => {
    console.log(`Row ${i + 1}:`);
    console.log(`  Date:        ${row.date || '(not found)'}`);
    console.log(`  Start Time:  ${row.startTime || '(not found)'}`);
    console.log(`  End Time:    ${row.endTime || '(not found)'}`);
    console.log(`  Project:     ${row.project || '(not found)'}`);
    console.log(`  Duration:    ${row.duration || '(not found)'}`);
    console.log(`  Description: ${row.description || '(not found)'}`);
    console.log();
  });
  
  console.log('─'.repeat(80));
  console.log('\n📊 Summary:');
  console.log(`   Total rows extracted: ${rows.length}`);
  console.log(`   Rows with date: ${rows.filter(r => r.date).length}`);
  console.log(`   Rows with start time: ${rows.filter(r => r.startTime).length}`);
  console.log(`   Rows with end time: ${rows.filter(r => r.endTime).length}`);
  console.log(`   Rows with project: ${rows.filter(r => r.project).length}`);
  
  // Export as JSON for further inspection
  const outputPath = path.join(__dirname, 'pdf-test-output.json');
  fs.writeFileSync(outputPath, JSON.stringify({ rows, rawText: text }, null, 2));
  console.log(`\n💾 Full output saved to: ${outputPath}`);
  
  console.log('\n✨ Test complete!');
}

// Run
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
