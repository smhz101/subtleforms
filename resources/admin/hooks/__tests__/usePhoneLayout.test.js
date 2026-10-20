import { act } from 'react';
import { createRoot } from 'react-dom/client';
import usePhoneLayout, { PHONE_LAYOUT_QUERY } from '../usePhoneLayout';

// A matchMedia that answers max-width queries for the current test width.
// @wordpress/compose caches the list per query, so `matches` reads the width
// live.
let currentWidth = 1024;
window.matchMedia = (query) => {
	const max = /max-width:\s*(\d+)px/.exec(query);
	return {
		get matches() {
			return max ? currentWidth <= Number(max[1]) : false;
		},
		media: query,
		addListener() {},
		removeListener() {},
		addEventListener() {},
		removeEventListener() {},
	};
};

function measure(width) {
	currentWidth = width;
	const el = document.createElement('div');
	const root = createRoot(el);
	let value;
	function Probe() {
		value = usePhoneLayout();
		return null;
	}
	act(() => root.render(<Probe />));
	act(() => root.unmount());
	return value;
}

describe('usePhoneLayout (review of #47)', () => {
	beforeAll(() => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	});

	test('matches the 599px card breakpoint of the admin styles', () => {
		expect(PHONE_LAYOUT_QUERY).toBe('(max-width: 599px)');
	});

	test('is on up to 599px, where the cards show', () => {
		expect(measure(390)).toBe(true);
		expect(measure(540)).toBe(true);
		expect(measure(599)).toBe(true);
	});

	test('is off from 600px, where the styles show the desktop layout', () => {
		expect(measure(600)).toBe(false);
		expect(measure(1024)).toBe(false);
	});
});
