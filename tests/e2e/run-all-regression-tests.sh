#!/bin/bash

# Run all regression tests with proper settings
cd "$(dirname "$0")/../.."

echo "🧪 Running Phase 6 QA Gate - All Regression Tests"
echo "=================================================="
echo ""

# Run all regression tests together for unified report
npx playwright test \
  tests/e2e/regression-step-rename.spec.js \
  tests/e2e/regression-autosubmit.spec.js \
  tests/e2e/regression-styling.spec.js \
  tests/e2e/regression-submissions-badge.spec.js \
  --reporter=html,list \
  --timeout=90000 \
  --workers=1

EXIT_CODE=$?

echo ""
echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All tests passed!"
else
  echo "❌ Some tests failed (exit code: $EXIT_CODE)"
fi
echo "=================================================="
echo ""
echo "📊 View detailed HTML report:"
echo "   npx playwright show-report"
echo ""
echo "   Or open directly:"
echo "   open playwright-report/index.html"
echo ""

exit $EXIT_CODE
