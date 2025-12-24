import { useState, useEffect } from '@wordpress/element';
import { Spinner, Notice } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { __ } from '@wordpress/i18n';

const restBase =
  window.subtleformsAdmin && window.subtleformsAdmin.restUrl
    ? window.subtleformsAdmin.restUrl.replace(/\/$/, '')
    : '/wp-json/subtleforms/v1';
const restNonce =
  window.subtleformsAdmin && window.subtleformsAdmin.restNonce
    ? window.subtleformsAdmin.restNonce
    : null;

function apiGet(path) {
  return fetch(restBase + path, {
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
  }).then((r) => r.json());
}

export default function ExecutionLog({ submissionId }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const { createErrorNotice } = useDispatch(noticesStore);

  useEffect(() => {
    if (!submissionId) return;
    setLoading(true);
    apiGet(`/submissions/${submissionId}/logs`)
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
    <div>
      <h3>{__('Execution Log', 'subtleforms')}</h3>
      <ol>
        {logs.map((l) => {
          const ctx = l.context || {};
          const ts = ctx.ts
            ? new Date(ctx.ts * 1000).toLocaleString()
            : l.created_at;
          const msg = `${ctx.step_id ?? ''} — ${ctx.action_type ?? ''} — ${
            ctx.status ?? l.level
          }`;
          return (
            <li key={l.id}>
              <div>
                <strong>{msg}</strong>
              </div>
              <div>{ts}</div>
              <div>{ctx.error ?? l.message ?? ''}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
