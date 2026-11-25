/**
 * Block form picker: every published form is listed across pages, with its id,
 * searchable, and the current selection shows before the list loads.
 */
jest.mock('@wordpress/api-fetch');
import { act } from 'react';
import { createElement, render, unmountComponentAtNode } from '@wordpress/element';
import { screen, fireEvent } from '@testing-library/dom';
import apiFetch from '@wordpress/api-fetch';
import FormPicker, { useForms } from './FormPicker';

global.IS_REACT_ACT_ENVIRONMENT = true;
window.HTMLElement.prototype.scrollIntoView = jest.fn();

const makePage = (from, count) =>
	Array.from({ length: count }, (_, i) => ({
		id: from + i,
		title: `Form ${String(from + i).padStart(3, '0')}`,
	}));

function Harness({ value }) {
	const state = useForms();
	return createElement(FormPicker, { ...state, value, onChange: () => {} });
}

describe('block form picker', () => {
	let host;
	beforeEach(() => {
		apiFetch.mockReset();
		host = document.createElement('div');
		document.body.appendChild(host);
	});
	afterEach(() => {
		unmountComponentAtNode(host);
		host.remove();
	});

	const mount = async (value) => {
		await act(async () => {
			render(createElement(Harness, { value }), host);
		});
		// Let the paged requests settle.
		for (let i = 0; i < 5; i++) {
			await act(async () => {
				await new Promise((r) => setTimeout(r, 0));
			});
		}
	};

	test('lists all 270 forms with ids, search narrows, unknown selection shows', async () => {
		const pages = [makePage(1, 100), makePage(101, 100), makePage(201, 70)];
		apiFetch.mockImplementation(({ path }) => {
			const n = Number(/[?&]page=(\d+)/.exec(path)[1]);
			return Promise.resolve({ data: pages[n - 1] || [] });
		});
		await mount(999);
		expect(apiFetch).toHaveBeenCalledTimes(3);
		expect(apiFetch.mock.calls[0][0].path).toContain('status=published');

		const input = screen.getByRole('combobox', { name: 'Form' });
		expect(input.value).toBe('Form #999');
		await act(async () => {
			fireEvent.focus(input);
			fireEvent.click(input);
		});
		expect(screen.getAllByRole('option')).toHaveLength(271);
		expect(screen.getByText('Form 270 (#270)')).toBeTruthy();

		await act(async () => {
			fireEvent.change(input, { target: { value: 'Form 270' } });
		});
		const matches = screen.getAllByRole('option');
		expect(matches).toHaveLength(1);
		expect(matches[0].textContent).toContain('Form 270 (#270)');
	});

	test('shows loading help and a disabled control while loading', async () => {
		apiFetch.mockReturnValue(new Promise(() => {}));
		await mount(5);
		expect(screen.getByText('Loading forms…')).toBeTruthy();
		expect(screen.getByRole('combobox', { name: 'Form' }).disabled).toBe(true);
		expect(screen.getByRole('combobox', { name: 'Form' }).value).toBe('5');
	});

	test('shows a warning notice when the request fails and keeps the selection', async () => {
		apiFetch.mockRejectedValue(new Error('nope'));
		await mount(5);
		expect(
			screen.getAllByText('Forms could not be loaded. Reload the editor to try again.').length
		).toBeGreaterThan(0);
		expect(screen.getByRole('combobox', { name: 'Form' }).value).toBe('Form #5');
	});

	describe('edit this form link', () => {
		afterEach(() => {
			delete window.subtleformsAdmin;
		});
		const setup = async (value, editFormUrl) => {
			window.subtleformsAdmin = editFormUrl ? { editFormUrl } : {};
			apiFetch.mockResolvedValue({ data: makePage(1, 3) });
			await mount(value);
		};

		test('links to the builder for the selected form', async () => {
			await setup(2, 'http://x.test/wp-admin/admin.php?page=subtleforms-new-form&form_id=');
			const link = screen.getByRole('link', { name: /Edit this form/ });
			expect(link.getAttribute('href')).toBe(
				'http://x.test/wp-admin/admin.php?page=subtleforms-new-form&form_id=2'
			);
		});

		test('is hidden when no form is selected', async () => {
			await setup(0, 'http://x.test/?form_id=');
			expect(screen.queryByRole('link', { name: /Edit this form/ })).toBeNull();
		});

		test('is hidden without editFormUrl', async () => {
			await setup(2, '');
			expect(screen.queryByRole('link', { name: /Edit this form/ })).toBeNull();
		});
	});
});
