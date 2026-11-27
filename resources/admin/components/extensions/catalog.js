/**
 * Pure helpers for the Extensions page: ordering, filtering, grouping and
 * the local "Recommended for this site" rule. No requests, no React.
 */
import { __ } from '@wordpress/i18n';

export const PLANS = ['free', 'starter', 'pro', 'agency'];

export const getPlanLabels = () => ({
  free: __('Free', 'subtleforms'),
  starter: __('Starter', 'subtleforms'),
  pro: __('Pro', 'subtleforms'),
  agency: __('Agency', 'subtleforms'),
});

export const getCategoryBlurbs = () => ({
  payments: __('Take payments and sell from your forms.', 'subtleforms'),
  integrations: __('Send entries to the tools you already use.', 'subtleforms'),
  fields: __('More ways to ask and answer.', 'subtleforms'),
  entries: __('Do more with what people send.', 'subtleforms'),
  site: __('Run SubtleForms your way.', 'subtleforms'),
});

const RANK = { active: 0, update: 0, available: 1, installed: 2, included: 3, locked: 4 };

export function sortEntries(entries) {
  return [...entries].sort(
    (a, b) =>
      (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) ||
      (a.status === 'locked' ? PLANS.indexOf(a.plan) - PLANS.indexOf(b.plan) : 0) ||
      a.title.localeCompare(b.title)
  );
}

export function matchesQuery(entry, query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return `${entry.title} ${entry.description}`.toLowerCase().includes(q);
}

/** The plan the site already has: the highest plan with an unlocked paid entry. */
function currentPlan(entries) {
  let top = 0;
  entries.forEach((e) => {
    if (e.status !== 'locked') {
      top = Math.max(top, PLANS.indexOf(e.plan));
    }
  });
  return top;
}

/**
 * Up to three entries: WooCommerce first on a WooCommerce site, then what can
 * be installed or updated, then locked entries of the next plan up.
 */
export function recommend(entries, wooActive) {
  const picked = [];
  const add = (e) => {
    if (e && picked.length < 3 && !picked.includes(e)) {
      picked.push(e);
    }
  };
  if (wooActive) {
    add(entries.find((e) => e.category === 'payments' && /woocommerce/i.test(e.slug)));
  }
  sortEntries(entries)
    .filter((e) => e.status === 'available' || e.status === 'update')
    .forEach(add);
  const next = PLANS[currentPlan(entries) + 1];
  sortEntries(entries)
    .filter((e) => e.status === 'locked' && e.plan === next)
    .forEach(add);
  return picked;
}
