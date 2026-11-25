jest.mock('@wordpress/blocks', () => ({ registerBlockType: jest.fn() }), { virtual: true });
jest.mock('./edit.jsx', () => () => null);
jest.mock('./icon.jsx', () => null);

describe('form block saved as a self-closing comment (#188)', () => {
	let settings;

	beforeAll(() => {
		require('./index.js');
		settings = require('@wordpress/blocks').registerBlockType.mock.calls[0][1];
	});

	it('has a deprecation that accepts empty saved content', () => {
		const empty = settings.deprecated.find((d) => d.save({ attributes: { formId: 3 } }) === null);
		expect(empty).toBeDefined();
		expect(empty.migrate).toBeUndefined();
		expect(empty.attributes).toBe(settings.attributes);
		expect(empty.supports).toBe(settings.supports);
	});

	it('keeps the current save writing the placeholder markup', () => {
		expect(settings.save({ attributes: { formId: 3 } }).props['data-form-id']).toBe(3);
	});
});
