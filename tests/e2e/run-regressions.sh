#!/bin/bash

# Phase 6 QA Gate - Regression Test Execution Script
# Runs all priority regression tests and captures results

PLUGIN_DIR="/Users/muzammil/Sites/themes/1/wp/wp-content/plugins/subtleforms"

cd "$PLUGIN_DIR"

echo "=========================================="
echo "Phase 6 QA Gate - Regression Test Suite"
echo "=========================================="
echo ""
echo "Running all regression tests..."
echo ""

# Run all regression tests together to generate a single comprehensive report
npx playwright test tests/e2e/regression-step-rename.spec.js tests/e2e/regression-autosubmit.spec.js tests/e2e/regression-styling.spec.js tests/e2e/regression-submissions-badge.spec.js --reporter=html,list

echo ""
echo "=========================================="
echo "Test Execution Complete"
echo "=========================================="
echo ""
echo "View HTML report:"
echo "  npx playwright show-report"
echo ""
echo "Or open directly:"
echo "  open playwright-report/index.html"
