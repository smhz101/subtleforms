/**
 * A form's own CSS, limited to that form (2.7.2).
 *
 * Kept apart from the shared appearance contract so the public bundle only
 * downloads it for a form that has custom CSS (it is loaded on demand by
 * CustomCssStyle). The builder preview, the block editor and the page all run
 * this same function.
 */
import { formScopeClass } from './appearance';

/**
 * Limit every rule of a form's CSS to that form.
 *
 * The same function runs in the builder preview, the block editor and on the
 * page, so a rule means the same thing in all three. Selectors get the form's
 * class in front; `:root`, `html` and `body` mean the form itself. Rules inside
 * @media, @supports, @container and @layer are scoped; @keyframes and
 * @font-face are kept as they are. `@import` goes first, as CSS needs.
 *
 * @param {string}        css    CSS the server already checked.
 * @param {number|string} formId Form ID.
 * @return {string} Scoped CSS.
 */
export function scopeCustomCss( css, formId ) {
  const scope = `.${ formScopeClass( formId ) }`;
  const imports = [];
  // Index of the first stop character outside strings and brackets, or -1.
  const scan = ( text, stops, from = 0 ) => {
    let depth = 0;
    let quote = '';
    for ( let i = from; i < text.length; i++ ) {
      const c = text[ i ];
      if ( quote ) {
        if ( c === '\\' ) {
          i++;
        } else if ( c === quote ) {
          quote = '';
        }
      } else if ( c === '"' || c === "'" ) {
        quote = c;
      } else if ( c === '(' || c === '[' ) {
        depth++;
      } else if ( c === ')' || c === ']' ) {
        depth--;
      } else if ( depth <= 0 && stops.includes( c ) ) {
        return i;
      }
    }
    return -1;
  };
  const selector = ( sel ) => {
    sel = sel.trim();
    if ( ! sel || sel.startsWith( scope ) ) {
      return sel;
    }
    const root = sel.match( /^(?::root|html|body)(?![\w-])/ );
    return root ? scope + sel.slice( root[ 0 ].length ) : `${ scope } ${ sel }`;
  };
  const walk = ( text ) => {
    let out = '';
    let i = 0;
    while ( i < text.length ) {
      const stop = scan( text, [ '{', ';' ], i );
      if ( stop < 0 ) {
        break;
      }
      const prelude = text.slice( i, stop ).trim();
      if ( text[ stop ] === ';' ) {
        if ( /^@import/i.test( prelude ) ) {
          imports.push( `${ prelude };` );
        }
        i = stop + 1;
        continue;
      }
      // The brace that closes this block.
      let depth = 1;
      let quote = '';
      let end = stop + 1;
      for ( ; end < text.length && depth; end++ ) {
        const c = text[ end ];
        if ( quote ) {
          if ( c === '\\' ) {
            end++;
          } else if ( c === quote ) {
            quote = '';
          }
        } else if ( c === '"' || c === "'" ) {
          quote = c;
        } else if ( c === '{' ) {
          depth++;
        } else if ( c === '}' ) {
          depth--;
        }
      }
      const body = text.slice( stop + 1, end - 1 );
      if ( prelude.startsWith( '@' ) ) {
        if ( /^@(media|supports|container|layer)\b/i.test( prelude ) ) {
          out += `${ prelude }{${ walk( body ) }}`;
        } else if ( /^@(-webkit-)?keyframes\b|^@font-face\b/i.test( prelude ) ) {
          out += `${ prelude }{${ body }}`;
        }
      } else {
        const list = [];
        for ( let a = 0, b = 0; b < prelude.length; a = b + 1 ) {
          b = scan( prelude, [ ',' ], a );
          b = b < 0 ? prelude.length : b;
          list.push( selector( prelude.slice( a, b ) ) );
        }
        out += `${ list.filter( Boolean ).join( ',' ) }{${ body }}`;
      }
      i = end;
    }
    return out;
  };
  const rules = walk( String( css || '' ) );
  return imports.join( '' ) + rules;
}

