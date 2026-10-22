import { useEffect, useState } from '@wordpress/element';
import { Button, SelectControl, Spinner, TextControl } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useFunnel } from './useAnalytics';
import { performanceFormOptions } from './FormAnalyticsPanel';
import {
  FUNNEL_PRESETS,
  FUNNEL_SETTINGS_URL,
  completionRate,
  dropHint,
  fieldName,
  formatShare,
  funnelSentence,
  funnelStages,
  isEmptyReport,
  share,
  stepName,
} from './funnelModel';
import './analytics.scss';

const fmt = (n) => Number(n || 0).toLocaleString();

/**
 * Options for the funnel form selector: every form, no "All forms" entry.
 *
 * @param {Array}  forms Forms ({ id, title }).
 * @param {string} query Filter.
 * @return {Array<{label:string,value:string}>}
 */
export function funnelFormOptions(forms, query = '') {
  return performanceFormOptions(forms, query).filter((option) => option.value !== '0');
}

/**
 * Reports panel: Seen, Started and Submitted for one form, and the fields
 * where people left without sending it (2.6.0).
 *
 * @param {Object} props
 * @param {Array}  props.forms Every non-trashed form ({ id, title }).
 */
export default function FunnelPanel({ forms = [] }) {
  const [formId, setFormId] = useState(0);
  const [query, setQuery] = useState('');
  const [days, setDays] = useState(30);

  // Start on the first form; keep the choice while the list loads.
  useEffect(() => {
    if (!formId && forms.length > 0) {
      setFormId(Number(forms[0].id));
    }
  }, [forms, formId]);

  const { data, isLoading, error } = useFunnel(formId, days);
  const options = funnelFormOptions(forms, query);

  return (
    <section className='sf-panel sf-analytics-panel sf-funnel' aria-labelledby='sf-funnel-title'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title' id='sf-funnel-title'>
            {__('Form funnel', 'subtleforms')}
          </h2>
          <p className='sf-panel__subtitle'>
            {__('How many people saw, started and sent a form, and where the others stopped.', 'subtleforms')}
          </p>
        </div>
        {forms.length > 0 && (
          <div className='sf-funnel__controls'>
            <div className='sf-analytics-panel__select'>
              <TextControl
                label={__('Find a form', 'subtleforms')}
                hideLabelFromVision
                value={query}
                placeholder={__('Find a form', 'subtleforms')}
                onChange={setQuery}
                __nextHasNoMarginBottom
              />
              <SelectControl
                label={__('Form for the funnel', 'subtleforms')}
                hideLabelFromVision
                value={String(formId)}
                options={options.length ? options : [{ label: __('No matching form', 'subtleforms'), value: String(formId) }]}
                onChange={(v) => setFormId(Number(v))}
                __nextHasNoMarginBottom
              />
            </div>
            <div className='sf-funnel__range' role='group' aria-label={__('Date range', 'subtleforms')}>
              {FUNNEL_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  size='compact'
                  variant={preset === days ? 'primary' : 'secondary'}
                  aria-pressed={preset === days}
                  onClick={() => setDays(preset)}>
                  {sprintf(
                    /* translators: %d: number of days */
                    _n('%d day', '%d days', preset, 'subtleforms'),
                    preset
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className='sf-panel__body'>
        {forms.length === 0 ? (
          <p className='sf-analytics-panel__empty'>
            {__('Create and publish a form to see its funnel here.', 'subtleforms')}
          </p>
        ) : isLoading || !formId ? (
          <div className='sf-analytics-panel__loading'><Spinner /></div>
        ) : error ? (
          <p className='sf-analytics-panel__empty' role='alert'>
            {error.message || __('The funnel could not be loaded.', 'subtleforms')}
          </p>
        ) : (
          <FunnelBody report={data || {}} days={days} />
        )}
      </div>
    </section>
  );
}

/**
 * The report itself.
 *
 * @param {Object} props
 * @param {Object} props.report Report from GET /analytics/funnel.
 * @param {number} props.days   Window in days.
 */
export function FunnelBody({ report, days }) {
  const stages = funnelStages(report);
  const fields = Array.isArray(report.fields) ? report.fields : [];
  const steps = Array.isArray(report.steps) ? report.steps : [];
  const left = Number(report.left || 0);
  const completion = completionRate(report);

  return (
    <div className='sf-funnel__body'>
      {report.tracking === false && (
        <div className='sf-funnel__notice' role='note'>
          <p>
            {__('Form statistics are off, so new visits and drop-offs are not counted. Submissions still are.', 'subtleforms')}{' '}
            <a href={FUNNEL_SETTINGS_URL}>{__('Turn on Count form views', 'subtleforms')}</a>
          </p>
        </div>
      )}
      {report.tracking !== false && report.form_tracked === false && (
        <div className='sf-funnel__notice' role='note'>
          <p>{__('Statistics are turned off for this form in its settings.', 'subtleforms')}</p>
        </div>
      )}

      {isEmptyReport(report) ? (
        <p className='sf-analytics-panel__empty sf-funnel__empty'>
          {sprintf(
            /* translators: %d: number of days */
            _n(
              'Nobody has seen this form in the last %d day. Numbers appear once people open it on your site.',
              'Nobody has seen this form in the last %d days. Numbers appear once people open it on your site.',
              days,
              'subtleforms'
            ),
            days
          )}
        </p>
      ) : (
        <>
          <p className='sf-funnel__summary'>{funnelSentence(report)}</p>

          <ol className='sf-funnel__stages' aria-label={__('Funnel stages', 'subtleforms')}>
            {stages.map((stage) => (
              <li key={stage.id} className={`sf-funnel__stage sf-funnel__stage--${stage.id}`}>
                <span className='sf-funnel__stage-label'>{stage.label}</span>
                <span className='sf-funnel__track' aria-hidden='true'>
                  <span className='sf-funnel__fill' style={{ width: `${stage.count > 0 ? Math.max(stage.width, 2) : 0}%` }} />
                </span>
                <span className='sf-funnel__stage-count'>{fmt(stage.count)}</span>
                <span className='sf-funnel__stage-share'>
                  {stage.id === 'seen'
                    ? ''
                    : sprintf(
                        /* translators: %s: share, for example 38% */
                        __('%s of seen', 'subtleforms'),
                        formatShare(stage.share)
                      )}
                </span>
              </li>
            ))}
          </ol>

          <p className='sf-funnel__completion'>
            {completion === null
              ? __('Completion rate: no one has started the form yet.', 'subtleforms')
              : sprintf(
                  /* translators: %s: share, for example 63% */
                  __('Completion rate: %s of the people who started sent the form.', 'subtleforms'),
                  formatShare(completion)
                )}
          </p>

          <h3 className='sf-funnel__heading'>{__('Where people stopped', 'subtleforms')}</h3>
          {fields.length === 0 ? (
            <p className='sf-analytics-panel__empty'>
              {__('No one has left this form part way in this period.', 'subtleforms')}
            </p>
          ) : (
            <ol className='sf-funnel__drops'>
              {fields.map((row) => (
                <li key={row.key || '_none'} className='sf-funnel__drop'>
                  <div className='sf-funnel__drop-head'>
                    <span className='sf-funnel__drop-name'>{fieldName(row)}</span>
                    <span className='sf-funnel__drop-count'>
                      {sprintf(
                        /* translators: 1: number of people, 2: share of everyone who left */
                        _n('%1$s person (%2$s)', '%1$s people (%2$s)', Number(row.count), 'subtleforms'),
                        fmt(row.count),
                        formatShare(share(row.count, left))
                      )}
                    </span>
                  </div>
                  <span className='sf-funnel__track sf-funnel__track--drop' aria-hidden='true'>
                    <span className='sf-funnel__fill' style={{ width: `${Math.max(share(row.count, left) || 0, 2)}%` }} />
                  </span>
                  <p className='sf-funnel__hint'>{dropHint(row)}</p>
                </li>
              ))}
            </ol>
          )}

          {steps.length > 0 && (
            <>
              <h3 className='sf-funnel__heading'>{__('Steps where people stopped', 'subtleforms')}</h3>
              <ul className='sf-funnel__steps'>
                {steps.map((row) => (
                  <li key={row.index}>
                    <span>{stepName(row)}</span>
                    <span className='sf-funnel__drop-count'>
                      {sprintf(
                        /* translators: %s: number of people */
                        _n('%s person left', '%s people left', Number(row.count), 'subtleforms'),
                        fmt(row.count)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className='sf-funnel__note'>
            {__('Seen counts views of the form. Started counts everyone who sent it or left after touching it. People who manage SubtleForms, robots and builder previews are not counted.', 'subtleforms')}
          </p>
        </>
      )}
    </div>
  );
}
