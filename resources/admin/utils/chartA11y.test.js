import { chartColumnProps } from './chartA11y';

describe( 'chartColumnProps', () => {
	it( 'gives a bar an image role and a name', () => {
		expect( chartColumnProps( 'Oct 12: 4 submissions' ) ).toEqual( {
			role: 'img',
			'aria-label': 'Oct 12: 4 submissions',
		} );
	} );
} );
