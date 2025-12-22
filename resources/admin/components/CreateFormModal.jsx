import { useState, useEffect, useCallback } from '@wordpress/element';
import { Modal, Button, TextControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { Icon, page, layout } from '@wordpress/icons';

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

export default function CreateFormModal({ isOpen, onClose, onFormCreated }) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');

  const generateDefaultTitle = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(__('New Form %d', 'subtleforms'), suffix);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTitle(generateDefaultTitle());
    }
  }, [isOpen, generateDefaultTitle]);

  const handleRequestClose = useCallback(() => {
    if (!creating) {
      onClose();
    }
  }, [creating, onClose]);

  const handleBlankForm = useCallback(async () => {
    if (creating) {
      return;
    }

    setCreating(true);
    const safeTitle = (title || '').trim() || generateDefaultTitle();

    // Create initial step
    const initialStep = {
      type: 'step',
      key: `step_${Date.now()}`,
      config: {
        title: 'Step 1',
        description: '',
      },
      children: [],
    };

    const { ok, body } = await apiPost('/forms', {
      title: safeTitle,
      schema: {
        fields: [initialStep],
        metadata: {
          name: 'form_schema',
          title: safeTitle,
        },
      },
    });
    setCreating(false);
    if (ok && body?.id) {
      onFormCreated(body.id);
    }
  }, [creating, title, generateDefaultTitle, onFormCreated]);

  if (!isOpen) {
    return null;
  }

  const options = [
    {
      id: 'blank',
      title: __('Blank form', 'subtleforms'),
      description: __(
        'Start from scratch with an empty canvas.',
        'subtleforms'
      ),
      icon: page,
      action: handleBlankForm,
      disabled: creating,
    },
    {
      id: 'template',
      title: __('Choose a template', 'subtleforms'),
      description: __(
        'Pick from curated layouts (coming soon).',
        'subtleforms'
      ),
      icon: layout,
      action: () => {},
      disabled: true,
      comingSoon: true,
    },
  ];

  return (
    <Modal
      title={__('Create a New Form', 'subtleforms')}
      onRequestClose={handleRequestClose}
      style={{ maxWidth: '520px' }}
      shouldCloseOnClickOutside={!creating}
      shouldCloseOnEsc={!creating}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
        <TextControl
          label={__('Form name', 'subtleforms')}
          value={title}
          disabled={creating}
          onChange={setTitle}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}>
          {options.map((option) => (
            <button
              key={option.id}
              type='button'
              onClick={() => (!option.disabled ? option.action() : null)}
              disabled={option.disabled}
              className='subtleforms-create-form-option'>
              <span className='subtleforms-create-form-option__icon'>
                <Icon icon={option.icon} size={32} />
              </span>
              <span className='subtleforms-create-form-option__title'>
                {option.title}
              </span>
              <span className='subtleforms-create-form-option__description'>
                {option.description}
              </span>
              {option.comingSoon && (
                <span className='subtleforms-create-form-option__badge'>
                  {__('Soon', 'subtleforms')}
                </span>
              )}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '8px',
          }}>
          <Button isSecondary onClick={handleRequestClose} disabled={creating}>
            {__('Cancel', 'subtleforms')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
