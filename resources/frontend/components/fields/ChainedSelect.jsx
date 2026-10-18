import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { chainedPresentation, chainedSelectLevels, nextChainedSelections } from '../../../shared/chainedOptions';

/**
 * Dependent choices, where each level narrows the next.
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
  selectClassName = 'subtleforms-select',
} ) {
  const selections = Array.isArray( value ) ? value : [];
  const rows = chainedSelectLevels( config, selections );
  const presentation = chainedPresentation( config );

  const handleLevelChange = ( depth, newValue ) => {
    onChange( nextChainedSelections( selections, depth, newValue ) );
  };

  if ( rows.length === 0 ) {
    return (
      <p className='subtleforms-chained-select__empty'>
        { __( 'Options are added in the field settings.', 'subtleforms' ) }
      </p>
    );
  }

  return (
    <div className={ clsx( 'subtleforms-chained-select', `is-${ presentation }` ) }>
      { rows.map( ( row ) => {
        const { depth, options } = row;
        const levelId = depth === 0 ? inputId : `${ inputId }-${ depth }`;
        const levelLabel = row.label || __( 'Selection', 'subtleforms' );
        const selected = selections[ depth ] ?? '';

        if ( presentation === 'dropdowns' ) {
          return (
            <div key={ levelId } className='subtleforms-chained-select__level'>
              { depth > 0 && (
                <label className='subtleforms-chained-select__label' htmlFor={ levelId }>
                  { levelLabel }
                </label>
              ) }
              <select
                id={ levelId }
                name={ name ? `${ name }[${ depth }]` : undefined }
                className={ selectClassName }
                value={ selected }
                onChange={ ( event ) => handleLevelChange( depth, event.target.value ) }
                disabled={ disabled }
                aria-required={ depth === 0 ? required : undefined }
                aria-invalid={ depth === 0 ? !! error : undefined }
                aria-describedby={ depth === 0 ? describedBy : undefined }>
                <option value=''>
                  { config?.placeholder || __( 'Select…', 'subtleforms' ) }
                </option>
                { options.map( ( opt ) => (
                  <option key={ opt.value } value={ opt.value }>
                    { opt.label || opt.value }
                  </option>
                ) ) }
              </select>
            </div>
          );
        }

        return (
          <div key={ levelId } className='subtleforms-chained-select__level'>
            <div className='subtleforms-chained-select__label' id={ `${ levelId }-label` }>
              { levelLabel }
            </div>
            <div
              className='subtleforms-chained-select__choices'
              role='radiogroup'
              aria-labelledby={ `${ levelId }-label` }
              aria-required={ depth === 0 ? required : undefined }
              aria-invalid={ depth === 0 ? !! error : undefined }
              aria-describedby={ depth === 0 ? describedBy : undefined }>
              { options.map( ( opt ) => {
                const isSelected = String( selected ) === String( opt.value );
                return (
                  <button
                    key={ opt.value }
                    type='button'
                    className={ clsx( 'subtleforms-chained-select__choice', {
                      'is-selected': isSelected,
                    } ) }
                    aria-pressed={ isSelected }
                    disabled={ disabled }
                    onClick={ () => handleLevelChange( depth, opt.value ) }>
                    <span>{ opt.label || opt.value }</span>
                  </button>
                );
              } ) }
            </div>
          </div>
        );
      } ) }
    </div>
  );
}
