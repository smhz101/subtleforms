/**
 * Contexts the form shares with its fields.
 *
 * They live in their own small file so the form can provide them without
 * importing the upload or payment field code, which is only downloaded for
 * forms that have those fields. FileUpload.jsx and Payments.jsx re-export
 * them, so older imports keep working.
 */
import { createContext, useContext } from '@wordpress/element';

/** Form-level details fields need: which form, and whether it is a preview. */
export const FormContext = createContext({ formId: null, preview: false });

/** The order every priced field feeds (2.1). */
export const PaymentContext = createContext(null);

export const usePayment = () => useContext(PaymentContext);
