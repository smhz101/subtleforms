import { wizardCreateBody } from './wizardCreate';

describe( 'wizardCreateBody', () => {
	it( 'sends a title and schema, and does not send status', () => {
		const body = wizardCreateBody( {
			goal: 'contact',
			type: 'regular',
			fields: [ { type: 'text', key: 'name' } ],
		} );
		expect( body.title ).toBe( 'My Contact' );
		expect( body.schema.metadata.type ).toBe( 'regular' );
		expect( body.schema.fields ).toHaveLength( 1 );
		expect( body ).not.toHaveProperty( 'status' );
	} );
} );
