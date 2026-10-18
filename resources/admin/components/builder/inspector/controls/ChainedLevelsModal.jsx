import { useEffect, useState } from '@wordpress/element';
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

function pastePlaceholder() {
	return [
		__('Choice', 'subtleforms'),
		`  ${__('A choice under the line above', 'subtleforms')}`,
		`    ${__('A choice under that', 'subtleforms')}`,
		__('Another choice', 'subtleforms'),
		`  ${__('Its own next choice', 'subtleforms')}`,
	].join('\n');
}

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
 * Dependent dropdowns as adjacent lists. Selecting a choice reveals only
 * the next list that belongs to it.
 */
export default function ChainedLevelsModal({ levels, onChange, onClose, disabled }) {
	const [path, setPath] = useState(() => firstPath(levels));
	const [activeDepth, setActiveDepth] = useState(0);
	const [paste, setPaste] = useState('');
	const shown = activePath(levels, path);
	const columnDepth = Math.min(activeDepth, Math.max(levels.length - 1, 0));

	useEffect(() => {
		if (path.length === 0) {
			const next = firstPath(levels);
			if (next.length) {
				setPath(next);
			}
		}
	}, [levels, path.length]);

	const commit = (next, nextPath) => {
		const resolved = nextPath || firstPath(next);
		onChange(next);
		setPath(resolved);
		setActiveDepth(resolved.length ? Math.min(activeDepth, next.length - 1) : 0);
	};

	const select = (depth, value) => {
		setPath([...shown.slice(0, depth), value]);
		setActiveDepth(Math.min(depth + 1, Math.max(levels.length - 1, 0)));
	};

	const help = (() => {
		if (levels.length === 0) {
			return __(
				'Add a dropdown, then another after it. Visitors answer them in that order.',
				'subtleforms'
			);
		}
		if (columnDepth === 0) {
			return __(
				'These choices are always shown. The next list appears only after one of them is selected.',
				'subtleforms'
			);
		}
		const parentLevel = levels[columnDepth - 1];
		const parent = choiceByValue(parentLevel, shown[columnDepth - 1]);
		if (!parent) {
			return sprintf(
				/* translators: %s: previous dropdown name */
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

	const addNext = () => commit(addLevel(levels), shown);

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
							'Each column is one dropdown. Select a choice to edit only what belongs to it.',
							'subtleforms'
						)}
					</p>
					<div className="sf-chained-modal__board">
						{levels.length === 0 && (
							<div className="sf-chained-modal__start">
								<Button
									variant="link"
									icon={<Icon.Plus size={16} />}
									disabled={disabled}
									onClick={addNext}>
									{__('Add the first dropdown', 'subtleforms')}
								</Button>
							</div>
						)}
						{levels.map((level, depth) => {
							const parentValue = depth === 0 ? '' : shown[depth - 1];
							const parentReady = depth === 0 || Boolean(parentValue);
							const options = choicesForParent(levels, depth, parentValue);
							const selected = shown[depth];
							return (
								<section
									key={depth}
									className={clsx('sf-chained-modal__column', {
										'is-current': depth === columnDepth,
										'is-waiting': !parentReady,
									})}>
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
												placeholder={__('Name', 'subtleforms')}
												onFocus={() => setActiveDepth(depth)}
												onChange={(event) => onChange(setLevelLabel(levels, depth, event.target.value))}
											/>
										</label>
										{!disabled && (
											<Button
												className="sf-chained-modal__remove-level"
												icon={<Icon.Trash size={14} />}
												label={
													depth < levels.length - 1
														? __('Remove this and later dropdowns', 'subtleforms')
														: __('Remove dropdown', 'subtleforms')
												}
												size="small"
												onClick={() => commit(removeLevel(levels, depth))}
											/>
										)}
									</header>
									<div className="sf-chained-modal__list">
										{options.map((option) => (
											<div
												key={option.value || option.label}
												className={clsx('sf-chained-modal__choice', {
													'is-selected': option.value === selected,
												})}
												onClick={() => select(depth, option.value)}>
												<input
													type="text"
													value={option.label}
													disabled={disabled}
													aria-label={__('Choice', 'subtleforms')}
													placeholder={__('Choice', 'subtleforms')}
													onFocus={() => select(depth, option.value)}
													onChange={(event) =>
														onChange(renameChoice(levels, depth, option.value, event.target.value))
													}
												/>
												{option.value === selected && depth < levels.length - 1 && (
													<Icon.Right className="sf-chained-modal__next" size={14} aria-hidden="true" />
												)}
												{!disabled && (
													<Button
														className="sf-chained-modal__remove-choice"
														icon={<Icon.Close size={14} />}
														label={__('Remove choice', 'subtleforms')}
														size="small"
														onClick={(event) => {
															event.stopPropagation();
															commit(
																removeChoice(levels, depth, option.value),
																shown[depth] === option.value ? shown.slice(0, depth) : shown
															);
														}}
													/>
												)}
											</div>
										))}
										{!parentReady && (
											<p className="sf-chained-modal__empty">
												{sprintf(
													/* translators: %s: previous dropdown name */
													__('Choose a %s first.', 'subtleforms'),
													levels[depth - 1]?.label || __('previous answer', 'subtleforms')
												)}
											</p>
										)}
										{parentReady && options.length === 0 && (
											<p className="sf-chained-modal__empty">
												{__('No choices yet.', 'subtleforms')}
											</p>
										)}
									</div>
									{parentReady && !disabled && (
										<Button
											className="sf-chained-modal__add-choice"
											variant="link"
											icon={<Icon.Plus size={14} />}
											onClick={() => {
												const before = levels[depth]?.options?.length || 0;
												const next = addChoice(levels, depth, depth > 0 ? parentValue : undefined);
												const added = next[depth].options[before];
												commit(
													next,
													added ? [...shown.slice(0, depth), added.value] : shown.slice(0, depth)
												);
											}}>
											{__('Add choice', 'subtleforms')}
										</Button>
									)}
								</section>
							);
						})}
						{levels.length > 0 && !disabled && (
							<Button
								className="sf-chained-modal__add-column"
								icon={<Icon.Plus size={16} />}
								label={__('Add the next dropdown', 'subtleforms')}
								onClick={addNext}
							/>
						)}
					</div>
				</div>
				<aside className="sf-chained-modal__help">
					<h3>{__('How this works', 'subtleforms')}</h3>
					<p>{help}</p>
					<p>
						{__(
							'The words can be anything. Changing an earlier answer clears the answers after it.',
							'subtleforms'
						)}
					</p>
					<h3>{__('Paste a list', 'subtleforms')}</h3>
					<p>
						{__(
							'One choice per line. Indent with two spaces or a tab to nest it. This replaces the choices and keeps the names.',
							'subtleforms'
						)}
					</p>
					<textarea
						className="sf-chained-modal__paste"
						rows={5}
						value={paste}
						disabled={disabled}
						placeholder={pastePlaceholder()}
						onChange={(event) => setPaste(event.target.value)}
					/>
					<Button
						className="sf-chained-modal__replace"
						variant="primary"
						disabled={disabled || !paste.trim()}
						onClick={() => {
							const next = levelsFromIndented(paste, levels);
							if (next) {
								commit(normalizeLevels(next));
								setPaste('');
							}
						}}>
						{__('Replace dropdowns', 'subtleforms')}
					</Button>
				</aside>
			</div>
		</Modal>
	);
}
