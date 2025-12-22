import { useState } from '@wordpress/element';
import { TextControl, Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const restBase =
  window.subtleformsAdmin && window.subtleformsAdmin.restUrl
    ? window.subtleformsAdmin.restUrl.replace(/\/$/, '')
    : '/wp-json/subtleforms/v1';
const restNonce =
  window.subtleformsAdmin && window.subtleformsAdmin.restNonce
    ? window.subtleformsAdmin.restNonce
    : null;

function apiPost(path, payload) {
  return fetch(restBase + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then((r) => r.json().then((j) => ({ ok: r.ok, body: j })));
}

export default function NewForm({ onCreated }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const { ok, body } = await apiPost('/forms', { title, config: {} });
    setSaving(false);
    if (!ok) {
      setError(body?.message || __('Failed to create form', 'subtleforms'));
      return;
    }
    const id = body?.id ?? null;
    if (id) onCreated(id);
  }

  return (
    <div>
      <h3>{__('Create New Form', 'subtleforms')}</h3>
      {error && <Notice status='error'>{error}</Notice>}
      <TextControl
        label={__('Title', 'subtleforms')}
        value={title}
        onChange={setTitle}
      />
      <div style={{ marginTop: 12 }}>
        <Button isPrimary onClick={handleCreate} disabled={saving || !title}>
          {saving
            ? __('Creating…', 'subtleforms')
            : __('Create Form', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}
