import { memo, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { normalizeLevels } from '../../../../../shared/chainedLevels';
import ChainedLevelsModal from './ChainedLevelsModal';

/**
 * Summary of dependent dropdowns. The lists themselves are edited in a modal,
 * where each dropdown has room to sit beside the one before it.
 */
const ChainedLevelsControl = memo(function ChainedLevelsControl({
	value,
	onChange,
	disabled,
}) {
	const levels = normalizeLevels(value);
	const [open, setOpen] = useState(false);
	const total = levels.reduce((sum, level) => sum + level.options.length, 0);

	return (
		<div className="sf-chained">
			<p className="sf-chained__intro">
				{__(
					'Visitors pick from one dropdown, then the next. Each list only shows choices that belong to the answer they already picked.',
					'subtleforms'
				)}
			</p>

			{levels.length === 0 ? (
				<p className="sf-chained__empty">
					{__('No dropdowns yet. Add the first list, then the lists that depend on it.', 'subtleforms')}
				</p>
			) : (
				<ul className="sf-chained__summary">
					{levels.map((level, index) => (
						<li key={`${level.label}-${index}`}>
							<span className="sf-chained__step">{index + 1}</span>
							<span className="sf-chained__summary-name">
								{level.label || __('Untitled dropdown', 'subtleforms')}
							</span>
							<span className="sf-chained__summary-count">
								{sprintf(
									/* translators: %d: number of choices in one dropdown */
									_n('%d choice', '%d choices', level.options.length, 'subtleforms'),
									level.options.length
								)}
							</span>
						</li>
					))}
				</ul>
			)}

			{levels.length > 0 && (
				<p className="sf-chained__count">
					{sprintf(
						/* translators: 1: dropdown count, 2: choice count */
						__('%1$s, %2$s', 'subtleforms'),
						sprintf(
							/* translators: %d: number of dropdowns */
							_n('%d dropdown', '%d dropdowns', levels.length, 'subtleforms'),
							levels.length
						),
						sprintf(
							/* translators: %d: number of choices */
							_n('%d choice', '%d choices', total, 'subtleforms'),
							total
						)
					)}
				</p>
			)}

			<Button variant="secondary" disabled={disabled && levels.length === 0} onClick={() => setOpen(true)}>
				{levels.length === 0 ? __('Set up dropdowns', 'subtleforms') : __('Edit dropdowns', 'subtleforms')}
			</Button>

			{open && (
				<ChainedLevelsModal
					levels={levels}
					disabled={disabled}
					onChange={onChange}
					onClose={() => setOpen(false)}
				/>
			)}
		</div>
	);
});

export default ChainedLevelsControl;
