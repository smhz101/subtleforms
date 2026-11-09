import save from './save.js';
import saveBefore281 from './deprecated.js';
import metadata from './block.json';

const attrs = { formId: 11, theme: 'default', tabIndex: 0, fieldValues: '' };

describe('form block AJAX default (2.8.1)', () => {
	it('defaults to AJAX on in block.json', () => {
		expect(metadata.attributes.ajax.default).toBe(true);
	});

	it('writes the new default into the saved markup', () => {
		expect(save({ attributes: attrs }).props['data-ajax']).toBe('1');
		expect(save({ attributes: { ...attrs, ajax: false } }).props['data-ajax']).toBe('0');
	});

	it('keeps the old markup of blocks saved without an ajax attribute valid', () => {
		// The server default is merged into parsed attributes, so the old
		// save reads off whatever the attribute says.
		expect(saveBefore281({ attributes: { ...attrs, ajax: true } }).props['data-ajax']).toBe('0');
		expect(saveBefore281({ attributes: attrs }).props['data-ajax']).toBe('0');
	});
});
