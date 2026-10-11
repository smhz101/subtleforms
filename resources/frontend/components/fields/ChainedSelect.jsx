import { __ } from '@wordpress/i18n';

/**
 * Dependent dropdowns, where each level narrows the next.
 *
 * The schema supplies levels as either:
 *   levels: [{ label, options: [{ value, label, children: [...] }] }]
 * or a flat `options` tree, which is treated as a single level.
 *
 * The value is an array of selections, one per level. Changing a level clears
 * everything downstream, because those choices no longer apply.
 */
export default function ChainedSelect( {
  inputId,
  name,
  describedBy,
  config,
  value,
  onChange,
  required,
  error,
  disabled = false,
} ) {
  const selections = Array.isArray( value ) ? value : [];
  const levels = Array.isArray( config.levels ) ? config.levels : null;

  // Walk the option tree to find what is selectable at each depth.
  const optionsForLevel = ( depth ) => {
    if ( levels ) {
      return Array.isArray( levels[ depth ]?.options )
        ? levels[ depth ].options
        : [];
    }

    let nodes = Array.isArray( config.options ) ? config.options : [];
    for ( let i = 0; i < depth; i++ ) {
      const chosen = nodes.find( ( o ) => String( o.value ) === String( selections[ i ] ) );
      nodes = Array.isArray( chosen?.children ) ? chosen.children : [];
    }
    return nodes;
  };

  const levelCount = levels
    ? levels.length
    : // Depth of the tree along the current selection path, plus one more to
      // offer while the user still has somewhere to go.
      selections.reduce( ( depth, _sel, i ) => {
        return optionsForLevel( i + 1 ).length > 0 ? depth + 1 : depth;
      }, 1 );

  const handleLevelChange = ( depth, newValue ) => {
    // Downstream selections were scoped to the old value — drop them.
    const next = selections.slice( 0, depth );
    next[ depth ] = newValue;
    onChange( next.filter( ( v ) => v !== '' ) );
  };

  return (
    <div className='subtleforms-chained-select'>
      { Array.from( { length: levelCount } ).map( ( _, depth ) => {
        const options = optionsForLevel( depth );

        if ( options.length === 0 ) {
          return null;
        }

        const levelId = depth === 0 ? inputId : `${ inputId }-${ depth }`;
        const levelLabel =
          levels?.[ depth ]?.label ||
          /* translators: %d: dropdown position in a chain of dependent dropdowns */
          __( 'Selection', 'subtleforms' );

        return (
          <div key={ levelId } className='subtleforms-chained-select__level'>
            { depth > 0 && (
              <label
                className='subtleforms-chained-select__label'
                htmlFor={ levelId }>
                { levelLabel }
              </label>
            ) }
            <select
              id={ levelId }
              name={ name ? `${ name }[${ depth }]` : undefined }
              className='subtleforms-select'
              value={ selections[ depth ] ?? '' }
              onChange={ ( e ) => handleLevelChange( depth, e.target.value ) }
              disabled={ disabled }
              aria-required={ depth === 0 ? required : undefined }
              aria-invalid={ depth === 0 ? !! error : undefined }
              aria-describedby={ depth === 0 ? describedBy : undefined }>
              <option value=''>
                { config.placeholder || __( 'Select…', 'subtleforms' ) }
              </option>
              { options.map( ( opt ) => (
                <option key={ opt.value } value={ opt.value }>
                  { opt.label || opt.value }
                </option>
              ) ) }
            </select>
          </div>
        );
      } ) }
    </div>
  );
}
