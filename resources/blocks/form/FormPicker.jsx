/**
 * Searchable form picker for the block: every published form, shown as
 * "Title (#id)", with the current selection visible before the list loads.
 */
import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { ComboboxControl, ExternalLink, Notice, SelectControl } from '@wordpress/components';
import { fetchAllForms } from '../../shared/allForms';

export function useForms() {
	const [forms, setForms] = useState([]);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let mounted = true;
		fetchAllForms({ status: 'published' })
			.then((list) => mounted && setForms(list))
			.catch(() => mounted && setFailed(true))
			.finally(() => mounted && setLoading(false));
		return () => {
			mounted = false;
		};
	}, []);

	return { forms, loading, failed };
}

export function buildOptions(forms, value) {
	const sorted = [...forms].sort(
		(a, b) => String(a.title || '').localeCompare(String(b.title || '')) || Number(a.id) - Number(b.id)
	);
	const options = sorted.map((form) => ({
		label: sprintf(
			/* translators: 1: form title, 2: form id */
			__('%1$s (#%2$d)', 'subtleforms'),
			form.title || __('(no title)', 'subtleforms'),
			form.id
		),
		value: String(form.id),
	}));
	if (value && !options.some((option) => option.value === String(value))) {
		options.push({
			label: sprintf(
				/* translators: %d: form id */
				__('Form #%d', 'subtleforms'),
				Number(value)
			),
			value: String(value),
		});
	}
	return options;
}

export default function FormPicker({ forms, loading, failed, value, onChange }) {
	const empty = !loading && !failed && forms.length === 0;
	const editFormUrl =
		typeof window !== 'undefined' ? window.subtleformsAdmin?.editFormUrl : '';

	return (
		<div className='subtleforms-block-picker'>
			{failed && (
				<Notice status='warning' isDismissible={false}>
					{__(
						'Forms could not be loaded. Reload the editor to try again.',
						'subtleforms'
					)}
				</Notice>
			)}
			{empty && (
				<p>
					{__('No published forms yet.', 'subtleforms')}{' '}
					<a href='admin.php?page=subtleforms-new-form'>
						{__('Create a form', 'subtleforms')}
					</a>
				</p>
			)}
			{loading ? (
				<SelectControl
					label={__('Form', 'subtleforms')}
					value={value ? String(value) : ''}
					options={buildOptions(forms, value)}
					onChange={() => {}}
					disabled
					help={__('Loading forms…', 'subtleforms')}
					__next40pxDefaultSize
				/>
			) : (
				<ComboboxControl
					label={__('Form', 'subtleforms')}
					value={value ? String(value) : ''}
					options={buildOptions(forms, value)}
					onChange={(next) => onChange(next ? parseInt(next, 10) : 0)}
					__next40pxDefaultSize
				/>
			)}
			{value > 0 && editFormUrl && (
				<ExternalLink href={`${editFormUrl}${value}`}>
					{__('Edit this form', 'subtleforms')}
				</ExternalLink>
			)}
		</div>
	);
}
