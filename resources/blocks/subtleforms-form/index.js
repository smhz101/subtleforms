/**
 * SubtleForms Gutenberg Block
 *
 * Allows users to insert published forms into posts/pages.
 * Shows form preview in editor and renders form on frontend.
 */
import { registerBlockType } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import { useState, useEffect } from '@wordpress/element';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { PanelBody, SelectControl, Spinner, Placeholder } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

// Import form renderer for preview
import FormRenderer from '../../frontend/components/FormRenderer';

registerBlockType('subtleforms/form', {
  apiVersion: 2,
  title: __('SubtleForm', 'subtleforms'),
  description: __('Embed a published SubtleForm', 'subtleforms'),
  category: 'widgets',
  icon: 'forms',
  attributes: {
    formId: {
      type: 'number',
      default: 0,
    },
  },
  example: {},

  edit: function Edit({ attributes, setAttributes }) {
    const { formId } = attributes;
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [schema, setSchema] = useState(null);
    const [loadingSchema, setLoadingSchema] = useState(false);

    const blockProps = useBlockProps({
      className: 'subtleforms-block-editor',
    });

    // Fetch published forms list
    useEffect(() => {
      apiFetch({
        path: '/subtleforms/v1/forms?status=published&context=view',
      })
        .then((data) => {
          const formsList = Array.isArray(data) ? data : [];
          setForms(formsList);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Failed to fetch forms:', error);
          setLoading(false);
        });
    }, []);

    // Fetch selected form schema for preview
    useEffect(() => {
      if (!formId) {
        setSchema(null);
        return;
      }

      setLoadingSchema(true);
      apiFetch({
        path: `/subtleforms/v1/forms/${formId}/schema`,
      })
        .then((data) => {
          if (data.schema) {
            setSchema(data.schema);
          }
          setLoadingSchema(false);
        })
        .catch((error) => {
          console.error('Failed to fetch form schema:', error);
          setLoadingSchema(false);
        });
    }, [formId]);

    // Create options for SelectControl
    const formOptions = [
      { label: __('Select a form...', 'subtleforms'), value: 0 },
      ...forms.map((form) => ({
        label: `${form.title} (ID: ${form.id})`,
        value: form.id,
      })),
    ];

    return (
      <>
        <InspectorControls>
          <PanelBody title={__('Form Settings', 'subtleforms')}>
            <SelectControl
              label={__('Select Form', 'subtleforms')}
              value={formId}
              options={formOptions}
              onChange={(value) => setAttributes({ formId: parseInt(value, 10) })}
              help={__('Choose a published form to embed', 'subtleforms')}
            />
          </PanelBody>
        </InspectorControls>

        <div {...blockProps}>
          {loading ? (
            <Placeholder icon='forms' label={__('SubtleForm', 'subtleforms')}>
              <Spinner />
              <p>{__('Loading forms...', 'subtleforms')}</p>
            </Placeholder>
          ) : !formId ? (
            <Placeholder
              icon='forms'
              label={__('SubtleForm', 'subtleforms')}
              instructions={__('Select a form from the sidebar to begin.', 'subtleforms')}>
              <SelectControl
                value={formId}
                options={formOptions}
                onChange={(value) => setAttributes({ formId: parseInt(value, 10) })}
              />
            </Placeholder>
          ) : loadingSchema ? (
            <Placeholder icon='forms' label={__('SubtleForm Preview', 'subtleforms')}>
              <Spinner />
              <p>{__('Loading form preview...', 'subtleforms')}</p>
            </Placeholder>
          ) : schema ? (
            <div className='subtleforms-block-preview'>
              <div className='subtleforms-block-preview__header'>
                <strong>{__('Form Preview:', 'subtleforms')}</strong>{' '}
                {schema.metadata?.title || __('Untitled Form', 'subtleforms')}
              </div>
              <div className='subtleforms-block-preview__content'>
                <FormRenderer formId={formId} preloadedSchema={schema} preview={true} />
              </div>
            </div>
          ) : (
            <Placeholder
              icon='forms'
              label={__('SubtleForm', 'subtleforms')}
              instructions={__('Failed to load form preview', 'subtleforms')}
            />
          )}
        </div>
      </>
    );
  },

  save: function Save({ attributes }) {
    const { formId } = attributes;

    // Return null - dynamic block rendered via PHP
    // PHP will output: <div class="wp-block-subtleforms-form" data-form-id="123"></div>
    return null;
  },
});
