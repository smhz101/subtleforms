import realApiFetch from '@wordpress/api-fetch';
import { registerPreloaded, takePreloaded } from './preload';

const PATH = '/subtleforms/v1/forms?orderby=created_at&order=desc&page=1&per_page=100';
const entry = () => ( { body: { data: [ { id: 1 } ], meta: { total: 1 } }, headers: {} } );

function fakeApi() {
	const used = [];
	return {
		used,
		use: jest.fn( ( m ) => used.push( m ) ),
		// The real middleware, so path matching and one-time use are the real ones.
		createPreloadingMiddleware: jest.fn( ( data ) => realApiFetch.createPreloadingMiddleware( data ) ),
	};
}

describe( 'registerPreloaded', () => {
	it( 'registers one middleware for answers below /subtleforms/v1/', () => {
		const api = fakeApi();
		const ok = registerPreloaded( { [ PATH ]: entry(), '/wp/v2/users': entry() }, api );
		expect( ok ).toBe( true );
		expect( api.use ).toHaveBeenCalledTimes( 1 );
		expect( Object.keys( api.createPreloadingMiddleware.mock.calls[ 0 ][ 0 ] ) ).toEqual( [ PATH ] );
	} );

	it( 'registers nothing without answers', () => {
		const api = fakeApi();
		expect( registerPreloaded( {}, api ) ).toBe( false );
		expect( registerPreloaded( undefined, api ) ).toBe( false );
		expect( registerPreloaded( { '/other': entry() }, api ) ).toBe( false );
		expect( api.use ).not.toHaveBeenCalled();
	} );
} );

describe( 'takePreloaded', () => {
	it( 'returns the answer once, whatever the query order, and drops the middleware copy', async () => {
		const api = fakeApi();
		registerPreloaded( { [ PATH ]: entry() }, api );
		const got = takePreloaded( '/subtleforms/v1/forms?per_page=100&page=1&order=desc&orderby=created_at' );
		expect( got.body.meta.total ).toBe( 1 );
		expect( takePreloaded( PATH ) ).toBeNull();
		// The middleware no longer holds it: the request moves on to the network.
		const next = jest.fn( () => Promise.resolve( 'network' ) );
		await expect( api.used[ 0 ]( { path: PATH }, next ) ).resolves.toBe( 'network' );
		expect( next ).toHaveBeenCalled();
	} );

	it( 'returns null for a path that was not preloaded', () => {
		registerPreloaded( { [ PATH ]: entry() }, fakeApi() );
		expect( takePreloaded( '/subtleforms/v1/forms?status=draft' ) ).toBeNull();
	} );
} );
