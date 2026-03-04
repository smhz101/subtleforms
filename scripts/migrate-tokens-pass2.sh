#!/usr/bin/env bash
# Design Token Migration - Pass 2
# Maps all remaining hardcoded hex values to CSS custom properties
set -e

PLUGIN_DIR="/Users/muzammil/Sites/themes/1/wp/wp-content/plugins/subtleforms"

FILES=$(find "$PLUGIN_DIR/resources/admin" -name '*.scss' \
  ! -path '*/_variables.scss' \
  ! -path '*/_design-system.scss' \
  ! -path '*/_accessibility.scss')

echo "Migrating $(echo "$FILES" | wc -l | tr -d ' ') SCSS files..."

echo "$FILES" | xargs sed -i '' \
  -e 's/#3b82f6/var(--sf-blue-500)/g' \
  -e 's/#ffffff/var(--sf-surface)/g' \
  -e 's/#111827/var(--sf-gray-900)/g' \
  -e 's/#6b7280/var(--sf-gray-500)/g' \
  -e 's/#2563eb/var(--sf-blue-600)/g' \
  -e 's/#4b5563/var(--sf-gray-600)/g' \
  -e 's/#eff6ff/var(--sf-blue-50)/g' \
  -e 's/#374151/var(--sf-gray-700)/g' \
  -e 's/#dc2626/var(--sf-red-600)/g' \
  -e 's/#2271b1/var(--wp-blue-500)/g' \
  -e 's/#1f2937/var(--sf-gray-800)/g' \
  -e 's/#fafafa/var(--sf-neutral-50)/g' \
  -e 's/#bfdbfe/var(--sf-blue-200)/g' \
  -e 's/#646970/var(--wp-gray-50)/g' \
  -e 's/#f0f0f1/var(--sf-gray-100)/g' \
  -e 's/#1e1e1e/var(--sf-slate-900)/g' \
  -e 's/#1e40af/var(--sf-blue-800)/g' \
  -e 's/#059669/var(--sf-emerald-600)/g' \
  -e 's/#ef4444/var(--sf-red-500)/g' \
  -e 's/#16a34a/var(--sf-green-600)/g' \
  -e 's/#0073aa/var(--wp-blue-link)/g' \
  -e 's/#fef3c7/var(--sf-amber-100)/g' \
  -e 's/#f0fdf4/var(--sf-green-50)/g' \
  -e 's/#dbeafe/var(--sf-blue-100)/g' \
  -e 's/#92400e/var(--sf-amber-800)/g' \
  -e 's/#64748b/var(--sf-slate-500)/g' \
  -e 's/#1e3a8a/var(--sf-blue-900)/g' \
  -e 's/#0f172a/var(--sf-slate-900)/g' \
  -e 's/#faf5ff/var(--sf-purple-50)/g' \
  -e 's/#1d4ed8/var(--sf-blue-700)/g' \
  -e 's/#10b981/var(--sf-emerald-500)/g' \
  -e 's/#f59e0b/var(--sf-amber-500)/g' \
  -e 's/#eef2ff/var(--sf-indigo-50)/g' \
  -e 's/#fffbeb/var(--sf-amber-50)/g' \
  -e 's/#fef2f2/var(--sf-red-50)/g' \
  -e 's/#fee2e2/var(--sf-red-100)/g' \
  -e 's/#f0f0f0/var(--sf-neutral-100)/g' \
  -e 's/#eef2f7/var(--sf-slate-50)/g' \
  -e 's/#e2e8f0/var(--sf-slate-200)/g' \
  -e 's/#dcdcde/var(--wp-gray-30)/g' \
  -e 's/#8c8f94/var(--sf-gray-400)/g' \
  -e 's/#7c3aed/var(--sf-violet-600)/g' \
  -e 's/#4f9cf9/var(--sf-blue-500)/g' \
  -e 's/#4f46e5/var(--sf-indigo-600)/g' \
  -e 's/#135e96/var(--wp-blue-600)/g' \
  -e 's/#f8fafc/var(--sf-slate-50)/g' \
  -e 's/#f5f5f5/var(--sf-neutral-100)/g' \
  -e 's/#e9d5ff/var(--sf-purple-200)/g' \
  -e 's/#c7d2fe/var(--sf-indigo-200)/g' \
  -e 's/#bbf7d0/var(--sf-green-100)/g' \
  -e 's/#9ca3af/var(--sf-gray-400)/g' \
  -e 's/#93c5fd/var(--sf-blue-200)/g' \
  -e 's/#6366f1/var(--sf-indigo-500)/g' \
  -e 's/#46b450/var(--wp-green-hover)/g' \
  -e 's/#005a87/var(--wp-blue-700)/g' \
  -e 's/#f87171/var(--sf-coral-500)/g' \
  -e 's/#f6f7f7/var(--sf-neutral-50)/g' \
  -e 's/#f0b849/var(--sf-amber-500)/g' \
  -e 's/#ea580c/var(--sf-orange-600)/g' \
  -e 's/#e8e8e9/var(--sf-gray-200)/g' \
  -e 's/#e0e7ff/var(--sf-indigo-100)/g' \
  -e 's/#e0e0e0/var(--sf-neutral-200)/g' \
  -e 's/#dc3232/var(--sf-red-600)/g' \
  -e 's/#d1fae5/var(--sf-green-100)/g' \
  -e 's/#cbd5e1/var(--sf-slate-300)/g' \
  -e 's/#a8a29e/var(--sf-stone-400)/g' \
  -e 's/#9333ea/var(--sf-purple-600)/g' \
  -e 's/#8b5cf6/var(--sf-violet-500)/g' \
  -e 's/#854d0e/var(--sf-yellow-800)/g' \
  -e 's/#757575/var(--sf-neutral-500)/g' \
  -e 's/#50575e/var(--wp-gray-70)/g' \
  -e 's/#4338ca/var(--sf-indigo-700)/g' \
  -e 's/#34d399/var(--sf-emerald-400)/g' \
  -e 's/#334155/var(--sf-slate-700)/g' \
  -e 's/#22c55e/var(--sf-green-500)/g' \
  -e 's/#00a32a/var(--wp-green)/g' \
  -e 's/#00a0d2/var(--wp-blue-light)/g' \
  -e 's/#005177/var(--wp-blue-800)/g' \
  -e 's/#dba617/var(--sf-amber-600)/g' \
  -e 's/#d97706/var(--sf-amber-600)/g' \
  -e 's/#fb923c/var(--sf-coral-400)/g' \
  -e 's/#f97316/var(--sf-orange-500)/g' \
  -e 's/#fde68a/var(--sf-yellow-400)/g' \
  -e 's/#eab308/var(--sf-yellow-500)/g' \
  -e 's/#f3e8ff/var(--sf-purple-100)/g' \
  -e 's/#ede9fe/var(--sf-violet-100)/g' \
  -e 's/#ddd6fe/var(--sf-violet-200)/g' \
  -e 's/#c4b5fd/var(--sf-violet-300)/g' \
  -e 's/#a855f7/var(--sf-purple-500)/g' \
  -e 's/#6d28d9/var(--sf-violet-700)/g' \
  -e 's/#7e22ce/var(--sf-purple-700)/g' \
  -e 's/#4c1d95/var(--sf-violet-900)/g' \
  -e 's/#581c87/var(--sf-purple-900)/g' \
  -e 's/#312e81/var(--sf-indigo-900)/g' \
  -e 's/#4c1d95/var(--sf-violet-900)/g' \
  -e 's/#e0e7ff/var(--sf-indigo-100)/g' \
  -e 's/#f3f4f6/var(--sf-gray-100)/g' \
  -e 's/#d1d5db/var(--sf-gray-300)/g' \
  -e 's/#f5f3ff/var(--sf-violet-50)/g' \
  -e 's/#14b8a6/var(--sf-teal-500)/g' \
  -e 's/#475569/var(--sf-slate-600)/g' \
  -e 's/#1e293b/var(--sf-slate-800)/g' \
  -e 's/#94a3b8/var(--sf-slate-400)/g' \
  -e 's/#e5e7eb/var(--sf-gray-200)/g' \
  -e 's/#f9fafb/var(--sf-gray-50)/g' \
  -e 's/#a7aaad/var(--sf-gray-400)/g' \
  -e 's/#1d2327/var(--wp-dark)/g' \
  -e 's/#996800/var(--wp-orange)/g' \
  -e 's/#fcf3cd/var(--wp-orange-bg)/g' \
  -e 's/#fafaf9/var(--sf-stone-50)/g' \
  -e 's/#f5f5f4/var(--sf-stone-100)/g' \
  -e 's/#e7e5e4/var(--sf-stone-200)/g' \
  -e 's/#d6d3d1/var(--sf-stone-300)/g' \
  -e 's/#78716c/var(--sf-stone-500)/g' \
  -e 's/#57534e/var(--sf-stone-600)/g' \
  -e 's/#44403c/var(--sf-stone-700)/g' \
  -e 's/#292524/var(--sf-stone-800)/g' \
  -e 's/#1c1917/var(--sf-stone-900)/g' \
  -e 's/#f7fee7/var(--sf-lime-50)/g' \
  -e 's/#ecfccb/var(--sf-lime-100)/g' \
  -e 's/#d9f99d/var(--sf-lime-200)/g' \
  -e 's/#bef264/var(--sf-lime-300)/g' \
  -e 's/#a3e635/var(--sf-lime-400)/g' \
  -e 's/#84cc16/var(--sf-lime-500)/g' \
  -e 's/#65a30d/var(--sf-lime-600)/g' \
  -e 's/#4d7c0f/var(--sf-lime-700)/g' \
  -e 's/#365314/var(--sf-lime-900)/g' \
  -e 's/#000000/var(--sf-gray-900)/g'

echo "Pass 2 complete."
echo ""
echo "Remaining hex values:"
grep -rhoE '#[0-9a-fA-F]{3,8}' "$PLUGIN_DIR/resources/admin/" --include='*.scss' 2>/dev/null \
  | sort | uniq -c | sort -rn | head -30
