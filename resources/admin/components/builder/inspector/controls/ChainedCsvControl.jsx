import { useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../../ui/Icon';
import ConfirmModal from '../../../../modals/ConfirmModal';
import {
	CHAINED_EXAMPLE_CSV,
	levelsFromCsv,
	levelsToCsv,
	needsReplaceConfirm,
	normalizeLevels,
} from '../../../../../shared/chainedLevels';

function downloadCsv(filename, contents) {
	const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

/**
 * Fill dependent dropdowns from a spreadsheet. The first row names the
 * dropdowns. Each row after it is one path.
 */
export default function ChainedCsvControl({ levels, fileName, onChange, disabled }) {
	const inputRef = useRef(null);
	const [error, setError] = useState('');
	const [pending, setPending] = useState(null);
	const current = normalizeLevels(levels);
	const hasChoices = current.some((level) => level.options.length);

	const readFile = (file) => {
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const next = levelsFromCsv(String(reader.result || ''), current);
			if (!next) {
				setError(__('This file needs a header row and at least one row of choices.', 'subtleforms'));
				return;
			}
			setError('');
			const change = { levels: next, csvFileName: file.name, source: 'csv', sourceChosen: true };
			if (needsReplaceConfirm(current)) {
				setPending(change);
				return;
			}
			onChange(change);
		};
		reader.readAsText(file);
	};

	return (
		<div className="sf-chained-csv">
			<p className="sf-chained-csv__help">
				{__(
					'The first row names the dropdowns. Each row after it is one path: a cell belongs to the cell on its left. The words can be anything.',
					'subtleforms'
				)}
			</p>
			<div className="sf-chained-csv__actions">
				<Button
					variant="link"
					icon={<Icon.DownloadCloud size={14} />}
					disabled={disabled}
					onClick={() => downloadCsv('dependent-dropdowns-example.csv', `${CHAINED_EXAMPLE_CSV}\n`)}>
					{__('Download an example', 'subtleforms')}
				</Button>
				{hasChoices && (
					<Button
						variant="link"
						icon={<Icon.DownloadCloud size={14} />}
						disabled={disabled}
						onClick={() => downloadCsv('dependent-dropdowns.csv', `${levelsToCsv(current)}\n`)}>
						{__('Download these dropdowns', 'subtleforms')}
					</Button>
				)}
			</div>
			<div className="sf-chained-csv__file">
				<Button variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
					{__('Choose a CSV file', 'subtleforms')}
				</Button>
				<input
					ref={inputRef}
					type="file"
					accept=".csv,text/csv"
					disabled={disabled}
					onChange={(event) => {
						const file = event.target.files?.[0];
						event.target.value = '';
						readFile(file);
					}}
				/>
				{fileName ? (
					<span className="sf-chained-csv__name">
						{sprintf(
							/* translators: %s: uploaded file name */
							__('Using %s', 'subtleforms'),
							fileName
						)}
					</span>
				) : null}
			</div>
			{error ? <p className="sf-chained-csv__error">{error}</p> : null}
			<ConfirmModal
				isOpen={!!pending}
				title={__('Replace these dropdowns?', 'subtleforms')}
				message={__('The lists you have now will be replaced by this file. This cannot be undone.', 'subtleforms')}
				confirmText={__('Replace', 'subtleforms')}
				confirmVariant="destructive"
				onConfirm={() => {
					if (pending) onChange(pending);
					setPending(null);
				}}
				onClose={() => setPending(null)}
			/>
		</div>
	);
}
