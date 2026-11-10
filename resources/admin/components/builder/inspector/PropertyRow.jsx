/**
 * One setting of the field settings panel: the label on the left, the value
 * on the right. A wide row (a list, an add-on control, anything that cannot
 * fit beside a label) puts the label on its own line above the value.
 *
 * The help text of a setting stays in the page for screen readers. It is
 * drawn under the value while the row is hovered or has focus, and always
 * for a setting that says what its state means (a toggle with a state text).
 */
import { useId } from '@wordpress/element';

/**
 * Ids that tie a row's label, control and help text together.
 *
 * @return {{ id: string, labelId: string, helpId: string }} Ids.
 */
export function useRowIds() {
	const base = useId().replace( /:/g, '' );
	return {
		id: `sf-prop-${ base }`,
		labelId: `sf-prop-${ base }-label`,
		helpId: `sf-prop-${ base }-help`,
	};
}

/**
 * @param {Object}      props
 * @param {string}      props.label      Visible label.
 * @param {Object}      props.ids        From useRowIds().
 * @param {boolean}     props.composite  The control is a group (radio group, list): the label names it with aria-labelledby, not htmlFor.
 * @param {boolean}     props.wide       Label above the value, full width.
 * @param {boolean}     props.top        Align the label to the top of a tall value (text areas).
 * @param {*}           props.icon       Leading icon, drawn in muted colour.
 * @param {string}      props.help       Help text.
 * @param {boolean}     props.helpAlways Always draw the help text.
 * @param {string}      props.className  Extra class names.
 * @param {*}           props.children   The control.
 */
export default function PropertyRow( {
	label,
	ids,
	composite = false,
	wide = false,
	top = false,
	icon = null,
	help,
	helpAlways = false,
	className = '',
	children,
} ) {
	const classes = [
		'sf-prow',
		wide ? 'sf-prow--wide' : '',
		top ? 'sf-prow--top' : '',
		help && helpAlways ? 'sf-prow--help-always' : '',
		className,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div className={ classes }>
			{ label ? (
				<label
					className="sf-prow__label"
					id={ ids.labelId }
					htmlFor={ composite ? undefined : ids.id }
				>
					{ icon ? <span className="sf-prow__icon" aria-hidden="true">{ icon }</span> : null }
					<span className="sf-prow__label-text">{ label }</span>
				</label>
			) : null }
			<div className="sf-prow__value">{ children }</div>
			{ help ? (
				<p className="sf-prow__help" id={ ids.helpId }>
					{ help }
				</p>
			) : null }
		</div>
	);
}
