import { useState, useEffect } from '@wordpress/element';
import { Spinner, Notice } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { __ } from '@wordpress/i18n';
import { apiClient } from '../data';
import './ExecutionLog.scss';

export default function ExecutionLog({ submissionId }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const { createErrorNotice } = useDispatch(noticesStore);

  useEffect(() => {
    if (!submissionId) return;
    setLoading(true);
    apiClient.get(`/submissions/${submissionId}/logs`)
      .then((data) => {
        if (data && Array.isArray(data)) setLogs(data);
        else createErrorNotice(__('Failed to load logs', 'subtleforms'));
      })
      .catch(() => createErrorNotice(__('Failed to load logs', 'subtleforms')))
      .finally(() => setLoading(false));
  }, [submissionId]);

  if (!submissionId)
    return (
      <Notice status='info' isDismissible={false}>
        {__('Select a submission to view logs.', 'subtleforms')}
      </Notice>
    );

  if (loading) return <Spinner />;
  if (!logs) return null;

  return (
    <div className='sf-execution-log'>
      <h3 className='sf-execution-log__title'>{__('Execution Log', 'subtleforms')}</h3>
      <ol className='sf-execution-log__list'>
        {logs.map((l) => {
          const ctx = l.context || {};
          const ts = ctx.ts
            ? new Date(ctx.ts * 1000).toLocaleString()
            : l.created_at;
          const msg = `${ctx.step_id ?? ''} — ${ctx.action_type ?? ''} — ${
            ctx.status ?? l.level
          }`;
          return (
            <li key={l.id} className='sf-execution-log__item'>
              <div className='sf-execution-log__message'>
                <strong>{msg}</strong>
              </div>
              <div className='sf-execution-log__timestamp'>{ts}</div>
              <div className='sf-execution-log__details'>{ctx.error ?? l.message ?? ''}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
