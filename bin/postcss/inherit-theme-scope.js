/**
 * PostCSS plugin: "Inherit from theme" forms get no visual CSS from SubtleForms.
 *
 * A form with the theme preset carries the class `subtleforms--inherit-theme` on
 * its root. The site owner chose it so the theme styles everything: colours,
 * borders, fonts, sizes, padding and margins. Several forms on one page can use
 * different presets and they share one stylesheet, so the theme form cannot
 * simply skip the stylesheet. Instead, at build time, every declaration that
 * paints something is limited to forms without that class, and only layout
 * stays shared.
 *
 * How a rule is treated:
 * - Declarations whose property is in LAYOUT (display, flex, grid, position,
 *   width, overflow and similar) and custom properties stay in the rule as it
 *   was, for every form.
 * - All other declarations (colour, background, border, font, padding, margin,
 *   height, shadow, transition and so on) move to a copy of the rule whose
 *   selectors only match inside a form without `subtleforms--inherit-theme`.
 *   The scope is wrapped in :where(), so specificity is exactly what it was and
 *   the cascade for every other preset does not change.
 * - A rule whose first child is the comment `/*! inherit: keep *\/` stays whole
 *   for every form. It is used for the few rules a form needs to work whatever
 *   the theme: screen-reader-only text, field errors, success and error boxes,
 *   the custom dropdown list, and the spacing between fields.
 * - Rules between `/*! inherit: keep-start (reason) *\/` and
 *   `/*! inherit: keep-end *\/` stay whole. Used for custom widgets that have no
 *   native control for a theme to style (signature pad, rich text editor,
 *   scales, toggles, step indicators): without their own styles they cannot be
 *   used.
 * - A file that starts with `/*! inherit: keep-file *\/` is left alone.
 *
 * Only files under resources/frontend/ are processed. The marker comments are
 * removed from the output.
 *
 * @package SubtleForms
 */

'use strict';

const SCOPE_CLASS = 'subtleforms--inherit-theme';
const SCOPE = `:where(:not(.${ SCOPE_CLASS }))`;
const ROOT_SCOPE = `:where(.subtleforms:not(.${ SCOPE_CLASS }))`;

/**
 * Classes that sit on the form's root element. A selector compound with one of
 * these targets the root itself, so the scope goes into that compound rather
 * than in front of it.
 */
const ROOT_TOKEN =
	/\.subtleforms(?:--(?:type|layout|input|button|buttons|preset|inherit|theme)[\w-]*)?(?![\w-])/;

/**
 * Elements rendered outside the form root (the shortcode or block container,
 * and the loading and load-error messages shown before the form exists). They
 * can never be inside a theme form, so rules for them are not scoped.
 */
const OUTSIDE_ROOT =
	/^\.subtleforms-(?:form-container|block|loading|unavailable)(?![\w-])/;

/** Properties that only arrange things. They stay for every form. */
const LAYOUT = new Set( [
	'display',
	'flex',
	'flex-basis',
	'flex-direction',
	'flex-flow',
	'flex-grow',
	'flex-shrink',
	'flex-wrap',
	'grid',
	'grid-area',
	'grid-auto-columns',
	'grid-auto-flow',
	'grid-auto-rows',
	'grid-column',
	'grid-column-end',
	'grid-column-start',
	'grid-row',
	'grid-row-end',
	'grid-row-start',
	'grid-template',
	'grid-template-areas',
	'grid-template-columns',
	'grid-template-rows',
	'gap',
	'row-gap',
	'column-gap',
	'order',
	'align-content',
	'align-items',
	'align-self',
	'justify-content',
	'justify-items',
	'justify-self',
	'place-content',
	'place-items',
	'place-self',
	'position',
	'inset',
	'top',
	'right',
	'bottom',
	'left',
	'z-index',
	'width',
	'min-width',
	'max-width',
	'overflow',
	'overflow-x',
	'overflow-y',
	'visibility',
	'clip',
	'clip-path',
	'white-space',
	'box-sizing',
	'float',
	'clear',
	'content',
	'pointer-events',
	'cursor',
	'opacity',
	'list-style',
	'list-style-type',
	'text-align',
	'vertical-align',
	'resize',
	'user-select',
	'table-layout',
	'object-fit',
	'aspect-ratio',
	'contain',
	'isolation',
	'transform',
	'transform-origin',
	'animation',
	'animation-name',
	'animation-duration',
	'animation-timing-function',
	'animation-iteration-count',
	'animation-direction',
	'animation-fill-mode',
	'animation-delay',
	'touch-action',
] );

