import { useState } from '@wordpress/element';
import { Button, Modal } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../../../../ui/Icon';
import {
	addChoice,
	addLevel,
	choicesForParent,
	levelsFromIndented,
	normalizeLevels,
	removeChoice,
	removeLevel,
	renameChoice,
	setLevelLabel,
} from '../../../../../shared/chainedLevels';

const PASTE_PLACEHOLDER = [
	'USA',
	'  California',
	'    Los Angeles',
	'  Texas',
	'    Austin',
	'Pakistan',
	'  Punjab',
	'    Lahore',
	'    Rawalpindi',
].join('\n');

function activePath(levels, path) {
	const next = [];
	for (let depth = 0; depth < levels.length; depth += 1) {
		const options = choicesForParent(levels, depth, depth === 0 ? '' : next[depth - 1]);
		if (!options.some((option) => option.value === path[depth])) {
			break;
		}
		next.push(path[depth]);
	}
	return next;
}

function firstPath(levels) {
	const path = [];
	for (let depth = 0; depth < levels.length; depth += 1) {
		const options = choicesForParent(levels, depth, depth === 0 ? '' : path[depth - 1]);
		if (!options.length) {
			break;
		}
		path.push(options[0].value);
	}
	return path;
}

function choiceByValue(level, value) {
	return (level?.options || []).find((option) => option.value === value);
}

/**
 * Wide editor for dependent dropdowns. Columns follow the order visitors
 * see, and the next column only lists choices for the selected parent.
 */
