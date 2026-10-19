import { keepRowsAfterFailedLoad, listQueryKey } from './failedLoad';

describe( 'keepRowsAfterFailedLoad', () => {
	it( 'keeps rows when the same query fails again', () => {
		const key = listQueryKey( [ 'published', 'invoice', 'title' ] );
		expect( keepRowsAfterFailedLoad( key, key ) ).toBe( true );
	} );

	it( 'drops rows when a different tab or search fails', () => {
		const published = listQueryKey( [ 'published', '', 'title' ] );
		const trash = listQueryKey( [ 'trash', '', 'title' ] );
		expect( keepRowsAfterFailedLoad( published, trash ) ).toBe( false );
		expect( keepRowsAfterFailedLoad( '', published ) ).toBe( false );
	} );
} );
