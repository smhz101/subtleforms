import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { requirePro } from '../../utils/featureGate';
import { formatRate } from './useAnalytics';
import './analytics.scss';

/**
 * Forms list "Performance" cell: conversion rate, views and submissions over
 * the last 30 days.
 *
 * @param {Object}  props
 * @param {Object}  props.stats  { views, submissions, conversion } or undefined.
 * @param {boolean} props.locked Analytics not in the plan.
 * @param {boolean} props.loading Summary still loading.
 */
export default function PerformanceCell({ stats, locked, loading }) {
  if (locked) {
    return (
      <button
        type='button'
        className='sf-perf sf-perf--locked'
        onClick={(e) => {
          e.stopPropagation();
          requirePro('extensions.analytics', () => {}, { label: __('Analytics', 'subtleforms') });
        }}
        title={__('Views and conversion rate are part of SubtleForms Pro', 'subtleforms')}>
        <Icon.Lock size={12} aria-hidden='true' />
        {__('Pro', 'subtleforms')}
      </button>
    );
  }

  if (loading) {
    return <span className='sf-perf'>…</span>;
  }

  const views = stats?.views || 0;
  const submissions = stats?.submissions || 0;
  const rate = stats?.conversion ?? null;

  return (
    <span
      className='sf-perf'
      title={sprintf(
        /* translators: 1: views, 2: submissions */
        __('Last 30 days: %1$s views, %2$s submissions', 'subtleforms'),
        views.toLocaleString(),
        submissions.toLocaleString()
      )}>
      <span className='sf-perf__rate'>{formatRate(rate)}</span>
      <span>
        {sprintf(
          /* translators: 1: views, 2: submissions */
          __('%1$s views · %2$s sent', 'subtleforms'),
          views.toLocaleString(),
          submissions.toLocaleString()
        )}
      </span>
      {rate !== null && (
        <span className='sf-perf__meter' aria-hidden='true'>
          <span style={{ width: `${Math.min(100, rate)}%` }} />
        </span>
      )}
    </span>
  );
}
