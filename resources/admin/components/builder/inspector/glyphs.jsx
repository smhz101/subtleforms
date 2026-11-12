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

export function GearGlyph( { size = 20 } ) {
	return (
		<svg { ...base } width={ size } height={ size } viewBox="0 0 24 24" fill="currentColor" stroke="none">
			<path
				fillRule="evenodd"
				d="M10.289 4.836A1 1 0 0111.275 4h1.306a1 1 0 01.987.836l.244 1.466c.787.26 1.503.679 2.108 1.218l1.393-.522a1 1 0 011.216.437l.653 1.13a1 1 0 01-.23 1.273l-1.148.944a6.025 6.025 0 010 2.435l1.149.946a1 1 0 01.23 1.272l-.653 1.13a1 1 0 01-1.216.437l-1.394-.522c-.605.54-1.32.958-2.108 1.218l-.244 1.466a1 1 0 01-.987.836h-1.306a1 1 0 01-.986-.836l-.244-1.466a5.995 5.995 0 01-2.108-1.218l-1.394.522a1 1 0 01-1.217-.436l-.653-1.131a1 1 0 01.23-1.272l1.149-.946a6.026 6.026 0 010-2.435l-1.148-.944a1 1 0 01-.23-1.272l.653-1.131a1 1 0 011.217-.437l1.393.522a5.994 5.994 0 012.108-1.218l.244-1.466zM14.929 12a3 3 0 11-6 0 3 3 0 016 0z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

/** The half-filled circle core uses for the Styles tab. */
export function ContrastGlyph( { size = 20 } ) {
	return (
		<svg { ...base } width={ size } height={ size } viewBox="0 0 24 24" fill="currentColor" stroke="none">
			<path d="M12 4a8 8 0 100 16 8 8 0 000-16zm0 1.5a6.5 6.5 0 010 13V5.5z" />
		</svg>
	);
}

/** Four rounded squares, the mark of a set of ready-made looks (Presets). */
export function SwatchGlyph( { size = 20 } ) {
	return (
		<svg { ...base } width={ size } height={ size } viewBox="0 0 24 24" fill="currentColor" stroke="none">
			<path d="M4 5.5A1.5 1.5 0 015.5 4h4A1.5 1.5 0 0111 5.5v4A1.5 1.5 0 019.5 11h-4A1.5 1.5 0 014 9.5v-4zM13 5.5A1.5 1.5 0 0114.5 4h4A1.5 1.5 0 0120 5.5v4a1.5 1.5 0 01-1.5 1.5h-4A1.5 1.5 0 0113 9.5v-4zM4 14.5A1.5 1.5 0 015.5 13h4a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 019.5 20h-4A1.5 1.5 0 014 18.5v-4zM13 14.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5v4a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5v-4z" />
		</svg>
	);
}

/** Check mark, the badge on a selected card. */
export function CheckGlyph( { size = 12 } ) {
	return (
		<svg { ...base } width={ size } height={ size } fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M3.5 8.5l3 3 6-7" />
		</svg>
	);
}
