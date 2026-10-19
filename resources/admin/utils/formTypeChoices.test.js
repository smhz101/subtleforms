import { formTypeChoices, formTypeLabel } from './formTypeChoices';

describe( 'form type names', () => {
	it( 'offers only Standard, Multi-step and Conversational', () => {
		expect( formTypeChoices().map( ( choice ) => choice.label ) ).toEqual( [
			'Standard',
			'Multi-step',
			'Conversational',
		] );
	} );

	it( 'does not use Regular, Single page or Sectioned', () => {
		const labels = formTypeChoices().map( ( choice ) => choice.label ).join( ' ' );
		expect( labels ).not.toMatch( /Regular|Single page|Sectioned/ );
		expect( formTypeLabel( 'sectioned' ) ).toBe( 'Multi-step' );
		expect( formTypeLabel( 'regular' ) ).toBe( 'Standard' );
	} );
} );
