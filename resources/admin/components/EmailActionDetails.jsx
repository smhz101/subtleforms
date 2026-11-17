import { __ } from '@wordpress/i18n';

// Older logs stored the raw HTML body cut at 300 bytes; make them readable.
export function previewForDisplay( text ) {
  const value = String( text );
  // Only old HTML previews are stripped; a plain text answer may hold a "<".
  if ( ! /<\/?[a-z][^>]*>/i.test( value ) ) {
    return value.trim();
  }
  return value
    .replace( /\s+/g, ' ' )
    .replace( /<br\s*\/?>|<\/(p|div|tr|li|h[1-6])\s*>/gi, '\n' )
    .replace( /<[^>]*>/g, '' )
    .replace( /<[^>]*$/, '' )
    .replace( /[ \t]+/g, ' ' )
    .replace( / ?\n ?/g, '\n' )
    .replace( /\n{3,}/g, '\n\n' )
    .trim();
}

const formatValue = ( v ) => ( Array.isArray( v ) ? v.join( ', ' ) : typeof v === 'boolean' ? ( v ? 'Yes' : 'No' ) : String( v ) );

export default function EmailActionDetails( { data } ) {
  const lead = [
    [ 'from', __( 'From', 'subtleforms' ) ],
    [ 'to', __( 'To', 'subtleforms' ) ],
    [ 'reply_to', __( 'Reply-To', 'subtleforms' ) ],
    [ 'subject', __( 'Subject', 'subtleforms' ) ],
    [ 'format', __( 'Format', 'subtleforms' ) ],
    [ 'body_preview', __( 'Preview', 'subtleforms' ) ],
  ];
  const leadKeys = lead.map( ( [ k ] ) => k );
  const rest = Object.keys( data ).filter( ( k ) => ! leadKeys.includes( k ) );
  const show = ( k, v ) => {
    if ( k === 'format' ) {
      return v === 'html' ? __( 'HTML', 'subtleforms' ) : __( 'Plain text', 'subtleforms' );
    }
    if ( k === 'body_preview' ) {
      return previewForDisplay( v );
    }
    return formatValue( v );
  };
  const rows = [
    ...lead.filter( ( [ k ] ) => data[ k ] !== undefined && data[ k ] !== '' ),
    ...rest.map( ( k ) => [ k, k.charAt( 0 ).toUpperCase() + k.slice( 1 ).replace( /_/g, ' ' ) ] ),
  ];
  return (
    <dl className='sf-pipe-data'>
      { rows.map( ( [ k, label ] ) => (
        <div key={ k } className='sf-pipe-data__row'>
          <dt className='sf-pipe-data__key'>{ label }</dt>
          <dd className={ `sf-pipe-data__val${ k === 'body_preview' ? ' sf-pipe-data__val--preview' : '' }` }>
            { show( k, data[ k ] ) }
          </dd>
        </div>
      ) ) }
    </dl>
  );
}
