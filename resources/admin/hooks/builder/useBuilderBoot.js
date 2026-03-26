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
  const [settings, setSettings] = useState(null);

  function generateDefaultTitle() {
    try {
      const next = parseInt( localStorage.getItem( 'sf_form_seq' ) || '0', 10 ) + 1;
      localStorage.setItem( 'sf_form_seq', String( next ) );
      return sprintf(
        /* translators: %1$d: sequential form number */
        __( 'New Form %1$d', 'subtleforms' ),
        next
      );
    } catch ( _e ) {
      return sprintf( __( 'New Form %1$d', 'subtleforms' ), Date.now() % 10000 );
    }
  }

  // Load field definitions from API
  useEffect(() => {
    Promise.all([apiGet('/fields?grouped=true'), apiGet('/settings')]).then(
      async ([fieldsRes, settingsRes]) => {
        if (!fieldsRes.ok) {
          console.warn('Failed to load grouped field definitions, attempting fallback to ungrouped endpoint', fieldsRes);
          // Try fallback to ungrouped fields endpoint and categorize on the client
          const fallback = await apiGet('/fields');
          if (!fallback.ok) {
            console.error('Fallback /fields failed, cannot load fields', fallback);
            setLoadingFields(false);
            return;
          }

          // Build grouped structure from ungrouped list
          const ungrouped = Array.isArray(fallback.body) ? fallback.body : [];
          const fallbackGroups = {};
          ungrouped.forEach((f) => {
            const cat = f.category || 'general';
            if (!fallbackGroups[cat]) fallbackGroups[cat] = [];
            fallbackGroups[cat].push(f);
          });

          // Replace fieldsRes.body with fallback grouped structure for the rest of the logic
          fieldsRes.body = fallbackGroups;
        }

        const settingsData = settingsRes.ok ? settingsRes.body : {};
        setSettings(settingsData);

        // Transform API response to component format
        const groups = {};
        const definitions = {};
        if (!fieldsRes.ok) {
          console.error('Failed to load fields from API:', fieldsRes);
        }

        // Extract field groups from the 'data' wrapper if it exists
        const fieldGroupsData = fieldsRes.body?.data || fieldsRes.body || {};
        const entries = Object.entries(fieldGroupsData);
        if (entries.length === 0) {
          console.warn('Fields API returned empty groups or invalid payload:', fieldGroupsData);
        }

        entries.forEach(([category, categoryFields]) => {
          // Defensive: categoryFields must be an array; if not, coerce to an empty array and warn
          const items = Array.isArray(categoryFields) ? categoryFields : [];
          if (!Array.isArray(categoryFields)) {
            console.warn('Invalid field group from API, expected array for category:', category, categoryFields);
          }

          groups[category] = items.map((field) => {
            definitions[field.type] = field;
            return {
              type: field.type,
              label: field.label,
              icon: field.icon || 'text',
              kind: field.kind || 'input',
              enabled: field.enabled !== false, // Pass through enabled status from API
            };
          });
        });
        setFieldGroups(groups);
        setFieldDefinitions(definitions);
        setLoadingFields(false);
      }
    );
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
      // Normalize legacy/alias form types to canonical values
      if (payload.metadata.type === 'multistep' || payload.metadata.type === 'sectioned') payload.metadata.type = 'multi-step';

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

      // API wraps responses in { data: ... } — unwrap before extracting the schema
      const responseBody = schemaRes.body?.data ?? schemaRes.body ?? {};
      const rawPayload = responseBody?.schema ?? responseBody ?? {};
      const payload = rawPayload && typeof rawPayload === 'object' ? { ...rawPayload } : {};

      // Ensure fields array exists
      payload.fields = Array.isArray(payload.fields) ? payload.fields : [];

      // Ensure metadata.name exists (required by backend validator)
      if (!payload.metadata) payload.metadata = {};
      if (!payload.metadata.name) payload.metadata.name = 'form_schema';
      // Normalize legacy/alias form types to canonical values
      if (payload.metadata.type === 'multistep' || payload.metadata.type === 'sectioned') payload.metadata.type = 'multi-step';

      // Load title from form metadata if available
      const loadedTitle = responseBody?.form?.title || payload.metadata?.title;
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
    settings,
  };
}
