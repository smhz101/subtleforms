import { toolbarButtonTabIndex, toolbarVisibilityProps } from './toolbarA11y';

describe( 'hidden field toolbar', () => {
	it( 'drops hidden buttons from the tab order', () => {
		expect( toolbarVisibilityProps( false ) ).toEqual( {
			'aria-hidden': true,
			inert: '',
		} );
		expect( toolbarButtonTabIndex( false ) ).toBe( -1 );
	} );

	it( 'leaves a visible toolbar in the tab order', () => {
		expect( toolbarButtonTabIndex( true ) ).toBeUndefined();
		expect( toolbarVisibilityProps( true )[ 'aria-hidden' ] ).toBe( false );
	} );
} );
