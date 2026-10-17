import { __ } from '@wordpress/i18n';
import { chainedSelectLevels, nextChainedSelections } from '../../../shared/chainedOptions';

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
  selectClassName = 'subtleforms-select',
} ) {
  const selections = Array.isArray( value ) ? value : [];
  const rows = chainedSelectLevels( config, selections );

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
    <div className='subtleforms-chained-select'>
      { rows.map( ( row ) => {
        const { depth, options } = row;
        const levelId = depth === 0 ? inputId : `${ inputId }-${ depth }`;
        const levelLabel = row.label || __( 'Selection', 'subtleforms' );

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
              className={ selectClassName }
              value={ selections[ depth ] ?? '' }
              onChange={ ( e ) => handleLevelChange( depth, e.target.value ) }
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
      } ) }
    </div>
  );
}
