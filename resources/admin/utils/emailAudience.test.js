import { emailAudience, emailSwitchOff } from './emailAudience';

describe( 'emailAudience matches EmailAction::audience()', () => {
  test.each( [
    [ '{email}', 'submitter' ],
    [ '{{email}}', 'submitter' ],
    [ '{field:email}', 'submitter' ],
    [ '{{field:email}}', 'submitter' ],
    [ 'copy@example.com, {email}', 'submitter' ],
    [ 'owner@example.com', 'admin' ],
    [ '{admin_email}', 'admin' ],
    [ '{{admin_email}}', 'admin' ],
    [ '{site_name}', 'admin' ],
    [ '', 'admin' ],
    [ undefined, 'admin' ],
    [ 42, 'admin' ],
  ] )( '%p is %s', ( to, expected ) => {
    expect( emailAudience( to ) ).toBe( expected );
  } );
} );

describe( 'emailSwitchOff', () => {
  test( 'submitter emails are off unless the switch is on', () => {
    expect( emailSwitchOff( 'submitter', { user_confirmation_enabled: false } ) ).toBe( 'submitter_off' );
    expect( emailSwitchOff( 'submitter', {} ) ).toBe( 'submitter_off' );
    expect( emailSwitchOff( 'submitter', { user_confirmation_enabled: true } ) ).toBeNull();
  } );

  test( 'admin notifications are on unless the switch is off', () => {
    expect( emailSwitchOff( 'admin', { admin_notification_enabled: false } ) ).toBe( 'admin_off' );
    expect( emailSwitchOff( 'admin', { admin_notification_enabled: true } ) ).toBeNull();
    expect( emailSwitchOff( 'admin', {} ) ).toBeNull();
  } );

  test( 'nothing is warned before the settings load', () => {
    expect( emailSwitchOff( 'submitter', null ) ).toBeNull();
  } );
} );
