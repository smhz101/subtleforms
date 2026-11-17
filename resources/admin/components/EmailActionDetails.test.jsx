import { createRoot } from '@wordpress/element';
import { act } from 'react';
import EmailActionDetails from './EmailActionDetails';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render( data ) {
  const el = document.createElement( 'div' );
  act( () => { createRoot( el ).render( <EmailActionDetails data={ data } /> ); } );
  return el;
}

describe( 'EmailActionDetails', () => {
  it( 'shows from, reply-to and format in order for new logs', () => {
    const el = render( {
      to: 'a@x.test', subject: 'Hi', from: 'WordPress <wordpress@x.test>', reply_to: 'b@x.test',
      format: 'html', body_preview: 'Hello\nBye', recipients_count: 1, dispatched: true,
    } );
    const keys = [ ...el.querySelectorAll( 'dt' ) ].map( ( n ) => n.textContent );
    expect( keys ).toEqual( [ 'From', 'To', 'Reply-To', 'Subject', 'Format', 'Preview', 'Recipients count', 'Dispatched' ] );
    expect( el.textContent ).toContain( 'HTML' );
    expect( el.querySelector( '.sf-pipe-data__val--preview' ).textContent ).toBe( 'Hello\nBye' );
  } );

  it( 'strips tags from older HTML previews', () => {
    const el = render( { to: 'a@x.test', body_preview: 'Hello, <br /> <br /> You received <table cellpadding="4' } );
    expect( el.textContent ).not.toContain( '<' );
    expect( el.textContent ).toContain( 'Hello,' );
  } );
} );
