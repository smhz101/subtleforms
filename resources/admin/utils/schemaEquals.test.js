import { schemaEquals } from './schemaEquals';

describe( 'schemaEquals', () => {
  it( 'matches a schema against a fresh copy of itself', () => {
    const schema = {
      metadata: { title: 'Contact', appearance: { tokens: { colorPrimary: '#f00' } } },
      fields: [ { type: 'text', config: { key: 'name', label: 'Name' } } ],
    };

    expect( schemaEquals( schema, JSON.parse( JSON.stringify( schema ) ) ) ).toBe( true );
  } );

  it( 'ignores key order, which differs between a spread object and a parsed one', () => {
    expect( schemaEquals( { a: 1, b: 2 }, { b: 2, a: 1 } ) ).toBe( true );
  } );

  it( 'treats an absent key and an undefined one as the same', () => {
    // The API drops undefined on the way out, so keeping them distinct would
    // report a change on every round trip.
    expect( schemaEquals( { a: 1, b: undefined }, { a: 1 } ) ).toBe( true );
  } );

  it( 'sees a changed value', () => {
    expect( schemaEquals( { a: 1 }, { a: 2 } ) ).toBe( false );
  } );

  it( 'sees a changed nested value', () => {
    expect(
      schemaEquals(
        { metadata: { appearance: { preset: 'soft' } } },
        { metadata: { appearance: { preset: 'dark' } } }
      )
    ).toBe( false );
  } );

  it( 'sees an added key', () => {
    expect( schemaEquals( { a: 1 }, { a: 1, b: 2 } ) ).toBe( false );
  } );

  it( 'distinguishes a null from a missing key', () => {
    expect( schemaEquals( { a: null }, {} ) ).toBe( false );
  } );

  it( 'compares arrays by position', () => {
    expect( schemaEquals( [ 1, 2, 3 ], [ 1, 2, 3 ] ) ).toBe( true );
    expect( schemaEquals( [ 1, 2, 3 ], [ 3, 2, 1 ] ) ).toBe( false );
    expect( schemaEquals( [ 1, 2 ], [ 1, 2, 3 ] ) ).toBe( false );
  } );

  it( 'does not confuse an array with an object holding the same indices', () => {
    expect( schemaEquals( [ 1 ], { 0: 1 } ) ).toBe( false );
  } );

  it( 'does not confuse types that coerce to each other', () => {
    expect( schemaEquals( 0, '0' ) ).toBe( false );
    expect( schemaEquals( 0, false ) ).toBe( false );
    expect( schemaEquals( null, undefined ) ).toBe( false );
  } );

  it( 'keeps a zero, which is a real value and not an absence', () => {
    expect( schemaEquals( { width: 0 }, { width: 0 } ) ).toBe( true );
    expect( schemaEquals( { width: 0 }, {} ) ).toBe( false );
  } );

  it( 'handles a deeply nested field tree', () => {
    const tree = ( label ) => ( {
      fields: [
        {
          type: 'group_container',
          children: [
            { type: 'columns', columns: [ [ { type: 'text', config: { label } } ] ] },
          ],
        },
      ],
    } );

    expect( schemaEquals( tree( 'Name' ), tree( 'Name' ) ) ).toBe( true );
    expect( schemaEquals( tree( 'Name' ), tree( 'Email' ) ) ).toBe( false );
  } );
} );