export default function ChainedLevelsModal({ levels, onChange, onClose, disabled }) {
	const [path, setPath] = useState(() => firstPath(levels));
	const [paste, setPaste] = useState('');
	const shown = activePath(levels, path);
	const focusDepth = Math.min(shown.length, Math.max(levels.length - 1, 0));

	const commit = (next, nextPath) => {
		onChange(next);
		setPath(nextPath || firstPath(next));
	};

	const select = (depth, value) => {
		setPath([...shown.slice(0, depth), value]);
	};

	const help = (() => {
		if (levels.length === 0) {
			return __(
				'Add the first dropdown, or paste a list. Visitors will see that dropdown before any of the others.',
				'subtleforms'
			);
		}
		if (focusDepth === 0) {
			return __(
				'These choices are always shown. The next dropdown only lists choices that belong to the one selected here.',
				'subtleforms'
			);
		}
		const parentLevel = levels[focusDepth - 1];
		const parent = choiceByValue(parentLevel, shown[focusDepth - 1]);
		if (!parent) {
			return sprintf(
				/* translators: %s: previous dropdown name, e.g. Country */
				__('Choose a %s first. This list only shows choices for that answer.', 'subtleforms'),
				parentLevel?.label || __('previous answer', 'subtleforms')
			);
		}
		return sprintf(
			/* translators: 1: previous dropdown name, 2: selected choice */
			__('These choices appear when %1$s is %2$s.', 'subtleforms'),
			parentLevel?.label || __('the previous answer', 'subtleforms'),
			parent.label || parent.value
		);
	})();

	return (
		<Modal
			title={__('Dependent dropdowns', 'subtleforms')}
			onRequestClose={onClose}
			className="sf-chained-modal"
			size="large">
			<div className="sf-chained-modal__body">
				<div className="sf-chained-modal__main">
					<p className="sf-chained-modal__lead">
						{__(
							'Each column is one dropdown, in the order visitors see them. Select a choice to edit the choices that belong to it.',
							'subtleforms'
						)}
					</p>
					<div className="sf-chained-modal__columns">
						{levels.map((level, depth) => {
							const parentValue = depth === 0 ? '' : shown[depth - 1];
							const parentReady = depth === 0 || Boolean(parentValue);
							const options = choicesForParent(levels, depth, parentValue);
							const selected = shown[depth];
							return (
								<section key={depth} className="sf-chained-modal__column">
									<header className="sf-chained-modal__column-head">
										<span className="sf-chained-modal__step">{depth + 1}</span>
										<label className="sf-chained-modal__name">
											<span className="screen-reader-text">
												{__('Dropdown name', 'subtleforms')}
											</span>
											<input
												type="text"
												value={level.label || ''}
												disabled={disabled}
												placeholder={
													depth === 0
														? __('Country', 'subtleforms')
														: depth === 1
															? __('State', 'subtleforms')
															: __('City', 'subtleforms')
												}
												onChange={(event) => onChange(setLevelLabel(levels, depth, event.target.value))}
											/>
										</label>
									</header>
									<ul className="sf-chained-modal__choices">
										{options.map((option) => (
											<li
												key={option.value}
												className={clsx('sf-chained-modal__choice', {
													'is-selected': option.value === selected,
												})}>
												<input
													type="text"
													value={option.label}
													disabled={disabled}
													aria-label={__('Choice', 'subtleforms')}
													onFocus={() => select(depth, option.value)}
													onChange={(event) =>
														onChange(renameChoice(levels, depth, option.value, event.target.value))
													}
												/>
												<Button
													icon={<Icon.Close size={14} />}
													label={__('Remove choice', 'subtleforms')}
													size="small"
													disabled={disabled}
													onClick={() =>
													commit(
														removeChoice(levels, depth, option.value),
														shown[depth] === option.value ? shown.slice(0, depth) : shown
													)
												}
												/>
											</li>
										))}
									</ul>
									{!parentReady && (
										<p className="sf-chained-modal__empty">
											{sprintf(
												/* translators: %s: previous dropdown name */
												__('Choose a %s to see choices here.', 'subtleforms'),
												levels[depth - 1]?.label || __('previous answer', 'subtleforms')
											)}
										</p>
									)}
									{parentReady && options.length === 0 && (
										<p className="sf-chained-modal__empty">
											{depth === 0
												? __('Add the first choice, for example USA.', 'subtleforms')
												: __('No choices for this answer yet.', 'subtleforms')}
										</p>
									)}
									<footer className="sf-chained-modal__column-foot">
										<Button
											variant="secondary"
											size="small"
											disabled={disabled || !parentReady}
											onClick={() => {
												const before = levels[depth]?.options?.length || 0;
												const next = addChoice(levels, depth, depth > 0 ? parentValue : undefined);
												const added = next[depth].options[before];
												commit(next, [...shown.slice(0, depth), added?.value].filter(Boolean));
											}}>
											{__('Add choice', 'subtleforms')}
										</Button>
										<Button
											variant="link"
											size="small"
											isDestructive
											disabled={disabled}
											onClick={() => commit(removeLevel(levels, depth))}>
											{depth < levels.length - 1
												? __('Remove this and later dropdowns', 'subtleforms')
												: __('Remove dropdown', 'subtleforms')}
										</Button>
									</footer>
								</section>
							);
						})}
						<Button
							className="sf-chained-modal__add-level"
							variant="secondary"
							disabled={disabled}
							onClick={() => commit(addLevel(levels), shown)}>
							{levels.length === 0
								? __('Add the first dropdown', 'subtleforms')
								: __('Add the next dropdown', 'subtleforms')}
						</Button>
					</div>
				</div>
				<aside className="sf-chained-modal__help">
					<h3>{__('How this works', 'subtleforms')}</h3>
					<p>{help}</p>
					<p>
						{__(
							'A city only appears after its state, and a state only appears after its country. Changing an earlier answer clears the later ones.',
							'subtleforms'
						)}
					</p>
					<h3>{__('Paste a list', 'subtleforms')}</h3>
					<p>
						{__(
							'One choice per line. Indent a line with two spaces, or a tab, to put it under the choice above. This replaces the dropdowns already here. Their names are kept.',
							'subtleforms'
						)}
					</p>
					<textarea
						className="sf-chained-modal__paste"
						rows={12}
						value={paste}
						disabled={disabled}
						placeholder={PASTE_PLACEHOLDER}
						onChange={(event) => setPaste(event.target.value)}
					/>
					<Button
						variant="primary"
						disabled={disabled || !paste.trim()}
						onClick={() => {
							const next = levelsFromIndented(paste, levels);
							if (next) {
								commit(normalizeLevels(next));
								setPaste('');
							}
						}}>
						{__('Replace dropdowns with this list', 'subtleforms')}
					</Button>
				</aside>
			</div>
		</Modal>
	);
}
