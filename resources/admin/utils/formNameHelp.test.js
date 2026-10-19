import { formNameHelp } from './formNameHelp';

describe( 'formNameHelp', () => {
	it( 'says the name is shown to visitors', () => {
		expect( formNameHelp() ).toBe( 'The name shown to you and your visitors.' );
		expect( formNameHelp() ).not.toMatch( /Only you see/ );
	} );
} );
