import { useState, useEffect, useCallback } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import {
  Modal,
  Button,
  TextControl,
  TextareaControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { Icon, page, layout, columns, listView, check } from '@wordpress/icons';

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
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [formType, setFormType] = useState('regular');
  const { createErrorNotice } = useDispatch(noticesStore);

  const generateDefaultTitle = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(__('New Form %d', 'subtleforms'), suffix);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTitle(generateDefaultTitle());
      setDescription('');
      setTemplate('blank');
      setFormType('regular');
      setCreating(false);
    }
  }, [isOpen, generateDefaultTitle]);

  const handleRequestClose = useCallback(() => {
    if (!creating) {
      onClose();
    }
  }, [creating, onClose]);

  const handleCreate = async () => {
    if (creating) {
      return;
    }

    setCreating(true);
    const safeTitle = (title || '').trim() || generateDefaultTitle();

    let fields = [];

    // Initialize fields based on form type
    if (formType === 'multistep') {
      fields = [
        {
          type: 'step',
          key: `step_${Date.now()}`,
          config: {
            title: __('Step 1', 'subtleforms'),
            description: '',
          },
          children: [],
        },
      ];
    } else if (formType === 'sectioned') {
      fields = [
        {
          type: 'section',
          key: `section_${Date.now()}`,
          config: {
            title: __('Section 1', 'subtleforms'),
            description: '',
          },
          children: [],
        },
      ];
    } else {
      // Regular form starts empty
      fields = [];
    }

    const { ok, body } = await apiPost('/forms', {
      title: safeTitle,
      schema: {
        fields,
        metadata: {
          name: 'form_schema',
          title: safeTitle,
          description: description,
          type: formType,
          template,
        },
      },
    });

    setCreating(false);
    if (ok && body?.id) {
      onFormCreated(body.id);
    } else {
      createErrorNotice(
        body?.message || __('Failed to create form', 'subtleforms')
      );
    }
  };

  if (!isOpen) {
    return null;
  }

  const templates = [
    {
      id: 'blank',
      title: __('Blank Form', 'subtleforms'),
      description: __('Start from scratch.', 'subtleforms'),
      icon: page,
      disabled: false,
    },
    {
      id: 'preset',
      title: __('Preset Template', 'subtleforms'),
      description: __('Coming soon.', 'subtleforms'),
      icon: layout,
      disabled: true,
    },
  ];

  const formTypes = [
    {
      id: 'regular',
      title: __('Regular', 'subtleforms'),
      description: __(
        'Single page form. Best for contact forms, leads.',
        'subtleforms'
      ),
      icon: page,
    },
    {
      id: 'multistep',
      title: __('Multi-step', 'subtleforms'),
      description: __(
        'Broken into steps. Best for applications, surveys.',
        'subtleforms'
      ),
      icon: columns,
    },
    {
      id: 'sectioned',
      title: __('Sectioned', 'subtleforms'),
      description: __('Grouped fields. Best for long forms.', 'subtleforms'),
      icon: listView,
    },
  ];

  const renderOptionCard = (option, selected, onSelect, size = 'default') => {
    const isSelected = selected === option.id;
    const isDisabled = option.disabled;
    const isHorizontal = size === 'horizontal';

    return (
      <button
        key={option.id}
        type='button'
        onClick={() => !isDisabled && onSelect(option.id)}
        disabled={isDisabled}
        className={`group relative flex transition-all duration-150 w-full border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isHorizontal
            ? 'flex-row items-center gap-3 p-3 text-left'
            : 'flex-col items-center text-center p-4'
        } ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
        } ${
          isDisabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-dashed'
            : 'cursor-pointer'
        }`}>
        
        <div
          className={`flex-shrink-0 transition-colors ${
            isHorizontal ? 'p-2' : 'p-3 mb-2'
          } ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
          }`}>
          <Icon icon={option.icon} size={isHorizontal ? 18 : 24} />
        </div>

        <div className={`${isHorizontal ? 'flex-1 min-w-0' : 'w-full'}`}>
          <div
            className={`font-semibold ${
              isHorizontal ? 'text-sm' : 'text-sm'
            } ${
              isSelected ? 'text-blue-900' : 'text-gray-900'
            }`}>
            {option.title}
          </div>
          
          <div className={`text-gray-500 text-xs leading-snug ${
            isHorizontal ? 'mt-1' : 'mt-1'
          }`}>
            {option.description}
          </div>
        </div>

        {isSelected && (
          <div className="absolute top-2 right-2 text-blue-600">
            <Icon icon={check} size={16} />
          </div>
        )}

        {isDisabled && (
          <div className={`font-medium text-[10px] text-gray-500 uppercase tracking-wider ${
            isHorizontal ? 'mt-1' : 'mt-2'
          }`}>
            {__('Coming soon', 'subtleforms')}
          </div>
        )}
      </button>
    );
  };

  return (
    <Modal
      title={null}
      onRequestClose={handleRequestClose}
      className='subtleforms-create-modal'
      overlayClassName='subtleforms-modal-overlay'
      shouldCloseOnClickOutside={!creating}
      shouldCloseOnEsc={!creating}>
      
      <div className="flex flex-col h-full min-h-[500px]">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {step === 1 
              ? __('Create New Form', 'subtleforms') 
              : __('Choose Form Structure', 'subtleforms')
            }
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {step === 1
              ? __('Provide basic information and choose a starting template.', 'subtleforms')
              : __('Select the structure that best fits your form requirements.', 'subtleforms')
            }
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1 text-xs font-medium border transition-colors ${
              step === 1 
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-gray-200 text-gray-500'
            }`}>
              {__('Details', 'subtleforms')}
            </div>
            <div className="w-8 h-px bg-gray-200"></div>
            <div className={`px-3 py-1 text-xs font-medium border transition-colors ${
              step === 2 
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-white border-gray-200 text-gray-500'
            }`}>
              {__('Structure', 'subtleforms')}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1">
          {step === 1 && (
            <div className="space-y-6">
              {/* Form Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {__('Form Title', 'subtleforms')} 
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <TextControl
                    value={title}
                    onChange={setTitle}
                    disabled={creating}
                    placeholder={__('e.g. Contact Form', 'subtleforms')}
                    className="!m-0 !w-full !border-gray-300 !px-3 !py-2 !text-sm focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {__('Description', 'subtleforms')}
                    <span className="text-xs font-normal text-gray-400 ml-2">
                      ({__('Optional', 'subtleforms')})
                    </span>
                  </label>
                  <TextareaControl
                    value={description}
                    onChange={setDescription}
                    disabled={creating}
                    rows={3}
                    placeholder={__('Describe the purpose of this form...', 'subtleforms')}
                    className="!m-0 !w-full !border-gray-300 !px-3 !py-2 !text-sm focus:!border-blue-500 focus:!ring-1 focus:!ring-blue-500"
                  />
                </div>
              </div>

              {/* Templates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
                  {__('Starting Template', 'subtleforms')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((t) => renderOptionCard(t, template, setTemplate))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
                  {__('Form Structure', 'subtleforms')}
                </label>
                <div className="space-y-3">
                  {formTypes.map((t) => renderOptionCard(t, formType, setFormType, 'horizontal'))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-6">
          <button
            type="button"
            onClick={step === 1 ? handleRequestClose : () => setStep(1)}
            disabled={creating}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 px-3 py-1">
            {step === 1 ? __('Cancel', 'subtleforms') : __('Back', 'subtleforms')}
          </button>

          <button
            type="button"
            onClick={step === 1 ? () => setStep(2) : handleCreate}
            disabled={step === 1 ? !title.trim() : creating || !formType}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {creating && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {step === 1 
              ? __('Next Step', 'subtleforms') 
              : creating 
                ? __('Creating...', 'subtleforms')
                : __('Create Form', 'subtleforms')
            }
          </button>
        </div>
      </div>
    </Modal>
  );
}
