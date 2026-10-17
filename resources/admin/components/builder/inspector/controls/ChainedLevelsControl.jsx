import { memo } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { nanoid } from 'nanoid';
import Icon from '../../../../ui/Icon';

/**
 * Editor for chained select dropdowns.
 *
 * Level 1 is the first dropdown. Each later dropdown lists choices that
 * belong to one choice in the dropdown above it (`option.parent`).
 */
function slugify(text) {
	const slug = String(text || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 48);
	return slug || `choice_${nanoid(6)}`;
}

function uniqueChoice(options, parent) {
	const used = new Set((options || []).map((option) => String(option?.value ?? '')));
	let index = (options || []).length + 1;
	let label = `${__('Choice', 'subtleforms')} ${index}`;
	let value = slugify(label);
	while (used.has(value)) {
		index += 1;
		label = `${__('Choice', 'subtleforms')} ${index}`;
		value = slugify(label);
	}
	const choice = { label, value };
	if (parent) {
		choice.parent = parent;
	}
	return choice;
}

const ChainedLevelsControl = memo(function ChainedLevelsControl({
	value,
	onChange,
	disabled,
}) {
	const levels = Array.isArray(value) ? value : [];

	function updateLevel(index, nextLevel) {
		const next = [...levels];
		next[index] = nextLevel;
		onChange(next);
	}

	function updateChoice(levelIndex, choiceIndex, choice) {
		const level = levels[levelIndex] || { label: '', options: [] };
		const options = Array.isArray(level.options) ? [...level.options] : [];
		options[choiceIndex] = choice;
		updateLevel(levelIndex, { ...level, options });
	}

	function removeChoice(levelIndex, choiceIndex) {
		const level = levels[levelIndex] || { label: '', options: [] };
		const options = Array.isArray(level.options) ? [...level.options] : [];
		const removed = options[choiceIndex];
		options.splice(choiceIndex, 1);
		let next = levels.map((entry, index) => {
			if (index === levelIndex) {
				return { ...entry, options };
			}
			return entry;
		});
		// Drop child choices that pointed at the removed value.
		if (removed?.value && next[levelIndex + 1]) {
			const child = next[levelIndex + 1];
			next = next.map((entry, index) => {
				if (index !== levelIndex + 1) {
					return entry;
				}
				return {
					...child,
					options: (child.options || []).filter((opt) => opt.parent !== removed.value),
				};
			});
		}
		onChange(next);
	}

	function addChoice(levelIndex) {
		const level = levels[levelIndex] || { label: '', options: [] };
		const options = Array.isArray(level.options) ? level.options : [];
		const previous = levels[levelIndex - 1];
		const parent = previous?.options?.[0]?.value || '';
		updateLevel(levelIndex, {
			...level,
			options: [
				...options,
				uniqueChoice(options, levelIndex > 0 ? parent : undefined),
			],
		});
	}

	function addLevel() {
		onChange([...levels, { label: '', options: [] }]);
	}

	function removeLevel(index) {
		onChange(levels.filter((_, i) => i !== index));
	}

	return (
		<div className="sf-chained">
			<p className="sf-chained__intro">
				{__(
					'Add one block per dropdown, in the order visitors see them. The first dropdown is always shown. Each choice in a later dropdown belongs to one choice above it, so visitors only see what matches the answer they already picked.',
					'subtleforms'
				)}
			</p>

			{levels.length === 0 && (
				<p className="sf-chained__empty">
					{__('No dropdowns yet. Start with the first question, for example Country or Make.', 'subtleforms')}
				</p>
			)}

			{levels.map((level, levelIndex) => {
				const options = Array.isArray(level?.options) ? level.options : [];
				const parents = levelIndex > 0 && Array.isArray(levels[levelIndex - 1]?.options)
					? levels[levelIndex - 1].options
					: [];
				return (
					<section key={levelIndex} className="sf-chained__level">
						<div className="sf-chained__level-head">
							<span className="sf-chained__step">{levelIndex + 1}</span>
							<label className="sf-chained__name">
								<span className="sf-chained__name-label">
									{levelIndex === 0
										? __('First dropdown label', 'subtleforms')
										: __('Next dropdown label', 'subtleforms')}
								</span>
								<input
									type="text"
									className="sf-options__input"
									value={level?.label || ''}
									disabled={disabled}
									placeholder={levelIndex === 0 ? __('Country', 'subtleforms') : __('State', 'subtleforms')}
									onChange={(e) => updateLevel(levelIndex, { ...level, label: e.target.value })}
								/>
							</label>
						</div>

						{levelIndex > 0 && parents.length === 0 && (
							<p className="sf-chained__hint">
								{__('Add choices to the dropdown above before linking this one.', 'subtleforms')}
							</p>
						)}

						{options.length > 0 && (
							<ul className="sf-options__list">
								{options.map((opt, choiceIndex) => (
									<li key={opt.value || choiceIndex} className="sf-options__row sf-chained__row">
										<div className="sf-options__inputs sf-chained__inputs">
											<input
												type="text"
												className="sf-options__input"
												value={opt.label ?? ''}
												disabled={disabled}
												placeholder={__('Choice label', 'subtleforms')}
												aria-label={__('Choice label', 'subtleforms')}
												onChange={(e) => updateChoice(levelIndex, choiceIndex, { ...opt, label: e.target.value })}
											/>
											{levelIndex > 0 && (
												<select
													className="sf-options__input sf-chained__parent"
													value={opt.parent || ''}
													disabled={disabled || parents.length === 0}
													aria-label={__('Shown when the previous answer is', 'subtleforms')}
													onChange={(e) => updateChoice(levelIndex, choiceIndex, { ...opt, parent: e.target.value })}
												>
													<option value="">
														{__('Shown when…', 'subtleforms')}
													</option>
													{parents.map((parent) => (
														<option key={parent.value} value={parent.value}>
															{parent.label || parent.value}
														</option>
													))}
												</select>
											)}
										</div>
										<Button
											className="sf-options__remove"
											icon={<Icon.Close size={14} />}
											label={__('Remove choice', 'subtleforms')}
											size="small"
											disabled={disabled}
											onClick={() => removeChoice(levelIndex, choiceIndex)}
										/>
									</li>
								))}
							</ul>
						)}

						<div className="sf-chained__actions">
							<Button
								variant="secondary"
								size="small"
								disabled={disabled || (levelIndex > 0 && parents.length === 0)}
								onClick={() => addChoice(levelIndex)}
							>
								{__('Add choice', 'subtleforms')}
							</Button>
							<Button
								variant="link"
								size="small"
								isDestructive
								disabled={disabled}
								onClick={() => removeLevel(levelIndex)}
							>
								{__('Remove dropdown', 'subtleforms')}
							</Button>
						</div>
					</section>
				);
			})}

			<Button variant="secondary" disabled={disabled} onClick={addLevel}>
				{levels.length === 0
					? __('Add the first dropdown', 'subtleforms')
					: __('Add the next dropdown', 'subtleforms')}
			</Button>
		</div>
	);
});

export default ChainedLevelsControl;
