import { previewScale } from './previewScale';

describe( 'previewScale', () => {
	it( 'shrinks a desktop form into a narrower canvas', () => {
		expect( previewScale( 640, 1280 ) ).toBe( 0.5 );
	} );

	it( 'does not enlarge a form that already fits', () => {
		expect( previewScale( 1600, 1280 ) ).toBe( 1 );
	} );

	it( 'stays at full size until a width is known', () => {
		expect( previewScale( 0, 1280 ) ).toBe( 1 );
		expect( previewScale( 400, 0 ) ).toBe( 1 );
	} );
} );
