import { formsBatchPath, preloadedFormsBatch } from './formsBatch';

const base = { statusFilter: 'all', searchTerm: '', sortBy: 'created_at', sortDirection: 'desc' };

describe( 'formsBatchPath', () => {
	it( 'builds the default first batch', () => {
		expect( formsBatchPath( { ...base, page: 1, perPage: 100 } ) ).toBe(
			'/forms?orderby=created_at&order=desc&page=1&per_page=100'
		);
	} );
	it( 'adds search and status', () => {
		expect( formsBatchPath( { ...base, statusFilter: 'trash', searchTerm: 'a b', page: 2, perPage: 50 } ) ).toBe(
			'/forms?orderby=created_at&order=desc&search=a+b&status=trash&page=2&per_page=50'
		);
	} );
} );

describe( 'preloadedFormsBatch', () => {
	it( 'asks for the 100 row batch of a 20 row page and returns rows and total', () => {
		const take = jest.fn( () => ( { body: { data: [ { id: 3 } ], meta: { total: 7 } } } ) );
		const out = preloadedFormsBatch( take, { ...base, perPage: 20 } );
		expect( take ).toHaveBeenCalledWith( '/subtleforms/v1/forms?orderby=created_at&order=desc&page=1&per_page=100' );
		expect( out ).toEqual( { rows: [ { id: 3 } ], total: 7 } );
	} );
	it( 'is null when nothing was preloaded or the body is odd', () => {
		expect( preloadedFormsBatch( () => null, { ...base, perPage: 20 } ) ).toBeNull();
		expect( preloadedFormsBatch( () => ( { body: { nope: 1 } } ), { ...base, perPage: 20 } ) ).toBeNull();
	} );
} );
