import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import {
  chainedPresentation,
  chainedSelectLevels,
  defaultChainedColumnSelections,
  nextChainedSelections,
} from '../../../shared/chainedOptions';

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
  const presentation = chainedPresentation( config );
  const activeSelections = presentation === 'columns'
    ? defaultChainedColumnSelections( config, selections )
    : selections;
  const rows = chainedSelectLevels( config, activeSelections, {
    includeEmpty: presentation === 'columns',
  } );
  // Columns show the first choice's lists before anything is picked, but
  // that preview is never written into the answer: an untouched required
  // field stays unanswered (FLD2-09).
  const handleLevelChange = ( depth, newValue ) => {
    onChange( nextChainedSelections( activeSelections, depth, newValue ) );
  };

  const moveChoice = ( event, depth, choiceOptions, index ) => {
    const previous = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const following = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    if ( ! previous && ! following && event.key !== 'Home' && event.key !== 'End' ) {
      return;
    }
    event.preventDefault();
    if ( disabled || choiceOptions.length === 0 ) {
      return;
    }
    let target = index;
    if ( event.key === 'Home' ) {
      target = 0;
    } else if ( event.key === 'End' ) {
      target = choiceOptions.length - 1;
    } else if ( previous ) {
      target = ( index - 1 + choiceOptions.length ) % choiceOptions.length;
    } else {
      target = ( index + 1 ) % choiceOptions.length;
    }
    const choice = choiceOptions[ target ];
    if ( ! choice ) {
      return;
    }
    handleLevelChange( depth, choice.value );
    const focusId = `${ depth === 0 ? inputId : `${ inputId }-${ depth }` }-${ target }`;
    window.requestAnimationFrame( () => {
      document.getElementById( focusId )?.focus();
    } );
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
              { ( row.label || depth > 0 ) && (
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
          <div
            key={ levelId }
            className={ clsx( 'subtleforms-chained-select__level', {
              'is-inactive': presentation === 'columns' && options.length === 0,
            } ) }>
            <div className='subtleforms-chained-select__label' id={ `${ levelId }-label` }>
              { levelLabel }
            </div>
            <div
              className='subtleforms-chained-select__choices'
              role='radiogroup'
              aria-orientation={ presentation === 'columns' ? 'vertical' : 'horizontal' }
              aria-labelledby={ `${ levelId }-label` }
              aria-required={ depth === 0 ? required : undefined }
              aria-invalid={ depth === 0 ? !! error : undefined }
              aria-describedby={ depth === 0 ? describedBy : undefined }
              aria-disabled={ presentation === 'columns' && options.length === 0 ? true : undefined }>
              { options.map( ( opt, index ) => {
                const isSelected = String( selected ) === String( opt.value );
                const groupHasSelection = options.some(
                  ( choice ) => String( selected ) === String( choice.value )
                );
                return (
                  <button
                    key={ opt.value }
                    id={ `${ levelId }-${ index }` }
                    type='button'
                    role='radio'
                    className={ clsx( 'subtleforms-chained-select__choice', {
                      'is-selected': isSelected,
                    } ) }
                    aria-checked={ isSelected }
                    tabIndex={ isSelected || ( ! groupHasSelection && index === 0 ) ? 0 : -1 }
                    disabled={ disabled }
                    onClick={ () => handleLevelChange( depth, opt.value ) }
                    onKeyDown={ ( event ) => moveChoice( event, depth, options, index ) }>
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
