import { secretUnreadable } from './secretUnreadable';

describe( 'secretUnreadable', () => {
	afterEach( () => {
		delete window.subtleformsData;
	} );

	it( 'asks for the secret key again when the saved one cannot be read', () => {
		window.subtleformsData = { secretsUnreadable: [ 'captcha_hcaptcha_secret_key' ] };
		expect( secretUnreadable( {}, 'captcha_hcaptcha_secret_key' ) ).toBe( 'Your secret key could not be read. Please enter it again.' );
	} );

	it( 'says nothing when the key is readable or a new one is typed', () => {
		window.subtleformsData = { secretsUnreadable: [ 'captcha_hcaptcha_secret_key' ] };
		expect( secretUnreadable( { captcha_hcaptcha_secret_key: 'new' }, 'captcha_hcaptcha_secret_key' ) ).toBeUndefined();
		expect( secretUnreadable( {}, 'captcha_recaptcha_secret_key' ) ).toBeUndefined();
	} );
} );
