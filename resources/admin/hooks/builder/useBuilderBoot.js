/**
 * Builder Boot Hook
 *
 * Handles form loading, schema hydration, field definitions, and tour status.
 */

import { useState, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { apiGet } from '../../utils/api';
import { BUILDER_ACTIONS } from '../useBuilderReducer';

export default function useBuilderBoot({ formId, bootstrap, dispatch, autoShowTour }) {
  const [fieldGroups, setFieldGroups] = useState({});
  const [fieldDefinitions, setFieldDefinitions] = useState({});
  const [loadingFields, setLoadingFields] = useState(true);
  const [isHydrating, setIsHydrating] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(true);

  function generateDefaultTitle() {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(
      /* translators: %1$d: numeric suffix used to create a unique title */
      __('Untitled Form %1$d', 'subtleforms'),
      suffix
    );
  }

  // Load field definitions from API
  useEffect(() => {
    apiGet('/fields?grouped=true').then(({ ok, body }) => {
      if (!ok) {
        console.error('Failed to load field definitions');
        setLoadingFields(false);
        return;
      }
      // Transform API response to component format
      const groups = {};
      const definitions = {};
      Object.entries(body).forEach(([category, categoryFields]) => {
        groups[category] = categoryFields.map((field) => {
          definitions[field.type] = field;
          return {
            type: field.type,
            label: field.label,
            icon: field.icon || 'text', // Default to text icon key
            kind: field.kind || 'input',
          };
        });
      });
      setFieldGroups(groups);
      setFieldDefinitions(definitions);
      setLoadingFields(false);
    });
  }, []);

  // Check if tour should be shown
  useEffect(() => {
    const checkTourStatus = async () => {
      try {
        const response = await fetch(
          (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') || '/wp-json/subtleforms/v1') +
            '/tour/status',
          {
            credentials: 'same-origin',
            headers: {
              'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            },
          }
        );
        const data = await response.json();
        setTourCompleted(data.completed);
        // Auto-show tour once per user when caller opts in (e.g. first-run/new form)
        if (autoShowTour && !data.completed) {
          setTimeout(() => setShowTour(true), 1000);
        }
      } catch (error) {
        console.error('Failed to check tour status:', error);
      }
    };

    checkTourStatus();
  }, [autoShowTour, formId]);

  // Form/schema loading effect
  useEffect(() => {
    if (!formId) {
      return;
    }

    if (bootstrap?.form?.id === formId && bootstrap?.schema) {
      const payload = { ...bootstrap.schema };
      payload.fields = Array.isArray(payload.fields) ? payload.fields : [];
      payload.schema_version = payload.schema_version || 1;
      if (!payload.metadata) payload.metadata = {};
      if (!payload.metadata.name) payload.metadata.name = 'form_schema';

      const title = bootstrap.form?.title || payload.metadata?.title || generateDefaultTitle();
      payload.metadata.title = title;

      setIsHydrating(true);

      dispatch({
        type: BUILDER_ACTIONS.LOAD_SUCCESS,
        payload: {
          form: {
            id: formId,
            title,
            status: bootstrap.form?.status || 'draft',
          },
          schema: payload,
        },
      });

      setTimeout(() => setIsHydrating(false), 0);
      return;
    }

    dispatch({ type: BUILDER_ACTIONS.INIT_BUILDER, payload: { formId } });
    setIsHydrating(true);

    // Load both schema and form metadata
    Promise.all([
      apiGet(`/forms/${formId}/schema?context=builder`),
      apiGet(`/forms/${formId}`),
    ]).then(([schemaRes, formRes]) => {
      if (!schemaRes.ok) {
        dispatch({
          type: BUILDER_ACTIONS.AUTOSAVE_ERROR,
          payload: {
            error: schemaRes.body?.message || __('Failed to load schema', 'subtleforms'),
          },
        });
        return;
      }

      const rawPayload = schemaRes.body?.schema ?? schemaRes.body ?? {};
      const payload = rawPayload && typeof rawPayload === 'object' ? { ...rawPayload } : {};

      // Ensure fields array exists
      payload.fields = Array.isArray(payload.fields) ? payload.fields : [];

      // Ensure metadata.name exists (required by backend validator)
      if (!payload.metadata) payload.metadata = {};
      if (!payload.metadata.name) payload.metadata.name = 'form_schema';

      // Load title from form metadata if available
      const loadedTitle = schemaRes.body?.form?.title || payload.metadata?.title;
      if (loadedTitle) {
        payload.metadata.title = loadedTitle;
      } else if (!payload.metadata.title) {
        payload.metadata.title = generateDefaultTitle();
      }

      dispatch({
        type: BUILDER_ACTIONS.LOAD_SUCCESS,
        payload: {
          form: {
            id: formId,
            title: payload.metadata.title,
            status: formRes.ok && formRes.body ? formRes.body.status || 'draft' : 'draft',
          },
          schema: payload,
        },
      });

      // Clear hydrating flag after next render to allow FormEditor to initialize
      setTimeout(() => setIsHydrating(false), 0);
    });
  }, [formId, bootstrap, dispatch]);

  return {
    fieldGroups,
    fieldDefinitions,
    loadingFields,
    isHydrating,
    showTour,
    setShowTour,
    tourCompleted,
    setTourCompleted,
  };
}
