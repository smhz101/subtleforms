import { useMemo, useRef, useState } from '@wordpress/element';
import { Button, Notice, SearchControl, SelectControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { apiGet, apiPost } from '../utils/api';
import { startCsvDownload } from '../utils/csvExport';
import { getBranding } from '../utils/branding';
import { formOptionLabel } from '../utils/toolLabels';
import SiteImport from '../components/tools/SiteImport';
import SectionPanel from '../components/sectionPanel/SectionPanel';
import SectionHeader from '../components/sectionPanel/SectionHeader';
import { useToolsForms } from '../data/queries/tools';
import { getSlotItems } from '../../shared/extend';
import './ToolsPage.scss';

/**
 * The sections this plugin ships. An add-on adds more in the `settings.tools`
 * slot.
 */
export const BUILT_IN_TOOLS = [
  {
    id: 'transfer',
    order: 10,
    label: () => __( 'Transfer', 'subtleforms' ),
    description: () => __( 'Move SubtleForms forms and submissions between sites.', 'subtleforms' ),
  },
  {
    id: 'migrate',
    order: 20,
    label: () => __( 'Migrate', 'subtleforms' ),
    description: () => __( 'Bring forms across from Contact Form 7, Gravity Forms, Fluent Forms, WPForms or Ninja Forms.', 'subtleforms' ),
  },
];

/**
 * Section ids in list order, built in first, then the add-ons'.
 *
 * @return {string[]} Ids.
 */
export function toolSectionIds() {
  return [ ...BUILT_IN_TOOLS.map( ( s ) => s.id ), ...getSlotItems( 'settings.tools' ).map( ( s ) => s.id ) ];
}

function downloadJson( filename, data ) {
  const blob = new Blob( [ JSON.stringify( data, null, 2 ) ], { type: 'application/json' } );
  const url = URL.createObjectURL( blob );
  const link = document.createElement( 'a' );
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL( url );
}

function readJsonFile( file ) {
  return file.text().then( ( text ) => JSON.parse( text ) );
}

function messageFrom( result ) {
  return result?.body?.error?.message
    || result?.body?.message
    || result?.body?.data?.error
    || __( 'That did not work. Check the file and try again.', 'subtleforms' );
}


/**
 * Settings > Tools: Transfer and Migrate, and the sections add-ons register in
 * the `settings.tools` slot. A section panel like Integrations and Logs: the
 * sections on the left, the chosen one on the right with its standard header.
 * The chosen section is kept in the address (`#tab=tools&section=migrate`).
 *
 * Tools has nothing to save, so it has no page frame of its own.
 */
export default function ToolsPanel() {
  const { data: forms = [] } = useToolsForms();
  const [ notice, setNotice ] = useState( null );
  const [ busy, setBusy ] = useState( false );

  const tell = ( status, content ) => setNotice( { status, content } );
  const addOns = getSlotItems( 'settings.tools' );

  const noticeNode = notice && (
    <Notice status={ notice.status } onRemove={ () => setNotice( null ) } isDismissible>
      { notice.content }
    </Notice>
  );

  const sections = [
    ...BUILT_IN_TOOLS.map( ( item ) => ( {
      id: item.id,
      label: item.label(),
      status: null,
      order: item.order,
      render: () => (
        <>
          <SectionHeader title={ item.label() } description={ item.description() } />
          <div className='sf-tools__body'>
            { noticeNode }
            { item.id === 'transfer' && (
              <Transfer forms={ forms } busy={ busy } setBusy={ setBusy } tell={ tell } />
            ) }
            { item.id === 'migrate' && (
              <>
                <SiteImport />
                <Migrate busy={ busy } setBusy={ setBusy } tell={ tell } />
              </>
            ) }
          </div>
        </>
      ),
    } ) ),
    ...addOns
      .filter( ( item ) => ! BUILT_IN_TOOLS.some( ( b ) => b.id === item.id ) )
      .map( ( item, index ) => {
        const Body = item.component;
        return {
          id: item.id,
          label: item.label || item.title || item.id,
          status: null,
          order: 100 + ( item.order ?? 100 ) + index / 100,
          render: () => (
            <>
              <SectionHeader title={ item.title || item.label || item.id } description={ item.description } />
              <div className='sf-tools__body'>
                <Body />
              </div>
            </>
          ),
        };
      } ),
  ];

  return (
    <SectionPanel
      sections={ sections }
      urlParam='section'
      label={ __( 'Tools', 'subtleforms' ) }
      onChange={ () => setNotice( null ) }
    />
  );
}

function Transfer( { forms, busy, setBusy, tell } ) {
  const [ selected, setSelected ] = useState( [] );
  const [ target, setTarget ] = useState( '' );
  const [ query, setQuery ] = useState( '' );
  const visible = useMemo( () => {
    const needle = query.trim().toLowerCase();
    if ( ! needle ) {
      return forms;
    }
    return forms.filter( ( form ) => formOptionLabel( form ).toLowerCase().includes( needle ) );
  }, [ forms, query ] );

  const toggle = ( id ) => {
    setSelected( ( current ) => (
      current.includes( id ) ? current.filter( ( item ) => item !== id ) : [ ...current, id ]
    ) );
  };

  const exportForms = async () => {
    setBusy( true );
    const ids = selected.length ? `?ids=${ selected.join( ',' ) }` : '';
    const result = await apiGet( `/tools/forms/export${ ids }` );
    setBusy( false );
    if ( ! result.ok ) {
      tell( 'error', messageFrom( result ) );
      return;
    }
    downloadJson( 'subtleforms-forms.json', result.body.data );
    tell( 'success', __( 'Forms exported.', 'subtleforms' ) );
  };

  const importForms = async ( file ) => {
    setBusy( true );
    try {
      const packageJson = await readJsonFile( file );
      const result = await apiPost( '/tools/forms/import', packageJson );
      const count = result.body?.data?.created?.length || 0;
      if ( ! result.ok ) {
        tell( 'error', messageFrom( result ) );
      } else if ( result.body?.data?.error ) {
        tell( 'warning', sprintf(
          /* translators: 1: number of forms, 2: reason */
          __( '%1$d forms imported. %2$s', 'subtleforms' ),
          count,
          result.body.data.error
        ) );
      } else {
        tell( 'success', sprintf(
          /* translators: %d: number of forms */
          __( '%d forms imported.', 'subtleforms' ),
          count
        ) );
      }
    } catch {
      tell( 'error', __( 'That file is not JSON.', 'subtleforms' ) );
    }
    setBusy( false );
  };

  const exportEntries = async () => {
    if ( ! target ) {
      tell( 'error', __( 'Choose a form to export.', 'subtleforms' ) );
      return;
    }
    setBusy( true );
    const result = await apiGet( `/tools/submissions/export?form_id=${ target }` );
    setBusy( false );
    if ( ! result.ok ) {
      tell( 'error', messageFrom( result ) );
      return;
    }
    downloadJson( `subtleforms-submissions-${ target }.json`, result.body.data );
    tell( 'success', __( 'Submissions exported.', 'subtleforms' ) );
  };

  const importEntries = async ( file ) => {
    if ( ! target ) {
      tell( 'error', __( 'Choose a form to import into.', 'subtleforms' ) );
      return;
    }
    setBusy( true );
    try {
      const packageJson = await readJsonFile( file );
      const result = await apiPost( '/tools/submissions/import', { form_id: Number( target ), package: packageJson } );
      const count = result.body?.data?.imported || 0;
      if ( ! result.ok ) {
        tell( 'error', messageFrom( result ) );
      } else if ( result.body?.data?.error ) {
        tell( 'warning', sprintf(
          /* translators: 1: number of submissions, 2: reason */
          __( '%1$d submissions imported. %2$s', 'subtleforms' ),
          count,
          result.body.data.error
        ) );
      } else {
        tell( 'success', sprintf(
          /* translators: %d: number of submissions */
          __( '%d submissions imported.', 'subtleforms' ),
          count
        ) );
      }
    } catch {
      tell( 'error', __( 'That file is not JSON.', 'subtleforms' ) );
    }
    setBusy( false );
  };

  // The server streams the file; the browser saves it as it arrives (2.8.1).
  // A form with no entries is answered by the server, which sends the browser
  // back here with a notice.
  const exportCsv = async () => {
    if ( 'unavailable' === await startCsvDownload( { form_id: target ? Number( target ) : null } ) ) {
      tell( 'error', __( 'CSV export failed.', 'subtleforms' ) );
    }
  };

  return (
    <>
      <section className='sf-panel'>
        <header className='sf-panel__header'>
          <div>
            <h2 className='sf-panel__title'>{ __( 'Forms', 'subtleforms' ) }</h2>
            <p className='sf-panel__subtitle'>{ sprintf(
              /* translators: %s: plugin name */
              __( 'Forms are exported as %s JSON. Import creates new forms and keeps them published or draft.', 'subtleforms' ),
              getBranding().name
            ) }</p>
          </div>
          <SearchControl
            value={ query }
            onChange={ setQuery }
            placeholder={ __( 'Find a form', 'subtleforms' ) }
            __nextHasNoMarginBottom
            size='compact'
          />
        </header>
        <div className='sf-panel__body'>
          { visible.length === 0 ? (
            <p className='sf-tools__empty'>{ __( 'Nothing here yet.', 'subtleforms' ) }</p>
          ) : (
            <ul className='sf-tools__checks'>
              { visible.map( ( form ) => (
                <li key={ form.id }>
                  <label>
                    <input
                      type='checkbox'
                      checked={ selected.includes( Number( form.id ) ) }
                      onChange={ () => toggle( Number( form.id ) ) }
                    />
                    <span>{ formOptionLabel( form ) }</span>
                  </label>
                </li>
              ) ) }
            </ul>
          ) }
          <p className='sf-tools__hint'>{ __( 'Leave them all unticked to export every form. More than 100 must be exported in groups.', 'subtleforms' ) }</p>
        </div>
        <footer className='sf-panel__footer'>
          <Button variant='primary' disabled={ busy } onClick={ exportForms }>{ __( 'Export forms', 'subtleforms' ) }</Button>
          <FileButton label={ __( 'Import forms', 'subtleforms' ) } busy={ busy } onFile={ importForms } />
        </footer>
      </section>

      <section className='sf-panel'>
        <header className='sf-panel__header'>
          <div>
            <h2 className='sf-panel__title'>{ __( 'Submissions', 'subtleforms' ) }</h2>
            <p className='sf-panel__subtitle'>{ sprintf(
              /* translators: %s: plugin name */
              __( 'JSON import and export move entries between %s sites. Passwords are left out. Notes, IP address, browser, uploaded files, logs and unpublished draft changes are not in the file. Status, read and starred state, and all other saved entry data, including data added by other plugins, are kept. Importing the same file again skips entries that are already there. A file from another form still imports and says which form it came from. A form with more than 2,000 submissions is not exported in part. Export CSV makes a spreadsheet file.', 'subtleforms' ),
              getBranding().name
            ) }</p>
          </div>
        </header>
        <div className='sf-panel__body'>
          <SelectControl
            label={ __( 'Form', 'subtleforms' ) }
            value={ target }
            options={ [
              { label: __( 'Choose a form', 'subtleforms' ), value: '' },
              ...forms.map( ( form ) => ( { label: formOptionLabel( form ), value: String( form.id ) } ) ),
            ] }
            onChange={ setTarget }
            __nextHasNoMarginBottom
            className='sf-tools__select'
          />
        </div>
        <footer className='sf-panel__footer'>
          <Button variant='primary' disabled={ busy } onClick={ exportEntries }>{ __( 'Export submissions', 'subtleforms' ) }</Button>
          <FileButton label={ __( 'Import submissions', 'subtleforms' ) } busy={ busy } onFile={ importEntries } />
          <Button variant='secondary' disabled={ busy } onClick={ exportCsv }>
            { __( 'Export CSV', 'subtleforms' ) }
          </Button>
        </footer>
      </section>
    </>
  );
}

export function FileButton( { label, busy, onFile, accept = 'application/json,.json' } ) {
  const inputRef = useRef( null );
  return (
    <>
      <Button
        variant='secondary'
        disabled={ busy }
        onClick={ () => inputRef.current?.click() }>
        { label }
      </Button>
      <input
        ref={ inputRef }
        type='file'
        accept={ accept }
        tabIndex={ -1 }
        aria-hidden='true'
        disabled={ busy }
        style={ { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' } }
        onChange={ ( event ) => {
          const file = event.target.files?.[ 0 ];
          event.target.value = '';
          if ( file ) {
            onFile( file );
          }
        } }
      />
    </>
  );
}

function Migrate( { busy, setBusy, tell } ) {
  const [ preview, setPreview ] = useState( null );
  const [ fileJson, setFileJson ] = useState( null );

  const onFile = async ( file ) => {
    setBusy( true );
    try {
      // A Ninja Forms .nff file is JSON, or JSON or a PHP array in base64.
      // What is not JSON goes to the server as text, which reads or refuses it.
      const text = await file.text();
      let body;
      try {
        body = { package: JSON.parse( text ) };
      } catch {
        body = { raw: text };
      }
      const result = await apiPost( '/tools/migrate/preview', body );
      if ( ! result.ok ) {
        setPreview( null );
        tell( 'error', messageFrom( result ) );
      } else {
        setFileJson( body );
        setPreview( result.body.data );
      }
    } catch {
      tell( 'error', __( 'That file could not be read.', 'subtleforms' ) );
    }
    setBusy( false );
  };

  const run = async () => {
    if ( ! fileJson || ! preview?.source ) {
      return;
    }
    setBusy( true );
    const result = await apiPost( '/tools/migrate/import', { source: preview.source, ...fileJson } );
    setBusy( false );
    if ( ! result.ok ) {
      tell( 'error', messageFrom( result ) );
      return;
    }
    const count = result.body?.data?.created?.length || 0;
    tell( 'success', sprintf(
      /* translators: %d: number of forms */
      __( '%d draft forms created. Open Forms to review them.', 'subtleforms' ),
      count
    ) );
    setPreview( null );
    setFileJson( null );
  };

  return (
    <section className='sf-panel'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title'>{ __( 'From an export file', 'subtleforms' ) }</h2>
          <p className='sf-panel__subtitle'>{ __( 'A Gravity Forms, Fluent Forms or WPForms JSON export, or a Ninja Forms .nff file, for forms made on another site.', 'subtleforms' ) }</p>
        </div>
      </header>
      <div className='sf-panel__body'>
        <p>{ __( 'Upload the export file. You will see what will be created, and what is left out, before anything is saved. New forms are drafts.', 'subtleforms' ) }</p>
        { preview && (
          <ul className='sf-tools__preview'>
            { preview.forms.map( ( form, index ) => (
              <li key={ `${ form.title }-${ index }` }>
                <strong>{ form.title }</strong>
                <span>{ sprintf(
                  /* translators: %d: number of fields */
                  __( '%d fields', 'subtleforms' ),
                  form.fields
                ) }</span>
                { form.notes?.length > 0 && (
                  <ul>
                    { form.notes.map( ( note, noteIndex ) => <li key={ `${ noteIndex }-${ note }` }>{ note }</li> ) }
                  </ul>
                ) }
              </li>
            ) ) }
          </ul>
        ) }
      </div>
      <footer className='sf-panel__footer'>
        <FileButton label={ __( 'Choose export file', 'subtleforms' ) } busy={ busy } onFile={ onFile } accept='application/json,.json,.nff' />
        { preview && (
          <Button variant='primary' disabled={ busy } onClick={ run }>{ __( 'Create draft forms', 'subtleforms' ) }</Button>
        ) }
      </footer>
    </section>
  );
}