const KEEP_RULE = /^!?\s*inherit:\s*keep\s*$/;
const KEEP_FILE = /^!?\s*inherit:\s*keep-file\s*$/;
const KEEP_START = /^!?\s*inherit:\s*keep-start\b/;
const KEEP_END = /^!?\s*inherit:\s*keep-end\b/;

/**
 * Whether a declaration only arranges things.
 *
 * @param {import('postcss').Declaration} decl Declaration.
 * @return {boolean} True for layout and custom properties.
 */
function isLayout( decl ) {
	const prop = decl.prop.toLowerCase();
	return prop.startsWith( '--' ) || LAYOUT.has( prop.replace( /^-(webkit|moz|ms)-/, '' ) );
}

/**
 * Split a selector into its compounds, keeping the combinators. Commas are
 * handled by the caller. Brackets and parentheses are respected so `:not(a b)`
 * and `[data-x="a b"]` stay whole.
 *
 * @param {string} selector One selector (no top-level commas).
 * @return {string[]} Alternating compounds and combinators.
 */
function compounds( selector ) {
	const parts = [];
	let depth = 0;
	let quote = '';
	let current = '';
	for ( let i = 0; i < selector.length; i++ ) {
		const ch = selector[ i ];
		if ( quote ) {
			current += ch;
			if ( ch === quote && selector[ i - 1 ] !== '\\' ) {
				quote = '';
			}
			continue;
		}
		if ( ch === '"' || ch === "'" ) {
			quote = ch;
			current += ch;
			continue;
		}
		if ( ch === '(' || ch === '[' ) {
			depth++;
		} else if ( ch === ')' || ch === ']' ) {
			depth--;
		}
		if ( depth === 0 && /[\s>+~]/.test( ch ) ) {
			if ( current ) {
				parts.push( current );
				current = '';
			}
			let comb = ch;
			while ( i + 1 < selector.length && /[\s>+~]/.test( selector[ i + 1 ] ) ) {
				comb += selector[ ++i ];
			}
			parts.push( comb.trim() === '' ? ' ' : ` ${ comb.trim() } ` );
			continue;
		}
		current += ch;
	}
	if ( current ) {
		parts.push( current );
	}
	return parts;
}

/**
 * Insert the scope before any pseudo-element of a compound
 * (`.a::before` becomes `.a:where(...)::before`).
 *
 * @param {string} compound Compound selector.
 * @param {string} scope    Pseudo-class to add.
 * @return {string} Scoped compound.
 */
function addToCompound( compound, scope ) {
	const at = compound.search( /::|:(?:before|after|placeholder|marker|selection)\b/ );
	return at === -1 ? compound + scope : compound.slice( 0, at ) + scope + compound.slice( at );
}

/**
 * Limit one selector to forms that are not theme forms. Returns null when the
 * selector must not be scoped (:root, outside-root elements).
 *
 * @param {string} selector One selector.
 * @return {string|null} Scoped selector, or null to leave it as it is.
 */
function scopeSelector( selector ) {
	const trimmed = selector.trim();
	if ( trimmed === '' || /^:root\b|^html\b|^body\b/.test( trimmed ) ) {
		return null;
	}
	const parts = compounds( trimmed );
	for ( let i = 0; i < parts.length; i += 2 ) {
		if ( ROOT_TOKEN.test( parts[ i ] ) ) {
			parts[ i ] = addToCompound( parts[ i ], SCOPE );
			return parts.join( '' );
		}
	}
	if ( OUTSIDE_ROOT.test( parts[ 0 ] ) ) {
		// The container itself, or something inside it. A descendant of the
		// container is inside the form root, so the root scope goes between them.
		return parts.length === 1 || parts[ 1 ] !== ' '
			? null
			: `${ parts[ 0 ] } ${ ROOT_SCOPE } ${ parts.slice( 2 ).join( '' ) }`;
	}
	return `${ ROOT_SCOPE } ${ trimmed }`;
}

/**
 * Split a selector list on top-level commas.
 *
 * @param {string} list Selector list.
 * @return {string[]} Selectors.
 */
