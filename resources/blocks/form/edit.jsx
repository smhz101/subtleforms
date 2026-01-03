/**
 * Block Edit Component
 *
 * Provides:
 * - Inspector control to select published forms
 * - Live preview of selected form in editor
 * - Safe fallback for unpublished/deleted forms
 */
import { __ } from '@wordpress/i18n';
import { useEffect, useState, useRef } from '@wordpress/element';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
  PanelBody,
  SelectControl,
  Placeholder,
  Spinner,
} from '@wordpress/components';

/**
 * Fetch published forms from REST API
 */
async function fetchPublishedForms() {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add nonce for authenticated requests
    if (window.subtleformsAdmin?.nonce) {
      headers['X-WP-Nonce'] = window.subtleformsAdmin.nonce;
    }

    const response = await fetch(
      `${
        window.subtleformsAdmin?.restUrl || '/wp-json/subtleforms/v1/'
      }forms?status=published&context=view`,
      {
        credentials: 'same-origin',
        headers,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch forms');
    }

    const data = await response.json();
    // API returns forms directly as array, not wrapped in { forms: [] }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('SubtleForms block: Failed to fetch forms', error);
    return [];
  }
}

/**
 * Fetch form schema for preview
 */
async function fetchFormSchema(formId) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add nonce for authenticated requests
    if (window.subtleformsAdmin?.nonce) {
      headers['X-WP-Nonce'] = window.subtleformsAdmin.nonce;
    }

    const response = await fetch(
      `${
        window.subtleformsAdmin?.restUrl || '/wp-json/subtleforms/v1/'
      }forms/${formId}/schema?context=view`,
      {
        credentials: 'same-origin',
        headers,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Form not found or not published
      }
      throw new Error('Failed to fetch form schema');
    }

    return await response.json();
  } catch (error) {
    console.error('SubtleForms block: Failed to fetch schema', error);
    return null;
  }
}

/**
 * Preview Component
 * Renders the form using frontend renderer in read-only mode
 */
function FormPreview({ formId }) {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function loadForm() {
      setLoading(true);
      setError(null);

      const formData = await fetchFormSchema(formId);
      console.log('SubtleForms block: Fetched form data:', formData);

      if (!mounted) return;

      if (!formData || !formData.schema) {
        setError(
          __('Form not available or has been unpublished', 'subtleforms')
        );
        setLoading(false);
        return;
      }

      console.log('SubtleForms block: Setting schema:', formData.schema);
      setSchema(formData.schema);
      setLoading(false);
    }

    loadForm();

    return () => {
      mounted = false;
    };
  }, [formId]);

  useEffect(() => {
    // Mount the frontend renderer when schema is available
    if (!schema || !containerRef.current) {
      console.log(
        'SubtleForms block: Cannot mount - schema or container missing',
        {
          hasSchema: !!schema,
          hasContainer: !!containerRef.current,
        }
      );
      return;
    }

    console.log(
      'SubtleForms block: Mounting form preview with schema:',
      schema
    );

    // Check if SubtleForms frontend renderer is available
    if (typeof window.SubtleForms?.mount === 'function') {
      const container = containerRef.current;

      // Mount in preview mode (read-only, no submissions)
      window.SubtleForms.mount(container, {
        formId,
        schema,
        preview: true,
        onSubmit: () => {
          // No-op in editor
          console.warn(
            'SubtleForms: Form submission disabled in editor preview'
          );
        },
      });

      console.log('SubtleForms block: Form mounted successfully');

      return () => {
        // Cleanup if renderer provides unmount
        if (typeof window.SubtleForms?.unmount === 'function') {
          window.SubtleForms.unmount(container);
        }
      };
    } else {
      console.error(
        'SubtleForms block: window.SubtleForms.mount not available'
      );
      setError(
        __(
          'Form renderer not loaded. Frontend preview unavailable.',
          'subtleforms'
        )
      );
    }
  }, [schema, formId]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Spinner />
        <p>{__('Loading form preview...', 'subtleforms')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <Placeholder
        icon='warning'
        label={__('SubtleForms', 'subtleforms')}
        instructions={error}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className='subtleforms-block-preview'
      style={{
        pointerEvents: 'none', // Prevent interactions in editor
        opacity: 0.95,
      }}
    />
  );
}

/**
 * Edit Component
 */
export default function Edit({ attributes, setAttributes }) {
  const { formId } = attributes;
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const blockProps = useBlockProps();

  // Fetch published forms on mount
  useEffect(() => {
    let mounted = true;

    async function loadForms() {
      const publishedForms = await fetchPublishedForms();
      if (mounted) {
        setForms(publishedForms);
        setLoading(false);
      }
    }

    loadForms();

    return () => {
      mounted = false;
    };
  }, []);

  // Build form options for select control
  const formOptions = [
    { label: __('— Select a form —', 'subtleforms'), value: 0 },
    ...forms.map((form) => ({
      label: form.title,
      value: form.id,
    })),
  ];

  // Show placeholder if no form selected
  if (!formId) {
    return (
      <div {...blockProps}>
        <InspectorControls>
          <PanelBody title={__('Form Settings', 'subtleforms')}>
            <SelectControl
              label={__('Select Form', 'subtleforms')}
              value={formId}
              options={formOptions}
              onChange={(value) =>
                setAttributes({ formId: parseInt(value, 10) })
              }
              disabled={loading}
            />
          </PanelBody>
        </InspectorControls>

        <Placeholder
          icon='feedback'
          label={__('SubtleForms', 'subtleforms')}
          instructions={__('Select a published form to embed', 'subtleforms')}>
          {loading ? (
            <Spinner />
          ) : (
            <SelectControl
              value={formId}
              options={formOptions}
              onChange={(value) =>
                setAttributes({ formId: parseInt(value, 10) })
              }
            />
          )}
        </Placeholder>
      </div>
    );
  }

  // Render form preview
  return (
    <div {...blockProps}>
      <InspectorControls>
        <PanelBody title={__('Form Settings', 'subtleforms')}>
          <SelectControl
            label={__('Select Form', 'subtleforms')}
            value={formId}
            options={formOptions}
            onChange={(value) => setAttributes({ formId: parseInt(value, 10) })}
            disabled={loading}
          />
        </PanelBody>
      </InspectorControls>

      <FormPreview formId={formId} />
    </div>
  );
}
