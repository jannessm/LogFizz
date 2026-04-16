# PDF Import Test Script

This script helps test and develop the PDF import functionality for the frontend timelog import feature.

## Installation

The required dependencies are already added to `package.json`:
- `pdfjs-dist` - PDF parsing library (Mozilla's PDF.js)
- `tsx` - TypeScript execution

## Usage

```bash
# Test with the default PDF in test data
npm run test:pdf-import

# Test with a specific PDF file
npm run test:pdf-import -- /path/to/your/file.pdf
```

## What it does

1. **Extracts text from PDF** - Uses pdfjs-dist to extract text content from PDF files
2. **Parses table structure** - Attempts to identify timesheet rows with date/time patterns
3. **Outputs structured data** - Shows parsed rows with dates and times
4. **Saves JSON output** - Creates `scripts/pdf-test-output.json` with full details

## Output

The script displays:
- Raw extracted text (first 2000 characters)
- Parsed rows with date, start time, end time
- Summary statistics
- Full JSON output file path

## PDF Format Support

The script is designed to work with German timesheet PDFs (Monatsliste format) that have:
- Date format: `DD.MM.` (e.g., `01.09.`)
- Time format: `HH:MM` (e.g., `08:00`)
- Day names: `Mo`, `Di`, `Mi`, `Do`, `Fr`, `Sa`, `So`

Common patterns detected:
```
Date   Day  TM  von   bis   von   bis   Brutto  Netto  Soll
01.09. Mo   1   07:46 12:36 13:19 15:17 6:48    6:48   6:36
```

Where:
- **von/bis** columns 1-2: Arrival and break start
- **von/bis** columns 3-4: Break end and departure
- **Brutto/Netto**: Gross and net working time
- **Soll**: Target working time

## Limitations

- Basic PDF text extraction (works best with text-based PDFs, not scanned images)
- Pattern matching is tailored for German Monatsliste format
- Some complex PDF layouts may not parse correctly

## Development

To improve the PDF parsing:

1. Add your test PDF to `/frontend/src/test/testdata/`
2. Run the script to see the raw extracted text
3. Update the parsing patterns in `scripts/test-pdf-import.ts`
4. Test again until the output matches your expectations

The parsed structure can then be used to enhance the frontend import modal's PDF handling.

## Files

- **scripts/test-pdf-import.ts** - Main test script
- **scripts/pdf-test-output.json** - Generated output file (git-ignored)
- **src/test/testdata/*.pdf** - Test PDF files

## Example Output

```
🔍 PDF Import Test Script

📁 Reading PDF: Monatsliste_2025_09_Magnusson_Jannes_10040255.pdf
   Path: /home/coder/logfizz/frontend/src/test/testdata/Monatsliste_2025_09_Magnusson_Jannes_10040255.pdf

📄 Raw extracted text (first 2000 chars):
────────────────────────────────────────────────────────────────────────────────
gedruckt am: 01.12.2025 08:45 Uhr  Monatsliste   Mitarbeiter: ...
────────────────────────────────────────────────────────────────────────────────

✅ Successfully parsed 15 row(s) from PDF:

────────────────────────────────────────────────────────────────────────────────
Row 1:
  Date:        01.09.
  Start Time:  07:46
  End Time:    15:17
  ...

📊 Summary:
   Total rows extracted: 15
   Rows with date: 15
   Rows with start time: 15
   Rows with end time: 15

💾 Full output saved to: /path/to/scripts/pdf-test-output.json

✨ Test complete!
```
