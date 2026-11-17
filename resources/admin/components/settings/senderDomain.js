/**
 * Sender domain helpers for the email settings and the notifications panel.
 */

const clean = ( host ) =>
	String( host || '' )
		.trim()
		.toLowerCase()
		.replace( /\.$/, '' )
		.replace( /^www\./, '' );

/**
 * A host without a leading www., as WordPress core builds its default sender.
 *
 * @param {string} host Site host.
 * @return {string} Host.
 */
export const bareHost = clean;

/**
 * Whether a sender email domain fits the site host. www. is ignored, and a
 * site on a subdomain of the sender domain (or the reverse) counts as a match.
 *
 * @param {string} senderDomain Domain of the sender email.
 * @param {string} siteHost     Site host.
 * @return {boolean} True when they match.
 */
export function senderDomainMatches( senderDomain, siteHost ) {
	const a = clean( senderDomain );
	const b = clean( siteHost );
	if ( ! a || ! b ) {
		return true;
	}
	return a === b || b.endsWith( '.' + a ) || a.endsWith( '.' + b );
}
