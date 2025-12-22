import { useState, useEffect } from '@wordpress/element';
import {
  Spinner,
  Notice,
  TextControl,
  Button,
  Panel,
  PanelBody,
} from '@wordpress/components';
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
  }).then((r) => r.json().then((j) => ({ ok: r.ok, body: j })));
}

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

export default function SchemaEditor({ formId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activate, setActivate] = useState(false);

  useEffect(() => {
    if (!formId) return;
    setLoading(true);
    apiGet(`/forms/${formId}/schema`).then(({ ok, body }) => {
      if (!ok) {
        setError(body?.message || __('Failed to load schema', 'subtleforms'));
        setLoading(false);
        return;
      }
      // backend returns { schema, version, metadata... } — prefer body.schema if present
      const payload = body.schema ?? body;
      setSchema(payload);
      setLoading(false);
    });
  }, [formId]);

  if (!formId)
    return (
      <Notice status='info'>{__('Select a form first', 'subtleforms')}</Notice>
    );
  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;

  function updateMetadata(key, value) {
    setSchema((s) => ({
      ...(s || {}),
      metadata: { ...(s?.metadata || {}), [key]: value },
    }));
  }

  function updateField(index, key, value) {
    const fields = Array.isArray(schema?.fields) ? [...schema.fields] : [];
    fields[index] = { ...(fields[index] || {}), [key]: value };
    setSchema((s) => ({ ...(s || {}), fields }));
  }

  function addField() {
    const fields = Array.isArray(schema?.fields) ? [...schema.fields] : [];
    fields.push({ id: `f_${Date.now()}`, name: '', label: '', type: 'text' });
    setSchema((s) => ({ ...(s || {}), fields }));
  }

  function removeField(index) {
    const fields = Array.isArray(schema?.fields) ? [...schema.fields] : [];
    fields.splice(index, 1);
    setSchema((s) => ({ ...(s || {}), fields }));
  }

  function updateAction(index, key, value) {
    const actions = Array.isArray(schema?.actions) ? [...schema.actions] : [];
    actions[index] = { ...(actions[index] || {}), [key]: value };
    setSchema((s) => ({ ...(s || {}), actions }));
  }

  function addAction() {
    const actions = Array.isArray(schema?.actions) ? [...schema.actions] : [];
    actions.push({ id: `a_${Date.now()}`, type: 'save', settings: {} });
    setSchema((s) => ({ ...(s || {}), actions }));
  }

  function removeAction(index) {
    const actions = Array.isArray(schema?.actions) ? [...schema.actions] : [];
    actions.splice(index, 1);
    setSchema((s) => ({ ...(s || {}), actions }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const payload = { schema };
    if (activate) payload.activate = true;
    const { ok, body } = await apiPost(`/forms/${formId}/schema`, payload);
    setSaving(false);
    if (!ok) {
      // body may be WP_Error-like or contain details; show message or list of errors
      const msg =
        body?.message ||
        body?.data?.message ||
        __('Failed to save schema', 'subtleforms');
      setSaveError(msg);
      return;
    }
    // success — backend returns { version }
    onClose?.();
  }

  return (
    <div>
      <h3>{__('Schema Editor', 'subtleforms')}</h3>
      {saveError && <Notice status='error'>{saveError}</Notice>}

      <Panel>
        <PanelBody title={__('Metadata', 'subtleforms')} initialOpen>
          <TextControl
            label={__('Title', 'subtleforms')}
            value={schema?.metadata?.title ?? ''}
            onChange={(v) => updateMetadata('title', v)}
          />
          <TextControl
            label={__('Description', 'subtleforms')}
            value={schema?.metadata?.description ?? ''}
            onChange={(v) => updateMetadata('description', v)}
          />
        </PanelBody>

        <PanelBody title={__('Fields', 'subtleforms')} initialOpen>
          {(schema?.fields ?? []).map((f, i) => (
            <div
              key={f.id || i}
              style={{
                borderBottom: '1px solid #eee',
                paddingBottom: 8,
                marginBottom: 8,
              }}>
              <TextControl
                label={__('Name', 'subtleforms')}
                value={f.name || ''}
                onChange={(v) => updateField(i, 'name', v)}
              />
              <TextControl
                label={__('Label', 'subtleforms')}
                value={f.label || ''}
                onChange={(v) => updateField(i, 'label', v)}
              />
              <TextControl
                label={__('Type', 'subtleforms')}
                value={f.type || 'text'}
                onChange={(v) => updateField(i, 'type', v)}
              />
              <Button
                isSecondary
                onClick={() => removeField(i)}
                style={{ marginTop: 6 }}>
                {__('Remove Field', 'subtleforms')}
              </Button>
            </div>
          ))}
          <Button isPrimary onClick={addField} style={{ marginTop: 8 }}>
            {__('Add Field', 'subtleforms')}
          </Button>
        </PanelBody>

        <PanelBody title={__('Actions', 'subtleforms')} initialOpen>
          {(schema?.actions ?? []).map((a, i) => (
            <div
              key={a.id || i}
              style={{
                borderBottom: '1px solid #eee',
                paddingBottom: 8,
                marginBottom: 8,
              }}>
              <TextControl
                label={__('Action Type', 'subtleforms')}
                value={a.type || ''}
                onChange={(v) => updateAction(i, 'type', v)}
              />
              <TextControl
                label={__('Settings (JSON)', 'subtleforms')}
                value={JSON.stringify(a.settings || {})}
                onChange={(v) => {
                  try {
                    const parsed = JSON.parse(v || '{}');
                    updateAction(i, 'settings', parsed);
                  } catch (e) {
                    // keep raw string until valid JSON
                    updateAction(i, 'settings', a.settings || {});
                  }
                }}
              />
              <Button
                isSecondary
                onClick={() => removeAction(i)}
                style={{ marginTop: 6 }}>
                {__('Remove Action', 'subtleforms')}
              </Button>
            </div>
          ))}
          <Button isPrimary onClick={addAction} style={{ marginTop: 8 }}>
            {__('Add Action', 'subtleforms')}
          </Button>
        </PanelBody>
      </Panel>

      <div style={{ marginTop: 12 }}>
        <label style={{ marginRight: 8 }}>
          <input
            type='checkbox'
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
          />{' '}
          {__('Activate this version after saving', 'subtleforms')}
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <Button isPrimary onClick={handleSave} disabled={saving}>
          {saving
            ? __('Saving…', 'subtleforms')
            : __('Save Schema', 'subtleforms')}
        </Button>
        <Button
          isSecondary
          onClick={() => onClose?.()}
          style={{ marginLeft: 8 }}>
          {__('Cancel', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}
