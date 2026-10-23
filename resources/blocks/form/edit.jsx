/**
 * Block Edit Component
 *
 * Provides:
 * - Inspector controls: form selection, title/description toggles, theme,
 *   and advanced options (ajax, tabindex, field values).
 * - Live preview of the selected form in the editor, styled identically to
 *   the frontend (the frontend stylesheet is enqueued server-side).
 */
import { __ } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { debug } from '../../shared/debug';
import {
	PanelBody,
	SelectControl,
	Placeholder,
	Spinner,
	ToggleControl,
	TextControl,
	TextareaControl,
	Button,
} from '@wordpress/components';
import { FORM_PRESETS } from '../../shared/appearance';
import { whenRendererReady } from './rendererReady';

/**
 * Fetch published forms from REST API
 */
async function fetchPublishedForms() {
	try {
		const headers = {
		'Content-Type': 'application/json',
	};

	// Add nonce for authenticated requests
	if (window.subtleformsAdmin?.nonce) {
		headers['X-WP-Nonce'] = window.subtleformsAdmin.nonce;
	}

	const response = await fetch(
		`${
		window.subtleformsAdmin?.restUrl || '/wp-json/subtleforms/v1/'
		}forms?status=published&context=view`,
		{
		credentials: 'same-origin',
		headers,
		}
	);

	if (!response.ok) {
		throw new Error('Failed to fetch forms');
	}

	const data = await response.json();
	// API returns paginated response: { data: [...], meta: { pagination: {...} } }
	return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
	} catch (error) {
	console.error('SubtleForms block: Failed to fetch forms', error);
	return [];
	}
}

/**
 * Fetch form schema for preview
 */
async function fetchFormSchema(formId) {
	try {
	const headers = {
		'Content-Type': 'application/json',
	};

	// Add nonce for authenticated requests
	if (window.subtleformsAdmin?.nonce) {
		headers['X-WP-Nonce'] = window.subtleformsAdmin.nonce;
	}

	const response = await fetch(
		`${
		window.subtleformsAdmin?.restUrl || '/wp-json/subtleforms/v1/'
		}forms/${formId}/schema?context=view`,
		{
		credentials: 'same-origin',
		headers,
		}
	);

	if (!response.ok) {
		if (response.status === 404) {
		return null; // Form not found or not published
		}
		throw new Error('Failed to fetch form schema');
	}

	const data = await response.json();
	// API wraps responses in { data: ... }, normalise for the caller
	const schemaPayload = data?.data?.schema ?? data?.schema ?? null;
	return schemaPayload ? { schema: schemaPayload } : null;
	} catch (error) {
	console.error('SubtleForms block: Failed to fetch schema', error);
	return null;
	}
}

/**
 * Preview Component
 *
 * Draws the form with the front-end renderer, the same one that draws it on
 * the site, handing it the same block options the front end hands it (theme,
 * title and description toggles). The renderer applies the form's own builder
 * styling (theme, colours, layout) from its schema as CSS variables, and the
 * front-end stylesheet is loaded into the editor canvas by
 * SubtleFormsBlock::enqueue_canvas_styles, so what is drawn here is what the
 * site shows. The preview cannot be used: it is inert, so nothing in it
 * takes focus, accepts typing or submits.
 */
function FormPreview({ attributes }) {
	const { formId, theme, showTitle, showDescription } = attributes;
	const [schema, setSchema] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	// The element the form is drawn in. Kept in state so the effects below run
	// when it appears (it is not rendered while the form loads).
	const [container, setContainer] = useState(null);
	// True while the renderer script has not loaded yet.
	const [waiting, setWaiting] = useState(false);

	useEffect(() => {
		let mounted = true;
		setSchema(null);
		setLoading(true);
		setError(null);

		fetchFormSchema(formId).then((formData) => {
			if (!mounted) return;

			if (!formData || !formData.schema) {
				setError(
					__('Form not available or has been unpublished', 'subtleforms')
				);
				setLoading(false);
				return;
			}

			debug('SubtleForms block: Fetched form data:', formData);
			setSchema(formData.schema);
			setLoading(false);
		});

		return () => {
			mounted = false;
		};
	}, [formId]);

	// Draw (and redraw on a change) with the renderer's own mount(). The
	// renderer script can still be loading when the block is first inserted;
	// the preview then draws as soon as it is ready.
	useEffect(() => {
		if (!schema || !container) {
			return undefined;
		}
		setWaiting(typeof window.SubtleForms?.mount !== 'function');
		return whenRendererReady(
			() => {
				setWaiting(false);
				window.SubtleForms.mount(container, {
					formId,
					schema,
					preview: true,
					blockOptions: { theme, showTitle, showDescription },
					onSubmit: () => {
						console.warn(
							'SubtleForms: Form submission disabled in editor preview'
						);
					},
				});
			},
			() => {
				console.error('SubtleForms block: window.SubtleForms.mount not available');
				setWaiting(false);
				setError(
					__(
						'Form renderer not loaded. Frontend preview unavailable.',
						'subtleforms'
					)
				);
			}
		);
	}, [schema, container, formId, theme, showTitle, showDescription]);

	// Release the form when its element goes away or the block is removed.
	useEffect(() => {
		return () => {
			if (container && typeof window.SubtleForms?.unmount === 'function') {
				window.SubtleForms.unmount(container);
			}
		};
	}, [container]);

	if (loading) {
		return (
			<div className='subtleforms-block__loading'>
				<Spinner />
				<p>{__('Loading form preview...', 'subtleforms')}</p>
			</div>
		);
	}

	if (error) {
		return (
			<Placeholder
				icon='warning'
				label={__('SubtleForms', 'subtleforms')}
				instructions={error}
			/>
		);
	}

	return (
		<div className='subtleforms-block-preview-frame'>
			<span className='subtleforms-block-preview__label'>
				{__('Preview', 'subtleforms')}
			</span>
			{waiting && <Spinner />}
			{/* inert: no focus, typing, clicks or submit in the editor. */}
			<div
				ref={setContainer}
				className='subtleforms-block-preview'
				inert=''
				data-form-id={formId}
			/>
		</div>
	);
}

