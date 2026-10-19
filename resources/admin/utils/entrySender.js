/**
 * Who sent an entry, for the Submissions list.
 *
 * The name comes from a name answer (a Name field, or a key such as
 * full_name or your_name) and the email from an email answer. Other answers
 * are never used: a product quantity or a select value is not a person
 * (PAY2-06). With neither, the list shows "Anonymous".
 */

const flat = ( v ) => {
  if ( v === null || v === undefined ) return '';
  if ( typeof v === 'object' ) {
    if ( v.first_name || v.last_name ) {
      return [ v.first_name, v.last_name ].filter( Boolean ).join( ' ' );
    }
    return '';
  }
  return String( v );
};

/**
 * @param {Object} payload Entry answers.
 * @return {{ name: string, email: string }}
 */
export function entrySender( payload ) {
  const entries = Object.entries( payload && typeof payload === 'object' ? payload : {} );
  const byKey = ( re, test = () => true ) => {
    const hit = entries.find( ( [ k, v ] ) => re.test( k ) && flat( v ).trim() && test( flat( v ).trim() ) );
    return hit ? flat( hit[ 1 ] ).trim() : '';
  };
  const email = byKey( /e-?mail/i, ( v ) => v.includes( '@' ) );
  const name = byKey( /^(full_?)?name$|name_group|your_name|first_name/i );
  return { name, email };
}
