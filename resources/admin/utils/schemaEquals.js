/**
 * Structural comparison for form schemas.
 *
 * The builder rebuilds its schema object on every control interaction, so
 * reference equality says nothing about whether anything changed. A select
 * re-emitting its current value, a panel normalising a default on mount, or a
 * title field blurring untouched all produce a fresh object that is identical
 * to the one before it. Treating those as edits marks the form dirty and posts
 * a new schema version for a change the user never made.
 *
 * JSON.stringify is not enough: key order differs between an object built by
 * spreading and one parsed from the API, and `undefined` values disappear from
 * one side but not the other. This walks the values instead.
 */

/**
 * Deep-compare two schema values.
 *
 * @param {*} a First value.
 * @param {*} b Second value.
 * @return {boolean} True when the two describe the same schema.
 */
export function schemaEquals( a, b ) {
  if ( a === b ) {
    return true;
  }

  // NaN never equals itself, but two schemas both holding it are unchanged.
  if ( typeof a === 'number' && typeof b === 'number' ) {
    return Number.isNaN( a ) && Number.isNaN( b );
  }

  if ( a === null || b === null || typeof a !== 'object' || typeof b !== 'object' ) {
    return false;
  }

  if ( Array.isArray( a ) !== Array.isArray( b ) ) {
    return false;
  }

  if ( Array.isArray( a ) ) {
    if ( a.length !== b.length ) {
      return false;
    }
    return a.every( ( item, index ) => schemaEquals( item, b[ index ] ) );
  }

  // An absent key and a key set to undefined mean the same thing here: the API
  // drops the latter on the way out, so keeping them distinct would report a
  // change on every round trip.
  const keys = new Set( [ ...Object.keys( a ), ...Object.keys( b ) ] );

  for ( const key of keys ) {
    if ( a[ key ] === undefined && b[ key ] === undefined ) {
      continue;
    }
    if ( ! schemaEquals( a[ key ], b[ key ] ) ) {
      return false;
    }
  }

  return true;
}

export default schemaEquals;
