/**
 * One setting of the field settings panel, in one of two layouts.
 *
 *   stacked  (default for text, text areas, numbers, long selects and any
 *            `wide` control) the label above the control, the control the full
 *            width, as the WordPress block panel draws a setting.
 *   inline   (toggles, short choices, chips) the label on the left, the
 *            control right-aligned, a 40px row.
 *
 * A setting with help text gets an info button after its label that opens a
 * tooltip (HelpTip). The same text stays in the page, visually hidden, for the
 * control to point at with aria-describedby.
 */
import { useId } from '@wordpress/element';
import HelpTip from './HelpTip';

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
 * @param {boolean}     props.wide       Stacked, and the control takes the full width.
 * @param {boolean}     props.stacked    Stacked: label above the control.
 * @param {boolean}     props.top        Kept for callers that align a tall value to the top; the stacked layout does not need it.
 * @param {*}           props.icon       Leading icon, drawn in muted colour.
 * @param {string}      props.help       Help text, shown in the info tooltip.
 * @param {string}      props.className  Extra class names.
 * @param {*}           props.children   The control.
 */
export default function PropertyRow( {
	label,
	ids,
	composite = false,
	wide = false,
	stacked = false,
	icon = null,
	help,
	className = '',
	children,
} ) {
	const isStacked = wide || stacked;
	const classes = [
		'sf-prow',
		isStacked ? 'sf-prow--stacked' : 'sf-prow--inline',
		wide ? 'sf-prow--wide' : '',
		className,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div className={ classes }>
			{ label ? (
				<div className="sf-prow__head">
					<label
						className="sf-prow__label"
						id={ ids.labelId }
						htmlFor={ composite ? undefined : ids.id }
					>
						{ icon ? (
							<span className="sf-prow__icon" aria-hidden="true">
								{ icon }
							</span>
						) : null }
						<span className="sf-prow__label-text">{ label }</span>
					</label>
					{ help ? <HelpTip label={ label } help={ help } /> : null }
				</div>
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
