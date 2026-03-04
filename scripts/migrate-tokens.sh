#!/bin/bash
# Bulk replace hardcoded hex colors with CSS custom properties
# Only applies to SCSS files, excluding token definition files

set -e

SCSS_FILES=$(find resources/admin -name '*.scss' | grep -v '_variables.scss' | grep -v '_design-system.scss' | grep -v '_accessibility.scss')

do_replace() {
  local old="$1"
  local new="$2"
  echo "$SCSS_FILES" | while IFS= read -r f; do
    if [ -f "$f" ]; then
      sed -i '' "s/${old}/${new}/g" "$f" 2>/dev/null || true
    fi
  done
}

echo "Migrating grays..."
do_replace '#f9fafb' 'var(--sf-gray-50)'
do_replace '#f3f4f6' 'var(--sf-gray-100)'
do_replace '#e5e7eb' 'var(--sf-gray-200)'
do_replace '#d1d5db' 'var(--sf-gray-300)'
do_replace '#9ca3af' 'var(--sf-gray-400)'
do_replace '#6b7280' 'var(--sf-gray-500)'
do_replace '#4b5563' 'var(--sf-gray-600)'
do_replace '#374151' 'var(--sf-gray-700)'
do_replace '#1f2937' 'var(--sf-gray-800)'
do_replace '#111827' 'var(--sf-gray-900)'

echo "Migrating blues..."
do_replace '#eff6ff' 'var(--sf-blue-50)'
do_replace '#dbeafe' 'var(--sf-blue-100)'
do_replace '#bfdbfe' 'var(--sf-blue-200)'
do_replace '#3b82f6' 'var(--sf-blue-500)'
do_replace '#2563eb' 'var(--sf-blue-600)'
do_replace '#1d4ed8' 'var(--sf-blue-700)'
do_replace '#1e40af' 'var(--sf-blue-800)'
do_replace '#1e3a8a' 'var(--sf-blue-900)'

echo "Migrating reds..."
do_replace '#ef4444' 'var(--sf-red-500)'
do_replace '#dc2626' 'var(--sf-red-600)'

echo "Migrating greens..."
do_replace '#f0fdf4' 'var(--sf-green-50)'
do_replace '#22c55e' 'var(--sf-green-500)'
do_replace '#16a34a' 'var(--sf-green-600)'
do_replace '#10b981' 'var(--sf-emerald-500)'
do_replace '#059669' 'var(--sf-emerald-600)'
do_replace '#34d399' 'var(--sf-emerald-400)'

echo "Migrating ambers/warnings..."
do_replace '#fef3c7' 'var(--sf-amber-100)'
do_replace '#f59e0b' 'var(--sf-amber-500)'
do_replace '#92400e' 'var(--sf-amber-800)'
do_replace '#faf5ff' 'var(--sf-purple-50)'
do_replace '#eef2ff' 'var(--sf-indigo-50)'

echo "Migrating WordPress colors..."
do_replace '#646970' 'var(--sf-wp-gray)'
do_replace '#2271b1' 'var(--sf-wp-blue)'
do_replace '#0073aa' 'var(--sf-wp-blue)'
do_replace '#f0f0f1' 'var(--sf-wp-surface)'
do_replace '#f0f0f0' 'var(--sf-wp-surface)'
do_replace '#1e1e1e' 'var(--sf-gray-900)'

echo "Migrating whites..."
do_replace '#ffffff' 'var(--sf-surface)'
do_replace '#fff;' 'var(--sf-surface);'
do_replace '#fafafa' 'var(--sf-surface-sunken)'

echo "Done. Remaining hex values:"
grep -rnE '#[0-9a-fA-F]{3,8}' resources/admin/ --include='*.scss' | grep -v '_variables.scss' | grep -v '_design-system.scss' | grep -v '_accessibility.scss' | wc -l
