import { createRoot } from '@wordpress/element';
import { act } from 'react';
import RichTextInput from './RichTextInput';

global.IS_REACT_ACT_ENVIRONMENT = true;

function render( value ) {
  const container = document.createElement( 'div' );
  document.body.appendChild( container );
  const root = createRoot( container );
  act( () =>
    root.render(
      <RichTextInput inputId="rt" name="rt" value={ value } onChange={ () => {} } />
    )
  );
  const editor = container.querySelector( '[contenteditable]' );
  return { container, editor, unmount: () => act( () => root.unmount() ) };
}

test( 'a starting value with markup outside the allowlist is cleaned before it is shown', () => {
  const { editor, unmount } = render(
    'Hi <img src=x onerror="window.__rt=1"><script>window.__rt=2</script><b onclick="window.__rt=3">bold</b>'
  );
  expect( editor.querySelector( 'img' ) ).toBeNull();
  expect( editor.querySelector( 'script' ) ).toBeNull();
  const bold = editor.querySelector( 'b' );
  expect( bold ).not.toBeNull();
  expect( bold.getAttribute( 'onclick' ) ).toBeNull();
  expect( editor.textContent ).toContain( 'bold' );
  expect( window.__rt ).toBeUndefined();
  unmount();
} );

test( 'a javascript: link in the starting value loses its href, a safe link keeps it', () => {
  const { editor, unmount } = render(
    '<a href="javascript:alert(1)">bad</a> <a href=" JaVaScRiPt:alert(1)">bad2</a> <a href="https://example.com/">ok</a>'
  );
  const links = editor.querySelectorAll( 'a' );
  expect( links ).toHaveLength( 3 );
  expect( links[ 0 ].getAttribute( 'href' ) ).toBeNull();
  expect( links[ 1 ].getAttribute( 'href' ) ).toBeNull();
  expect( links[ 2 ].getAttribute( 'href' ) ).toBe( 'https://example.com/' );
  expect( links[ 2 ].getAttribute( 'rel' ) ).toBe( 'noopener noreferrer' );
  unmount();
} );

test( 'allowed formatting in the starting value is kept', () => {
  const { editor, unmount } = render( '<p><strong>a</strong> <em>b</em></p><ul><li>c</li></ul>' );
  expect( editor.querySelector( 'strong' ) ).not.toBeNull();
  expect( editor.querySelector( 'em' ) ).not.toBeNull();
  expect( editor.querySelector( 'ul li' ).textContent ).toBe( 'c' );
  unmount();
} );
