/**
 * Small inline glyphs for the settings panel: marks that the shared icon
 * set does not have (a six dot drag handle, an asterisk, horizontal arrows).
 */

const base = {
	width: 16,
	height: 16,
	viewBox: '0 0 16 16',
	'aria-hidden': 'true',
	focusable: 'false',
};

/** Six dots in two columns, the drag handle of a list row. */
export function GripGlyph( { size = 14 } ) {
	return (
		<svg { ...base } width={ size } height={ size } fill="currentColor" stroke="none">
			<circle cx="5.5" cy="3.5" r="1.1" />
			<circle cx="10.5" cy="3.5" r="1.1" />
			<circle cx="5.5" cy="8" r="1.1" />
			<circle cx="10.5" cy="8" r="1.1" />
			<circle cx="5.5" cy="12.5" r="1.1" />
			<circle cx="10.5" cy="12.5" r="1.1" />
		</svg>
	);
}

/** Asterisk, the mark of a required answer. */
export function AsteriskGlyph( { size = 16 } ) {
	return (
		<svg { ...base } width={ size } height={ size } fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
			<path d="M8 3v10M3.7 5.5l8.6 5M12.3 5.5l-8.6 5" />
		</svg>
	);
}

/** Two arrows pointing apart, the mark of a width. */
export function ArrowsHorizontalGlyph( { size = 16 } ) {
	return (
		<svg { ...base } width={ size } height={ size } fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M2 8h12M4.5 5.5L2 8l2.5 2.5M11.5 5.5L14 8l-2.5 2.5" />
		</svg>
	);
}

/** Eye, the mark of visibility. */
export function EyeGlyph( { size = 16 } ) {
	return (
		<svg { ...base } width={ size } height={ size } fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
			<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
			<circle cx="8" cy="8" r="2" />
		</svg>
	);
}

/** Chevron pointing down; rotate it with CSS. */
export function ChevronGlyph( { size = 14 } ) {
	return (
		<svg { ...base } width={ size } height={ size } fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
			<path d="M4 6l4 4 4-4" />
		</svg>
	);
}
