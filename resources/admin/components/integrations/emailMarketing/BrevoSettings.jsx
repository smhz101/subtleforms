import { useEffect, useState } from '@wordpress/element';
import { Button, SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { fetchBrevoTemplates, useSaveServiceSettings } from './queries';
import './emailMarketing.scss';

/**
 * Brevo's double opt-in settings: the email template Brevo sends and the page
 * people land on after they confirm. Used by every form that turns double
 * opt-in on. Shown once Brevo is connected.
 *
 * @param {Object}   props
 * @param {Object}   props.connection Connection state (settings holds the saved values).
 * @param {Function} props.onState    Called with the new state after a save.
 */
export default function BrevoSettings({ connection, onState }) {
  const saved = connection.settings || {};
  const [template, setTemplate] = useState(String(saved.doi_template_id || ''));
  const [redirect, setRedirect] = useState(saved.doi_redirect_url || '');
  const [templates, setTemplates] = useState(null);
  const [note, setNote] = useState({ tone: '', text: '' });
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const saveSettings = useSaveServiceSettings('brevo');
  const connected = connection.has_key && connection.status !== 'error';

  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    fetchBrevoTemplates(client)
      .then((rows) => !cancelled && setTemplates(Array.isArray(rows) ? rows : []))
      .catch(() => !cancelled && setTemplates([]));
    return () => {
      cancelled = true;
    };
  }, [connected, client]);

  const save = async () => {
    setBusy(true);
    setNote({ tone: '', text: '' });
    try {
      const next = await saveSettings.mutateAsync({ doi_template_id: Number(template) || 0, doi_redirect_url: redirect.trim() });
      onState(next);
      setRedirect(next.settings?.doi_redirect_url || '');
      setNote({ tone: 'ok', text: __('Saved.', 'subtleforms') });
    } catch (e) {
      setNote({ tone: 'error', text: e?.message || __('Could not save.', 'subtleforms') });
    }
    setBusy(false);
  };

  const options = [
    { label: templates ? __('Choose a template', 'subtleforms') : __('Loading templates…', 'subtleforms'), value: '' },
    ...(templates || []).map((t) => ({ label: `${t.name} (#${t.id})`, value: String(t.id) })),
  ];
  if (template && templates && !templates.some((t) => String(t.id) === template)) {
    options.push({ label: `#${template}`, value: template });
  }

  return (
    <section className='sf-em-card' aria-labelledby='sf-em-brevo-doi'>
      <header className='sf-em-card__head'>
        <h3 id='sf-em-brevo-doi' className='sf-em-card__title'>
          {__('Double opt-in', 'subtleforms')}
        </h3>
      </header>
      <p className='sf-em-card__summary'>
        {__('Used by forms that turn double opt-in on. Brevo emails the template below to new contacts; the contact joins the list when they click the link in it. The template must contain the confirmation link, {{ params.DOIurl }}.', 'subtleforms')}
      </p>
      <div className='sf-em-card__key'>
        <SelectControl
          label={__('Confirmation email template', 'subtleforms')}
          value={template}
          options={options}
          onChange={setTemplate}
          disabled={!connected || busy}
        />
        <TextControl
          label={__('Page people see after they confirm', 'subtleforms')}
          type='url'
          value={redirect}
          onChange={setRedirect}
          placeholder='https://example.com/thanks'
          disabled={!connected || busy}
        />
        <div className='sf-em-card__actions'>
          <Button variant='secondary' onClick={save} isBusy={busy} disabled={!connected || busy}>
            {__('Save double opt-in settings', 'subtleforms')}
          </Button>
        </div>
        {note.text && (
          <p role='status' className={`sf-em-card__result sf-em-card__result--${note.tone}`}>
            <span>{note.text}</span>
          </p>
        )}
      </div>
    </section>
  );
}
