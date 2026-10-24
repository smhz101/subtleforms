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

  it( 'uses a surface token for the calendar panel', () => {
    expect( scss ).toContain( '--subtleforms-color-surface' );
  } );
} );
