/**
 * Block Save Function
 *
 * Outputs minimal placeholder markup for frontend rendering. The actual form is
 * rendered dynamically by frontend.js when it detects elements with the
 * .subtleforms-block class. Block options are emitted as data attributes so the
 * frontend renderer can apply them (theme, title/description visibility, ajax,
 * tab index, prefilled field values).
 */
export default function save({ attributes }) {
	const {
	formId,
	align,
	className,
	showTitle = true,
	showDescription = true,
	theme = 'default',
	ajax = false,
	tabIndex = 0,
	fieldValues = '',
	} = attributes;

	if (!formId) {
	return null;
	}

	const classes = ['subtleforms-block', align ? `align${align}` : '', className || '']
	.filter(Boolean)
	.join(' ');

	return (
	<div
		className={classes}
		data-form-id={formId}
		data-show-title={showTitle ? '1' : '0'}
		data-show-description={showDescription ? '1' : '0'}
		data-theme={theme}
		data-ajax={ajax ? '1' : '0'}
		data-tabindex={tabIndex}
		data-field-values={fieldValues}
	/>
	);
}
