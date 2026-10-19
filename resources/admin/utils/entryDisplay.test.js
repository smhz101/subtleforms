import { displayItems, displayLabel, displayText } from './entryDisplay';

describe( 'entryDisplay', () => {
  const display = {
    plan: { label: 'Plan', text: 'Beta' },
    extras: { label: 'Extras', text: 'One, Two', items: [ 'One', 'Two' ] },
    grid: { label: 'Rate us', text: 'Mon: AM, PM' },
  };

  it( 'shows the text the server formatted, not the stored value', () => {
    expect( displayText( display, 'plan', 'b' ) ).toBe( 'Beta' );
    expect( displayText( display, 'grid', { Mon: { AM: true, PM: true } } ) ).toBe( 'Mon: AM, PM' );
  } );

  it( 'falls back to the stored value when the server sent nothing', () => {
    expect( displayText( {}, 'other', 'x' ) ).toBe( 'x' );
    expect( displayText( undefined, 'other', 3 ) ).toBe( '3' );
  } );

  it( 'gives one string per item of a list answer', () => {
    expect( displayItems( display, 'extras' ) ).toEqual( [ 'One', 'Two' ] );
    expect( displayItems( display, 'plan' ) ).toBeNull();
  } );

  it( 'gives the field name from the server', () => {
    expect( displayLabel( display, 'grid' ) ).toBe( 'Rate us' );
    expect( displayLabel( display, 'missing' ) ).toBeNull();
  } );
} );
