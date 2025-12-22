import { useState, useEffect } from '@wordpress/element';
import { Spinner, Notice, Button } from '@wordpress/components';
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

export default function SubmissionsList({ formId, onSelectSubmission }) {
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!formId) return;
    apiGet(`/forms/${formId}/submissions`)
      .then((data) => {
        if (data && Array.isArray(data)) setSubs(data);
        else setError(__('Failed to load submissions', 'subtleforms'));
      })
      .catch(() => setError(__('Failed to load submissions', 'subtleforms')));
  }, [formId]);

  if (!formId)
    return (
      <Notice status='info'>
        {__('Select a form to view submissions.', 'subtleforms')}
      </Notice>
    );
  if (error) return <Notice status='error'>{error}</Notice>;
  if (subs === null) return <Spinner />;

  return (
    <div>
      <table className='widefat'>
        <thead>
          <tr>
            <th>{__('ID', 'subtleforms')}</th>
            <th>{__('Status', 'subtleforms')}</th>
            <th>{__('Created', 'subtleforms')}</th>
            <th>{__('Actions', 'subtleforms')}</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.status}</td>
              <td>{s.created_at ?? ''}</td>
              <td>
                <Button isSecondary onClick={() => onSelectSubmission(s.id)}>
                  {__('View logs', 'subtleforms')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
