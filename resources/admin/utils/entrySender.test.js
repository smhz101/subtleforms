import { entrySender } from './entrySender';

describe( 'entrySender', () => {
  it( 'uses a name answer and an email answer', () => {
    expect( entrySender( { full_name: { first_name: 'Ada', last_name: 'Lovelace' }, email: 'ada@example.com' } ) )
      .toEqual( { name: 'Ada Lovelace', email: 'ada@example.com' } );
  } );

  it( 'never takes a quantity or a select value as the sender (PAY2-06)', () => {
    expect( entrySender( { product_1: '2', plan: 'no', sticker: '1' } ) ).toEqual( { name: '', email: '' } );
  } );

  it( 'falls back to the email when there is no name field', () => {
    expect( entrySender( { qty: '2', your_email: 'buyer@example.com' } ) ).toEqual( { name: '', email: 'buyer@example.com' } );
  } );
} );
