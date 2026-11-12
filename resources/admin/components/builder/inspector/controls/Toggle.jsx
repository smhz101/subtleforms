/**
 * The on/off switch of the settings sheet: WordPress's own form toggle,
 * 32 x 18, drawn as a grey track with a white knob that turns to the accent
 * colour when on.
 */
import { FormToggle } from '@wordpress/components';

export default function Toggle( { className = '', ...props } ) {
	return <FormToggle className={ `sf-toggle${ className ? ` ${ className }` : '' }` } { ...props } />;
}