function splitList( list ) {
	const out = [];
	let depth = 0;
	let current = '';
	for ( const ch of list ) {
		if ( ch === '(' || ch === '[' ) {
			depth++;
		} else if ( ch === ')' || ch === ']' ) {
			depth--;
		}
		if ( ch === ',' && depth === 0 ) {
			out.push( current );
			current = '';
			continue;
		}
		current += ch;
	}
	out.push( current );
	return out.map( ( s ) => s.trim() ).filter( Boolean );
}

/**
 * Whether a rule sits inside @keyframes (its "selectors" are percentages).
 *
 * @param {import('postcss').Rule} rule Rule.
 * @return {boolean} True inside keyframes.
 */
function inKeyframes( rule ) {
	for ( let p = rule.parent; p; p = p.parent ) {
		if ( p.type === 'atrule' && /keyframes$/i.test( p.name ) ) {
			return true;
		}
	}
	return false;
}

/**
 * The plugin.
 *
 * @param {Object}   [options]       Options.
 * @param {Function} [options.match] Decides from the source path whether a file is processed.
 * @return {Object} PostCSS plugin.
 */
function inheritThemeScope( options = {} ) {
	const match = options.match || ( ( file ) => /[\\/]resources[\\/]frontend[\\/]/.test( file || '' ) );
	return {
		postcssPlugin: 'subtleforms-inherit-theme-scope',
		// OnceExit: postcss-import inlines @import in its Once step, so the imported
		// files are only in the tree once every plugin has run.
		OnceExit( root ) {
			const file = root.source && root.source.input && root.source.input.file;
			if ( ! match( file ) ) {
				return;
			}
			const first = root.first;
			if ( first && first.type === 'comment' && KEEP_FILE.test( first.text ) ) {
				first.remove();
				return;
			}
			// Rules between `/*! inherit: keep-start */` and `/*! inherit: keep-end */`
			// (at the top level of the file) stay whole, like a marked rule.
			const kept = new WeakSet();
			let keeping = false;
			root.each( ( node ) => {
				if ( node.type === 'comment' && KEEP_START.test( node.text ) ) {
					keeping = true;
					return;
				}
				if ( node.type === 'comment' && KEEP_END.test( node.text ) ) {
					keeping = false;
					return;
				}
				if ( keeping ) {
					if ( node.type === 'rule' ) {
						kept.add( node );
					}
					if ( node.walkRules ) {
						node.walkRules( ( r ) => kept.add( r ) );
					}
				}
			} );
			root.walkRules( ( rule ) => {
				if ( inKeyframes( rule ) || kept.has( rule ) ) {
					return;
				}
				const head = rule.first;
				if ( head && head.type === 'comment' && KEEP_RULE.test( head.text ) ) {
					head.remove();
					return;
				}
				const visual = [];
				rule.each( ( node ) => {
					if ( node.type === 'decl' && ! isLayout( node ) ) {
						visual.push( node );
					}
				} );
				if ( visual.length === 0 ) {
					return;
				}
				const scoped = [];
				let unscoped = false;
				for ( const sel of splitList( rule.selector ) ) {
					const s = scopeSelector( sel );
					if ( s === null ) {
						unscoped = true;
					} else {
						scoped.push( s );
					}
				}
				if ( unscoped && scoped.length === 0 ) {
					return; // Nothing in this rule can be inside a form root.
				}
				if ( unscoped ) {
					// Mixed list: keep the outside-root selectors as they were in a
					// copy, and scope the rest below.
					const outside = splitList( rule.selector ).filter( ( sel ) => scopeSelector( sel ) === null );
					kept.add( rule.cloneBefore( { selector: outside.join( ', ' ) } ) );
				}
				const copy = rule.clone( { selector: scoped.join( ', ' ), nodes: [] } );
				kept.add( copy ); // The walk reaches the copy next; it is done.
				for ( const decl of visual ) {
					copy.append( decl.clone() );
					decl.remove();
				}
				rule.after( copy );
				rule.selector = unscoped
					? splitList( rule.selector ).filter( ( sel ) => scopeSelector( sel ) !== null ).join( ', ' )
					: rule.selector;
				if ( rule.nodes.length === 0 ) {
					rule.remove();
				}
			} );
			root.walkComments( ( c ) => {
				if ( [ KEEP_RULE, KEEP_FILE, KEEP_START, KEEP_END ].some( ( re ) => re.test( c.text ) ) ) {
					c.remove();
				}
			} );
		},
	};
}
inheritThemeScope.postcss = true;

module.exports = inheritThemeScope;
module.exports.scopeSelector = scopeSelector;
