import { countSchemaFields, fieldDeletedMessage } from './fieldDeleteNotice';

describe( 'field delete notice', () => {
	it( 'counts fields inside steps and ignores the step itself', () => {
		const schema = {
			fields: [
				{ type: 'step', fields: [ { type: 'text' }, { type: 'email' } ] },
				{ type: 'textarea' },
			],
		};
		expect( countSchemaFields( schema ) ).toBe( 3 );
	} );

	it( 'counts fields nested in children, including inside a step (review #21)', () => {
		const schema = {
			fields: [
				{
					type: 'step',
					children: [
						{ type: 'text' },
						{ type: 'group_container', children: [ { type: 'email' }, { type: 'textarea' } ] },
						{ type: 'two_column_container', columns: [ [ { type: 'phone' } ], { fields: [ { type: 'url' } ] } ] },
					],
				},
			],
		};
		expect( countSchemaFields( schema ) ).toBe( 7 );
	} );

	it( 'names a single delete, and stays quiet when nothing was removed', () => {
		expect( fieldDeletedMessage( 1 ) ).toBe( 'Field deleted.' );
		expect( fieldDeletedMessage( 2 ) ).toBe( '2 fields deleted.' );
		expect( fieldDeletedMessage( 0 ) ).toBe( '' );
	} );
} );
