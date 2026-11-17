import { senderDomainMatches, bareHost } from './senderDomain';

describe( 'senderDomainMatches', () => {
	test( 'ignores www on the site host', () => {
		expect( senderDomainMatches( 'tooltique.co.uk', 'www.tooltique.co.uk' ) ).toBe( true );
	} );
	test( 'allows a sender subdomain of the site', () => {
		expect( senderDomainMatches( 'mail.example.com', 'example.com' ) ).toBe( true );
	} );
	test( 'allows a site subdomain of the sender domain', () => {
		expect( senderDomainMatches( 'example.com', 'shop.example.com.' ) ).toBe( true );
	} );
	test( 'flags a different domain', () => {
		expect( senderDomainMatches( 'gmail.com', 'example.com' ) ).toBe( false );
		expect( senderDomainMatches( 'notexample.com', 'example.com' ) ).toBe( false );
	} );
	test( 'empty values are not a mismatch', () => {
		expect( senderDomainMatches( '', 'example.com' ) ).toBe( true );
		expect( senderDomainMatches( 'example.com', '' ) ).toBe( true );
	} );
	test( 'bareHost strips www', () => {
		expect( bareHost( 'WWW.Example.com' ) ).toBe( 'example.com' );
	} );
} );
