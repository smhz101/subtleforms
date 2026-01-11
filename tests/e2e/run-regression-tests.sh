#!/bin/bash

# Ensure we're using Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Switch to Node 20
nvm use 20 2>/dev/null || {
  echo "⚠️  Node 20 not found. Please install it with: nvm install 20"
  exit 1
}

echo "✅ Using Node $(node --version)"
echo ""

# Navigate to plugin directory
cd "$(dirname "$0")/../.."

# Run regression tests
echo "🧪 Running Phase 6 QA Gate - All Regression Tests"
echo "=================================================="
echo ""

npm run test:regression

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

exit $EXIT_CODE
