/**
 * One-click import (2.6.0): find the forms Contact Form 7, Gravity Forms and
 * Fluent Forms left on this site, tick the ones to bring across, import them
 * as drafts and read a report for each.
 *
 * Forms are imported one request at a time so the screen can show progress.
 * A form imported before is not imported again silently: its card asks
 * whether to import it again as a copy.
 */
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import { apiGet, apiPost } from '../../utils/api';
import './SiteImport.scss';

const LEVEL_LABELS = {
  skipped: __( 'Not copied', 'subtleforms' ),
  changed: __( 'Changed', 'subtleforms' ),
  info: __( 'Note', 'subtleforms' ),
};

function errorText( result ) {
  return result?.body?.error?.message
    || result?.body?.message
    || __( 'That did not work. Try again.', 'subtleforms' );
}

/**
 * "Imported with 12 fields, 3 notes".
 *
 * @param {Object} result Import result.
 * @return {string} Summary.
 */
export function resultSummary( result ) {
  const notes = ( result.notes || [] ).filter( ( note ) => note.level !== 'info' ).length;
  const fields = sprintf(
    /* translators: %d: number of fields */
    _n( '%d field', '%d fields', result.fields, 'subtleforms' ),
    result.fields
  );
  if ( notes === 0 ) {
    return sprintf(
      /* translators: %s: "12 fields" */
      __( 'Imported with %s.', 'subtleforms' ),
      fields
    );
  }
  return sprintf(
    /* translators: 1: "12 fields", 2: "3 notes" */
    __( 'Imported with %1$s, %2$s.', 'subtleforms' ),
    fields,
    sprintf(
      /* translators: %d: number of report lines */
      _n( '%d note', '%d notes', notes, 'subtleforms' ),
      notes
    )
  );
}

