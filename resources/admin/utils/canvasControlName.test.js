import { canvasControlName } from './canvasControlName';

describe( 'canvasControlName', () => {
	it( 'uses the field label, and the option when there is one', () => {
		expect( canvasControlName( { label: 'Email' } ) ).toBe( 'Email' );
		expect( canvasControlName( { label: 'Plan' }, 'Yearly' ) ).toBe( 'Plan: Yearly' );
		expect( canvasControlName( {} ) ).toBe( 'Field' );
	} );
} );
