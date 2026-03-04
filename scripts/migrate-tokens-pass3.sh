#!/usr/bin/env bash
# Design Token Migration - Pass 3
# Handles #fff shorthand and remaining stragglers
PLUGIN_DIR="/Users/muzammil/Sites/themes/1/wp/wp-content/plugins/subtleforms"

FILES=$(find "$PLUGIN_DIR/resources/admin" -name '*.scss' \
  ! -name '_variables.scss' \
  ! -name '_design-system.scss' \
  ! -name '_accessibility.scss')

echo "Migrating $(echo "$FILES" | wc -l | tr -d ' ') SCSS files (pass 3)..."

echo "$FILES" | xargs sed -i '' \
  -e 's/#fff;/var(--sf-surface);/g' \
  -e 's/#fff,/var(--sf-surface),/g' \
  -e 's/#2563eb/var(--sf-blue-600)/g' \
  -e 's/#dc2626/var(--sf-red-600)/g' \
  -e 's/#ffffff/var(--sf-surface)/g' \
  -e 's/#9ca3af/var(--sf-gray-400)/g' \
  -e 's/#6b7280/var(--sf-gray-500)/g' \
  -e 's/#059669/var(--sf-emerald-600)/g' \
  -e 's/#ef4444/var(--sf-red-500)/g' \
  -e 's/#4b5563/var(--sf-gray-600)/g' \
  -e 's/#34d399/var(--sf-emerald-400)/g' \
  -e 's/#1d4ed8/var(--sf-blue-700)/g' \
  -e 's/#1d2327/var(--wp-dark)/g' \
  -e 's/#fde047/var(--sf-yellow-400)/g' \
  -e 's/#f87171/var(--sf-coral-500)/g' \
  -e 's/#f1f5f9/var(--sf-slate-100)/g' \
  -e 's/#fafafb/var(--sf-gray-50)/g' \
  -e 's/#facc15/var(--sf-yellow-400)/g' \
  -e 's/#f9fafb/var(--sf-gray-50)/g' \
  -e 's/#f97316/var(--sf-orange-500)/g' \
  -e 's/#fff8e5/var(--sf-amber-50)/g' \
  -e 's/#fefce8/var(--sf-amber-50)/g' \
  -e 's/#a7aaad/var(--sf-gray-400)/g' \
  -e 's/#9aa4b2/var(--sf-slate-400)/g' \
  -e 's/#666/var(--sf-gray-500)/g' \
  -e 's/#ddd/var(--sf-gray-300)/g'

echo "Pass 3 complete."
echo ""
echo "Remaining hex values in component files:"
grep -rhoE '#[0-9a-fA-F]{3,8}' "$PLUGIN_DIR/resources/admin/" --include='*.scss' \
  --exclude='_variables.scss' --exclude='_design-system.scss' --exclude='_accessibility.scss' \
  2>/dev/null | sort | uniq -c | sort -rn | head -30
echo ""
TOTAL=$(grep -rhoE '#[0-9a-fA-F]{3,8}' "$PLUGIN_DIR/resources/admin/" --include='*.scss' \
  --exclude='_variables.scss' --exclude='_design-system.scss' --exclude='_accessibility.scss' \
  2>/dev/null | wc -l | tr -d ' ')
echo "Total remaining instances: $TOTAL"
