/**
 * Build the schema of a new form from a template (2.3.2).
 *
 * The New form screen and the Create form modal each built their own copy
 * and dropped different parts (the modal lost the notifications). One
 * function keeps every part of a template: fields, form settings
 * (metadata), notifications and actions, and its type. The type always
 * follows the structure: a template with Page Breaks is Multi-step.
 */

import { enrichSchemaWithProMarkers } from './schemaEnricher';
import { structuralType } from '../../shared/formType';

/** Deep copy of plain JSON data, so a form never shares objects with the template list. */
function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * @param {Object} template Template from GET /templates ({ id, schema }).
 * @param {Object} options
 * @param {string} options.title       Form name.
 * @param {string} [options.description] Form description.
 * @return {Object} Schema for POST /forms.
 */
export function schemaFromTemplate(template, { title, description = '' } = {}) {
  const source = template?.schema || {};
  const fields = Array.isArray(source.fields) ? copy(source.fields) : [];
  const metadata = {
    ...(copy(source.metadata) || {}),
    name: 'form_schema',
    title,
    // The visitor-facing description: what the user typed, else the template's.
    description: description || source.metadata?.description || '',
    template: template?.id,
  };
  metadata.type = structuralType({ metadata, fields });

  const schema = enrichSchemaWithProMarkers({
    schema_version: 1,
    metadata,
    fields,
    ...(Array.isArray(source.actions) ? { actions: copy(source.actions) } : {}),
  });
  schema.schema_version = 1;
  return schema;
}

export default schemaFromTemplate;
