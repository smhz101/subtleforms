import { scopeCustomCss } from '../../shared/scopeCss';

/**
 * A form's own CSS, scoped to the form, as a style element (2.7.2). Loaded on
 * demand: only a form that has custom CSS downloads this file.
 *
 * @param {Object}        props
 * @param {string}        props.css    CSS the server already checked.
 * @param {number|string} props.formId Form ID.
 */
export default function CustomCssStyle({ css, formId }) {
  return <style>{scopeCustomCss(css, formId)}</style>;
}
