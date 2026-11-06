import { useState } from '@wordpress/element';
import { SelectControl, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { useLogList } from '../../data/queries/tools';
import { formOptionLabel } from '../../utils/toolLabels';
import SectionHeader from '../sectionPanel/SectionHeader';
import Pager from './Pager';

/**
 * Activity and Webhooks: the same table, a different `kind`.
 *
 * @param {Object} props
 * @param {string} props.kind        'activity' or 'webhook'.
 * @param {Array}  props.forms       Forms for the Form filter.
 * @param {string} props.title       Section title.
 * @param {string} props.description One line under the title.
 */
export default function LogList({ kind, forms, title, description }) {
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState('');
  const [formId, setFormId] = useState('');
  const { data, isPending } = useLogList({ kind, page, level, formId });
  const loading = isPending;

  const rows = data?.rows || [];
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 20));

  return (
    <>
      <SectionHeader
        title={title}
        description={description}
        actions={
          <div className='sf-logs__filters'>
            <SelectControl
              label={__('Level', 'subtleforms')}
              hideLabelFromVision
              value={level}
              options={[
                { label: __('Any level', 'subtleforms'), value: '' },
                { label: __('Info', 'subtleforms'), value: 'info' },
                { label: __('Warning', 'subtleforms'), value: 'warning' },
                { label: __('Error', 'subtleforms'), value: 'error' },
              ]}
              onChange={(value) => {
                setPage(1);
                setLevel(value);
              }}
              __nextHasNoMarginBottom
            />
            <SelectControl
              label={__('Form', 'subtleforms')}
              hideLabelFromVision
              value={formId}
              options={[
                { label: __('Any form', 'subtleforms'), value: '' },
                ...forms.map((form) => ({ label: formOptionLabel(form), value: String(form.id) })),
              ]}
              onChange={(value) => {
                setPage(1);
                setFormId(value);
              }}
              __nextHasNoMarginBottom
            />
          </div>
        }
      />
      {loading ? (
        <div className='sf-logs__loading'>
          <Spinner />
        </div>
      ) : (
        <div className='sf-logs__table-wrap'>
          <table className='sf-logs__table'>
            <thead>
              <tr>
                <th>{__('When', 'subtleforms')}</th>
                <th>{__('Level', 'subtleforms')}</th>
                <th>{__('Form', 'subtleforms')}</th>
                <th>{__('What happened', 'subtleforms')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan='4'>{__('Nothing here yet.', 'subtleforms')}</td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className='sf-logs__when'>{row.created_at}</td>
                  <td>
                    <span
                      className={clsx(
                        'sf-pill',
                        'sf-pill--dot',
                        row.level === 'error' ? 'sf-pill--danger' : row.level === 'warning' ? 'sf-pill--warning' : 'sf-pill--info'
                      )}>
                      {row.level}
                    </span>
                  </td>
                  <td>{row.form_title || (row.form_id ? `#${row.form_id}` : '-')}</td>
                  <td>
                    {row.message}
                    {row.url && (
                      <div className='sf-logs__meta'>
                        {row.method} {row.url}
                        {row.http_status ? ` · ${row.http_status}` : ''}
                      </div>
                    )}
                    {row.error && <div className='sf-logs__meta'>{row.error}</div>}
                    {row.response && <div className='sf-logs__meta'>{row.response}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}
