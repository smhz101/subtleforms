/**
 * Contexts the form shares with its fields.
 *
 * They live in their own small file so the form can provide them without
 * importing the upload field code, which is only downloaded for forms that
 * have those fields. FileUpload.jsx re-exports them, so older imports keep
 * working.
 */
import { createContext } from '@wordpress/element';

/** Form-level details fields need: which form, and whether it is a preview. */
export const FormContext = createContext({ formId: null, preview: false });
