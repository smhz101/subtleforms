#!/bin/bash

# Ensure we're using Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Prefer Node 20 when nvm is available, but don't require it — CI images and
# system installs already provide a suitable Node.
nvm use 20 2>/dev/null || echo "ℹ️  nvm not in use; running on the ambient Node."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node 20 or newer is required (found $(node --version 2>/dev/null || echo 'none'))."
  exit 1
fi

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
