import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { chainedPresentation } from '../../../../../shared/chainedOptions';

const OPTIONS = [
	{
		value: 'dropdowns',
		label: __('Dropdowns', 'subtleforms'),
		help: __('Each step is a menu. The next menu lists only the choices for the previous answer.', 'subtleforms'),
	},
	{
		value: 'buttons',
		label: __('Buttons', 'subtleforms'),
		help: __('Each step is a row of choices. The next row appears after one is selected.', 'subtleforms'),
	},
	{
		value: 'columns',
		label: __('Columns', 'subtleforms'),
		help: __('Every list is shown. The first choice is selected, and each next list shows only what belongs to the choice before it. A list with nothing to show stays empty.', 'subtleforms'),
	},
];

/**
 * Chooses the public rendering of a chained field. The canvas uses the same
 * component, so the choice is visible immediately.
 */
export default function ChainedDisplayControl({ value, onChange, disabled }) {
	const current = chainedPresentation({ presentation: value });
	const help = OPTIONS.find((option) => option.value === current)?.help;

	return (
		<div className="sf-chained-display">
			<span className="sf-chained-display__label">{__('On the form', 'subtleforms')}</span>
			<div className="sf-chained-display__options" role="radiogroup" aria-label={__('On the form', 'subtleforms')}>
				{OPTIONS.map((option) => (
					<button
						key={option.value}
						type="button"
						className={clsx({ 'is-selected': option.value === current })}
						aria-pressed={option.value === current}
						disabled={disabled}
						onClick={() => onChange(option.value)}>
						{option.label}
					</button>
				))}
			</div>
			<p className="sf-chained-display__help">{help}</p>
		</div>
	);
}
