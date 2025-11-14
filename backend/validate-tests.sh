#!/bin/bash

# Validate tests without running them (no database required)
# This checks TypeScript compilation and syntax

echo "🔍 Validating test files..."

# Check if TypeScript compiler is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and dependencies."
    exit 1
fi

# Run TypeScript compiler in no-emit mode (just checks, doesn't generate files)
echo "📝 Checking TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Check if test files exist
echo "📁 Checking test files..."
TEST_DIR="src/__tests__"
if [ ! -d "$TEST_DIR" ]; then
    echo "❌ Test directory not found: $TEST_DIR"
    exit 1
fi

TEST_FILES=$(find "$TEST_DIR" -name "*.test.ts" -o -name "*.spec.ts")
if [ -z "$TEST_FILES" ]; then
    echo "⚠️  No test files found"
    exit 1
fi

echo "✅ Found test files:"
echo "$TEST_FILES" | while read file; do
    echo "  - $file"
done

# Check test configuration
echo "⚙️  Checking test configuration..."
if [ ! -f "vitest.config.ts" ]; then
    echo "❌ vitest.config.ts not found"
    exit 1
fi
echo "✅ Test configuration found"

# Summary
echo ""
echo "✅ All validation checks passed!"
echo ""
echo "📌 Note: To run tests, you need:"
echo "   1. PostgreSQL database running"
echo "   2. Proper environment variables set"
echo "   3. Run: npm test"
echo ""
echo "   See backend/src/__tests__/README.md for details"

exit 0
