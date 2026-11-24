/**
 * Keeps a visitor's answers and place in a multi-step or conversational form
 * in sessionStorage, so a reload or back and forward does not lose them
 * (issue 139). The draft is dropped when the form is sent. All of the storage
 * code is the "draft" lazy group (formDraft.js), fetched only when a form
 * needs it.
 */
import { createElement } from '@wordpress/element';
import { lazyField, loadGroup } from '../components/fields/lazyFields';

const Keeper = lazyField('draft', 'default', () => null);

/**
 * The element to render anywhere inside the form, or null when no draft is
 * wanted. Props: enabled, formId, instance, schema, values, step, view,
 * stepCount, setValues, setStep, setView (conversational only).
 */
export const draftKeeper = (props) => (props.enabled ? createElement(Keeper, props) : null);

/** Remove the draft once the form has been sent. */
export const clearDraft = (formId, instance) => {
  loadGroup('draft').then((m) => m.remove(m.draftKey(formId, instance)));
};
