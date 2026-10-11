import { Button, Notice, Spinner, ToggleControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import FieldError from '../FieldError';
import { isProFeature } from '../../../utils/featureGate';

const PROVIDER_LABELS = {
  wpml: 'WPML',
  polylang: 'Polylang',
};

/**
 * Multilanguage Extension Settings Panel
 *
 * SubtleForms Pro (Agency) registers every visitor-facing form string with
 * WPML or Polylang when a form is published, and serves translated forms in
 * the visitor's language. This panel shows which plugin was found, how many
 * strings are registered, and can register all published forms again.
 */
export default function MultilanguagePanel({ settings, updateSetting, fieldErrors = {} }) {
  const available = isProFeature('extensions.multilanguage');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(available);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!available) return;
    apiFetch({ path: '/subtleforms/v1/pro/multilanguage' })
      .then((res) => setStatus(res?.data ?? res))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [available]);

  const registerNow = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiFetch({ path: '/subtleforms/v1/pro/multilanguage/register', method: 'POST' });
      const d = res?.data ?? res;
      setStatus((s) => ({ ...(s || {}), ...d, strings: d.strings }));
      setNotice({
        status: 'success',
        text: sprintf(
          /* translators: 1: number of strings, 2: number of forms */
          _n('Registered %1$d string from %2$d form.', 'Registered %1$d strings from %2$d forms.', d.strings, 'subtleforms'),
          d.strings,
          d.forms
        ),
      });
    } catch (e) {
      setNotice({ status: 'error', text: e?.message || __('Strings could not be registered.', 'subtleforms') });
    } finally {
      setBusy(false);
    }
  };

  const provider = status?.provider || null;

  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Multilanguage', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Translate forms with WPML or Polylang. Labels, placeholders, help text, options, buttons, messages and confirmations are registered when you publish a form, and visitors see the form in their language.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Translate forms', 'subtleforms')}
            checked={!!settings.ext_multilanguage_enabled}
            onChange={(v) => updateSetting('ext_multilanguage_enabled', v)}
            help={__('Register form strings on publish and show translated forms.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_multilanguage_enabled} />
        </div>

        <div className='sf-ext-panel__info'>
          {loading ? (
            <Spinner />
          ) : (
            <div>
              <p className='sf-ext-panel__info-text'>
                <strong>{__('Translation plugin:', 'subtleforms')}</strong>{' '}
                {provider
                  ? sprintf(
                      /* translators: %s: plugin name, e.g. WPML */
                      __('%s detected', 'subtleforms'),
                      PROVIDER_LABELS[provider] || provider
                    )
                  : available
                  ? __('None found. Activate WPML (with String Translation) or Polylang.', 'subtleforms')
                  : __('WPML or Polylang, detected automatically.', 'subtleforms')}
              </p>
              {available && status && (
                <p className='sf-ext-panel__info-text'>
                  <strong>{__('Registered strings:', 'subtleforms')}</strong>{' '}
                  {sprintf(
                    /* translators: 1: number of strings, 2: number of forms */
                    _n('%1$d from %2$d form', '%1$d from %2$d forms', status.forms || 0, 'subtleforms'),
                    status.strings || 0,
                    status.forms || 0
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {notice && (
          <Notice status={notice.status} isDismissible onRemove={() => setNotice(null)}>
            {notice.text}
          </Notice>
        )}

        <div className='sf-settings-field'>
          <Button
            variant='secondary'
            onClick={registerNow}
            isBusy={busy}
            disabled={!available || busy || !provider || !settings.ext_multilanguage_enabled}
            accessibleWhenDisabled>
            {__('Register strings now', 'subtleforms')}
          </Button>
          <p className='components-base-control__help'>
            {provider === 'polylang'
              ? __('Translate them under Languages › Translations, group “SubtleForms”.', 'subtleforms')
              : __('Translate them under WPML › String Translation, domain “SubtleForms”.', 'subtleforms')}
          </p>
        </div>
      </div>
    </div>
  );
}