/**
 * Edit Component
 */
export default function Edit({ attributes, setAttributes }) {
	const {
	formId,
	showTitle,
	showDescription,
	theme,
	ajax,
	tabIndex,
	fieldValues,
	} = attributes;
	const [forms, setForms] = useState([]);
	const [loading, setLoading] = useState(true);
	const blockProps = useBlockProps();

	// Fetch published forms on mount
	useEffect(() => {
	let mounted = true;

	async function loadForms() {
		const publishedForms = await fetchPublishedForms();
		if (mounted) {
		setForms(publishedForms);
		setLoading(false);
		}
	}

	loadForms();

	return () => {
		mounted = false;
	};
	}, []);

	// Build form options for select control
	const formOptions = [
	{ label: __('Select a form', 'subtleforms'), value: 0 },
	...forms.map((form) => ({
		label: form.title,
		value: form.id,
	})),
	];

	// Theme options derived from the shared preset list.
	const themeOptions = FORM_PRESETS.map((preset) => ({
	// "default" keeps the styling the form was given in the builder.
	label:
		preset.id === 'default'
		? __("Form's own style", 'subtleforms')
		: preset.label,
	value: preset.id,
	}));

	const resetDefaults = () =>
	setAttributes({
		showTitle: true,
		showDescription: true,
		theme: 'default',
		ajax: false,
		tabIndex: 0,
		fieldValues: '',
	});

	const inspector = (
	<InspectorControls>
		<PanelBody title={__('Form Settings', 'subtleforms')} initialOpen>
		<SelectControl
			label={__('Select Form', 'subtleforms')}
			value={formId}
			options={formOptions}
			onChange={(value) =>
			setAttributes({ formId: parseInt(value, 10) })
			}
			disabled={loading}
			__next40pxDefaultSize
		/>
		<ToggleControl
			label={__('Show form title', 'subtleforms')}
			checked={showTitle}
			onChange={(value) => setAttributes({ showTitle: value })}
		/>
		<ToggleControl
			label={__('Show form description', 'subtleforms')}
			checked={showDescription}
			onChange={(value) => setAttributes({ showDescription: value })}
		/>
		</PanelBody>

		<PanelBody title={__('Form Styling', 'subtleforms')} initialOpen={false}>
		<SelectControl
			label={__('Form Theme', 'subtleforms')}
			value={theme}
			options={themeOptions}
			onChange={(value) => setAttributes({ theme: value })}
			help={__(
			'Keeps the form\'s own styling, or applies a built-in theme instead. Updates the preview instantly.',
			'subtleforms'
			)}
			__next40pxDefaultSize
		/>
		<Button
			variant='tertiary'
			isDestructive
			onClick={resetDefaults}
			disabled={!formId}
			text={__('Reset to defaults', 'subtleforms')}
		/>
		</PanelBody>

		<PanelBody title={__('Advanced', 'subtleforms')} initialOpen={false}>
		<ToggleControl
			label={__('Enable AJAX submission', 'subtleforms')}
			checked={ajax}
			onChange={(value) => setAttributes({ ajax: value })}
			help={__(
			'Submit the form without reloading the page.',
			'subtleforms'
			)}
		/>
		<TextControl
			type='number'
			label={__('Tab Index', 'subtleforms')}
			value={tabIndex ?? 0}
			onChange={(value) =>
			setAttributes({ tabIndex: parseInt(value, 10) || 0 })
			}
			min={0}
		/>
		<TextareaControl
			label={__('Field Values', 'subtleforms')}
			value={fieldValues}
			onChange={(value) => setAttributes({ fieldValues: value })}
			help={__(
			'One field per line, as key=value pairs, to prefill the form.',
			'subtleforms'
			)}
			placeholder={'first_name=John&#10;email=john@example.com'}
			rows={4}
		/>
		</PanelBody>
	</InspectorControls>
	);

	// Show placeholder if no form selected
	if (!formId) {
	return (
		<div {...blockProps}>
		{inspector}
		<Placeholder
			icon='feedback'
			label={__('SubtleForms', 'subtleforms')}
			instructions={__('Select a published form to embed', 'subtleforms')}>
			{loading ? (
			<Spinner />
			) : (
			<SelectControl
				value={formId}
				options={formOptions}
				onChange={(value) =>
				setAttributes({ formId: parseInt(value, 10) })
				}
				__next40pxDefaultSize
			/>
			)}
		</Placeholder>
		</div>
	);
	}

	// Render form preview
	return (
	<div {...blockProps}>
		{inspector}
		<FormPreview key={formId} attributes={attributes} />
	</div>
	);
}
