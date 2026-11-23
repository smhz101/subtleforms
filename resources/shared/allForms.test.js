import { fetchAllForms } from './allForms';

const page = ( start, count, totalPages ) => ( {
	data: Array.from( { length: count }, ( _, i ) => ( {
		id: start + i,
		title: `Form ${ String( start + i ).padStart( 3, '0' ) }`,
	} ) ),
	meta: { total_pages: totalPages },
} );

describe( 'fetchAllForms', () => {
	it( 'returns every form from three pages', async () => {
		const fetcher = jest
			.fn()
			.mockResolvedValueOnce( page( 1, 100, 3 ) )
			.mockResolvedValueOnce( page( 101, 100, 3 ) )
			.mockResolvedValueOnce( page( 201, 20, 3 ) );
		const forms = await fetchAllForms( { fetcher } );
		expect( forms ).toHaveLength( 220 );
		expect( fetcher ).toHaveBeenCalledTimes( 3 );
		expect( fetcher.mock.calls[ 0 ][ 0 ] ).toBe(
			'/subtleforms/v1/forms?per_page=100&page=1'
		);
		expect( fetcher.mock.calls[ 2 ][ 0 ] ).toContain( 'page=3' );
	} );

	it( 'passes the status and reads a raw Response', async () => {
		const fetcher = jest.fn().mockResolvedValue( {
			json: () => Promise.resolve( page( 1, 2, 1 ) ),
		} );
		const forms = await fetchAllForms( { status: 'publish', fetcher } );
		expect( forms ).toHaveLength( 2 );
		expect( fetcher.mock.calls[ 0 ][ 0 ] ).toContain( '&status=publish' );
	} );

	it( 'sorts by title ignoring case, then by id', async () => {
		const fetcher = jest.fn().mockResolvedValue( {
			data: [
				{ id: 5, title: 'beta' },
				{ id: 9, title: 'Alpha' },
				{ id: 3, title: 'Alpha' },
				{ id: 7, title: 'Zed' },
			],
			meta: { total_pages: 1 },
		} );
		const forms = await fetchAllForms( { fetcher } );
		expect( forms.map( ( f ) => f.id ) ).toEqual( [ 3, 9, 5, 7 ] );
	} );

	it( 'stops after 50 pages', async () => {
		const fetcher = jest.fn().mockResolvedValue( page( 1, 100, 999 ) );
		await fetchAllForms( { fetcher } );
		expect( fetcher ).toHaveBeenCalledTimes( 50 );
	} );

	it( 'rejects when a page fails', async () => {
		const fetcher = jest
			.fn()
			.mockResolvedValueOnce( page( 1, 100, 3 ) )
			.mockRejectedValueOnce( new Error( 'boom' ) );
		await expect( fetchAllForms( { fetcher } ) ).rejects.toThrow( 'boom' );
	} );
} );
