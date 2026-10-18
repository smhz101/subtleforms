import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { chainedUsesCsv } from '../../../../../shared/chainedLevels';

/**
 * Manual lists, or a CSV file. The two editors are not shown together.
 */
export default function ChainedSourceControl({ field, onChange, disabled }) {
	const csv = chainedUsesCsv(field);
	const help = csv
		? __(
				'Choices come from a spreadsheet. Download the example, then upload a file in that shape.',
				'subtleforms'
			)
		: __('Type the dropdowns here. Each list appears after the one before it.', 'subtleforms');

	const choose = (source) => {
		if (!disabled) {
			onChange({ source, sourceChosen: true });
		}
	};

	return (
		<div className="sf-chained-display">
			<span className="sf-chained-display__label">{__('Source', 'subtleforms')}</span>
			<div className="sf-chained-display__options" role="radiogroup" aria-label={__('Source', 'subtleforms')}>
				<button
					type="button"
					className={clsx({ 'is-selected': !csv })}
					aria-pressed={!csv}
					disabled={disabled}
					onClick={() => choose('manual')}>
					{__('Manual', 'subtleforms')}
				</button>
				<button
					type="button"
					className={clsx({ 'is-selected': csv })}
					aria-pressed={csv}
					disabled={disabled}
					onClick={() => choose('csv')}>
					{__('CSV', 'subtleforms')}
				</button>
			</div>
			<p className="sf-chained-display__help">{help}</p>
		</div>
	);
}
