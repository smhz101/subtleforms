const fs = require( 'fs' );
const path = require( 'path' );

describe( 'Picker.scss contract', () => {
  const scss = fs.readFileSync( path.join( __dirname, 'Picker.scss' ), 'utf8' );

  it( 'does not hard-code a 42px trigger min-height', () => {
    expect( scss ).not.toContain( 'min-height: 42px' );
  } );

  it( 'uses input padding tokens on the trigger', () => {
    expect( scss ).toContain( '--subtleforms-input-padding-y' );
  } );

  it( 'lays out the weekday header and every week as a seven column row', () => {
    expect( scss ).toMatch( /\.subtleforms-picker__week\s*\{[^}]*grid-template-columns: repeat\( ?7/ );
    expect( scss ).toMatch( /\.subtleforms-picker__weekdays,\s*\.subtleforms-picker__week/ );
  } );

  it( 'uses a surface token for the calendar panel', () => {
    expect( scss ).toContain( '--subtleforms-color-surface' );
  } );
} );
