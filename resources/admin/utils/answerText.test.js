import { answerText } from './answerText';

describe( 'answerText', () => {
  const radio = { type: 'radio', options: [ { label: 'New website', value: 'new-website' } ] };

  it( 'shows the option label for a stored value', () => {
    expect( answerText( 'new-website', radio ) ).toBe( 'New website' );
  } );

  it( 'keeps an unknown value as it is', () => {
    expect( answerText( 'other', radio ) ).toBe( 'other' );
  } );

  it( 'shows Yes and No for consent and toggles', () => {
    expect( answerText( 1, { type: 'consent' } ) ).toBe( 'Yes' );
    expect( answerText( '0', { type: 'toggle' } ) ).toBe( 'No' );
  } );

  it( 'reads options inside config', () => {
    expect( answerText( 'b', { type: 'select', config: { options: [ { label: 'Bee', value: 'b' } ] } } ) ).toBe( 'Bee' );
  } );
} );