export default function SiteImport() {
  const [ sources, setSources ] = useState( null );
  const [ sourceId, setSourceId ] = useState( '' );
  const [ forms, setForms ] = useState( null );
  const [ selected, setSelected ] = useState( [] );
  const [ progress, setProgress ] = useState( null );
  const [ results, setResults ] = useState( [] );
  const [ error, setError ] = useState( '' );
  const resultsHeading = useRef( null );
  const busy = progress !== null;

  useEffect( () => {
    let cancelled = false;
    apiGet( '/tools/migrate/sources' ).then( ( result ) => {
      if ( cancelled ) {
        return;
      }
      const list = result.ok && Array.isArray( result.body?.data ) ? result.body.data : [];
      setSources( list );
      if ( ! result.ok ) {
        setError( errorText( result ) );
      }
      const first = list.find( ( source ) => source.count > 0 );
      if ( first ) {
        setSourceId( first.id );
      }
    } );
    return () => {
      cancelled = true;
    };
  }, [] );

  const loadForms = useCallback( ( id ) => {
    if ( ! id ) {
      return Promise.resolve();
    }
    setForms( null );
    return apiGet( `/tools/migrate/sources/${ id }/forms` ).then( ( result ) => {
      setForms( result.ok && Array.isArray( result.body?.data ) ? result.body.data : [] );
      if ( ! result.ok ) {
        setError( errorText( result ) );
      }
    } );
  }, [] );

  useEffect( () => {
    setSelected( [] );
    loadForms( sourceId );
  }, [ sourceId, loadForms ] );

  const source = ( sources || [] ).find( ( item ) => item.id === sourceId );
  const allIds = ( forms || [] ).map( ( form ) => form.id );
  const allTicked = allIds.length > 0 && allIds.every( ( id ) => selected.includes( id ) );

  const toggle = ( id ) => setSelected( ( current ) => (
    current.includes( id ) ? current.filter( ( item ) => item !== id ) : [ ...current, id ]
  ) );

  const importForms = async ( ids, copies = [] ) => {
    setError( '' );
    setProgress( { done: 0, total: ids.length } );
    const collected = [];
    for ( let i = 0; i < ids.length; i++ ) {
      const result = await apiPost( `/tools/migrate/sources/${ sourceId }/import`, {
        ids: [ ids[ i ] ],
        copies: copies.includes( ids[ i ] ) ? [ ids[ i ] ] : [],
      } );
      if ( result.ok && Array.isArray( result.body?.data ) ) {
        collected.push( ...result.body.data.map( ( item ) => ( { ...item, source: sourceId } ) ) );
      } else {
        const form = ( forms || [] ).find( ( item ) => item.id === ids[ i ] );
        collected.push( { source_id: ids[ i ], source: sourceId, title: form?.title || ids[ i ], status: 'failed', error: errorText( result ), notes: [] } );
      }
      setProgress( { done: i + 1, total: ids.length } );
    }
    setResults( ( current ) => [
      ...collected,
      // A new answer for the same form replaces the card asking about it.
      ...current.filter( ( item ) => ! collected.some( ( done ) => done.source === item.source && done.source_id === item.source_id ) ),
    ] );
    setProgress( null );
    setSelected( [] );
    await loadForms( sourceId );
    window.requestAnimationFrame( () => resultsHeading.current?.focus() );
  };

  const dismiss = ( item ) => setResults( ( current ) => current.filter( ( result ) => result !== item ) );

  if ( sources === null ) {
    return (
      <section className='sf-panel sf-import'>
        <div className='sf-tools__loading'><Spinner /></div>
      </section>
    );
  }

  const found = sources.filter( ( item ) => item.count > 0 );

  return (
    <section className='sf-panel sf-import' aria-labelledby='sf-import-title'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title' id='sf-import-title'>{ __( 'From this site', 'subtleforms' ) }</h2>
          <p className='sf-panel__subtitle'>{ __( 'Copy forms you made with Contact Form 7, Gravity Forms or Fluent Forms. The other plugin does not need to be active.', 'subtleforms' ) }</p>
        </div>
      </header>
      <div className='sf-panel__body'>
        <p className='sf-import__promise'>
          { __( 'Forms are copied as drafts with their fields, required rules, choices, email notifications and thank-you message. Entries and payment settings are not imported, no emails are sent, and your original forms are not changed.', 'subtleforms' ) }
        </p>

        { error && <p className='sf-import__error' role='alert'>{ error }</p> }

        { found.length === 0 ? (
          <p className='sf-tools__empty'>{ __( 'No Contact Form 7, Gravity Forms or Fluent Forms forms were found on this site.', 'subtleforms' ) }</p>
        ) : (
          <fieldset className='sf-import__sources'>
            <legend>{ __( 'Plugin', 'subtleforms' ) }</legend>
            { sources.map( ( item ) => (
              <label key={ item.id } className={ clsx( 'sf-import__source', { 'is-active': item.id === sourceId, 'is-empty': item.count === 0 } ) }>
                <input
                  type='radio'
                  name='sf-import-source'
                  value={ item.id }
                  checked={ item.id === sourceId }
                  disabled={ item.count === 0 || busy }
                  onChange={ () => { setSourceId( item.id ); } }
                />
                <span className='sf-import__source-name'>{ item.label }</span>
                <span className='sf-import__source-meta'>
                  { item.count === 0
                    ? __( 'No forms found', 'subtleforms' )
                    : sprintf(
                      /* translators: %d: number of forms */
                      _n( '%d form', '%d forms', item.count, 'subtleforms' ),
                      item.count
                    ) }
                  { item.count > 0 && ! item.active && (
                    <span className='sf-import__inactive'>{ __( 'plugin not active', 'subtleforms' ) }</span>
                  ) }
                </span>
              </label>
            ) ) }
          </fieldset>
        ) }

        { source && source.count > 0 && (
          forms === null ? (
            <div className='sf-tools__loading'><Spinner /></div>
          ) : (
            <fieldset className='sf-import__forms' disabled={ busy }>
              <legend>{ sprintf(
                /* translators: %s: plugin name */
                __( 'Forms in %s', 'subtleforms' ),
                source.label
              ) }</legend>
              <label className='sf-import__all'>
                <input
                  type='checkbox'
                  checked={ allTicked }
                  onChange={ () => setSelected( allTicked ? [] : allIds ) }
                />
                <span>{ __( 'Select all', 'subtleforms' ) }</span>
              </label>
              <ul className='sf-import__list'>
                { forms.map( ( form ) => (
                  <li key={ form.id }>
                    <label>
                      <input
                        type='checkbox'
                        checked={ selected.includes( form.id ) }
                        onChange={ () => toggle( form.id ) }
                      />
                      <span className='sf-import__form-title'>{ form.title }</span>
                      <span className='sf-import__form-meta'>
                        { sprintf(
                          /* translators: %d: number of fields */
                          _n( '%d field', '%d fields', form.fields, 'subtleforms' ),
                          form.fields
                        ) }
                      </span>
                      { form.imported?.length > 0 && (
                        <span className='sf-pill sf-pill--info'>{ __( 'Imported before', 'subtleforms' ) }</span>
                      ) }
                    </label>
                  </li>
                ) ) }
              </ul>
            </fieldset>
          )
        ) }

        <div className='sf-import__status' role='status' aria-live='polite'>
          { busy && (
            <>
              <span>{ sprintf(
                /* translators: 1: forms done, 2: forms to import */
                __( 'Importing %1$d of %2$d', 'subtleforms' ),
                Math.min( progress.done + 1, progress.total ),
                progress.total
              ) }</span>
              <progress max={ progress.total } value={ progress.done } aria-hidden='true' />
            </>
          ) }
        </div>

        { results.length > 0 && (
          <div className='sf-import__results'>
            <h3 tabIndex={ -1 } ref={ resultsHeading }>{ __( 'Import results', 'subtleforms' ) }</h3>
            <ul>
              { results.map( ( item ) => (
                <ResultCard
                  key={ `${ item.source }-${ item.source_id }-${ item.form_id || item.status }` }
                  item={ item }
                  busy={ busy }
                  onCopy={ () => importForms( [ item.source_id ], [ item.source_id ] ) }
                  onDismiss={ () => dismiss( item ) }
                  canCopy={ item.source === sourceId }
                />
              ) ) }
            </ul>
          </div>
        ) }
      </div>
      <footer className='sf-panel__footer'>
        <Button
          variant='primary'
          disabled={ busy || selected.length === 0 }
          isBusy={ busy }
          onClick={ () => importForms( selected ) }>
          { selected.length > 0
            ? sprintf(
              /* translators: %d: number of forms */
              _n( 'Import %d form', 'Import %d forms', selected.length, 'subtleforms' ),
              selected.length
            )
            : __( 'Import', 'subtleforms' ) }
        </Button>
        <span className='sf-tools__hint sf-import__hint'>{ __( 'Entries are not imported in this version.', 'subtleforms' ) }</span>
      </footer>
    </section>
  );
}

function ResultCard( { item, busy, onCopy, onDismiss, canCopy } ) {
  if ( item.status === 'imported' ) {
    const notes = item.notes || [];
    return (
      <li className='sf-import__result is-imported'>
        <div className='sf-import__result-head'>
          <strong>{ item.title }</strong>
          <span>{ resultSummary( item ) }</span>
          <a href={ item.edit_url }>
            { __( 'Open in the builder', 'subtleforms' ) }
            <span className='screen-reader-text'>{ `: ${ item.title }` }</span>
          </a>
        </div>
        { notes.length > 0 && (
          <details className='sf-import__report'>
            <summary>{ __( 'Show the report', 'subtleforms' ) }</summary>
            <ul>
              { notes.map( ( note, index ) => (
                <li key={ index } className={ `is-${ note.level }` }>
                  <span className='sf-import__level'>{ LEVEL_LABELS[ note.level ] || LEVEL_LABELS.info }</span>
                  { note.text }
                </li>
              ) ) }
            </ul>
          </details>
        ) }
      </li>
    );
  }
  if ( item.status === 'exists' ) {
    const first = item.existing?.[ 0 ];
    return (
      <li className='sf-import__result is-exists'>
        <div className='sf-import__result-head'>
          <strong>{ item.title }</strong>
          <span>
            { __( 'This form was imported before as', 'subtleforms' ) }{ ' ' }
            { first ? <a href={ first.edit_url }>{ first.title }</a> : null }.{ ' ' }
            { __( 'Import again as a copy?', 'subtleforms' ) }
          </span>
        </div>
        <div className='sf-import__actions'>
          <Button variant='secondary' size='compact' disabled={ busy || ! canCopy } onClick={ onCopy }>
            { __( 'Import a copy', 'subtleforms' ) }
          </Button>
          <Button variant='tertiary' size='compact' disabled={ busy } onClick={ onDismiss }>
            { __( 'Keep the one I have', 'subtleforms' ) }
          </Button>
        </div>
      </li>
    );
  }
  return (
    <li className='sf-import__result is-failed'>
      <div className='sf-import__result-head'>
        <strong>{ item.title || item.source_id }</strong>
        <span>{ item.error || __( 'This form could not be imported.', 'subtleforms' ) }</span>
      </div>
    </li>
  );
}
