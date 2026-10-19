import { useEffect, useMemo, useState } from '@wordpress/element';
import { Button, Notice, SearchControl, SelectControl, Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import clsx from 'clsx';
import AdminShell from '../components/AdminShell';
import Icon from '../ui/Icon';
import { apiGet, apiPost } from '../utils/api';
import { getBranding } from '../utils/branding';
import './ToolsPage.scss';

const SECTIONS = [
  { id: 'transfer', label: __( 'Transfer', 'subtleforms' ), icon: Icon.Package, description: __( 'Move SubtleForms forms and submissions between sites.', 'subtleforms' ) },
  { id: 'migrate', label: __( 'Migrate', 'subtleforms' ), icon: Icon.FileUp, description: __( 'Bring a form across from Gravity Forms or Fluent Forms.', 'subtleforms' ) },
  { id: 'activity', label: __( 'Activity', 'subtleforms' ), icon: Icon.Activity, description: __( 'What happened after each entry was sent.', 'subtleforms' ) },
  { id: 'webhooks', label: __( 'Webhooks', 'subtleforms' ), icon: Icon.Webhook, description: __( 'Calls this site made to another address.', 'subtleforms' ) },
  { id: 'api', label: __( 'API', 'subtleforms' ), icon: Icon.Code, description: __( 'SubtleForms REST calls from the last 30 days.', 'subtleforms' ) },
];

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

function formTitle( form ) {
  return form.title || sprintf(
    /* translators: %d: form id */
    __( 'Form #%d', 'subtleforms' ),
    form.id
  );
}

export default function ToolsPage() {
  const [ section, setSection ] = useState( 'transfer' );
  const [ forms, setForms ] = useState( [] );
  const [ notice, setNotice ] = useState( null );
  const [ busy, setBusy ] = useState( false );
  const current = SECTIONS.find( ( item ) => item.id === section ) || SECTIONS[ 0 ];

  useEffect( () => {
    let cancelled = false;
    apiGet( '/forms?per_page=100&orderby=title&order=ASC' ).then( ( result ) => {
      if ( ! cancelled && result.ok ) {
        setForms( Array.isArray( result.body?.data ) ? result.body.data : [] );
      }
    } );
    return () => {
      cancelled = true;
    };
  }, [] );

  const tell = ( status, content ) => setNotice( { status, content } );

  return (
    <AdminShell
      title={ __( 'Tools', 'subtleforms' ) }
      description={ __( 'Move forms and entries, bring a form across from another plugin, and read what the site has been doing.', 'subtleforms' ) }>
      <div className='sf-tools'>
        <nav className='sf-tools__nav' aria-label={ __( 'Tools', 'subtleforms' ) }>
          <ul>
            { SECTIONS.map( ( item ) => {
              const ItemIcon = item.icon;
              return (
                <li key={ item.id }>
                  <button
                    type='button'
                    className={ clsx( 'sf-tools__nav-item', { 'is-active': section === item.id } ) }
                    aria-current={ section === item.id ? 'page' : undefined }
                    onClick={ () => setSection( item.id ) }>
                    <ItemIcon size={ 16 } aria-hidden='true' />
                    { item.label }
                  </button>
                </li>
              );
            } ) }
          </ul>
        </nav>
        <div className='sf-tools__main'>
          { notice && (
            <Notice status={ notice.status } onRemove={ () => setNotice( null ) } isDismissible>
              { notice.content }
            </Notice>
          ) }
          { section === 'transfer' && (
            <Transfer forms={ forms } busy={ busy } setBusy={ setBusy } tell={ tell } />
          ) }
          { section === 'migrate' && (
            <Migrate busy={ busy } setBusy={ setBusy } tell={ tell } description={ current.description } />
          ) }
          { section === 'activity' && <LogList kind='activity' forms={ forms } description={ current.description } /> }
          { section === 'webhooks' && <LogList kind='webhook' forms={ forms } description={ current.description } /> }
          { section === 'api' && <ApiList description={ current.description } /> }
        </div>
      </div>
    </AdminShell>
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
    return forms.filter( ( form ) => formTitle( form ).toLowerCase().includes( needle ) );
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

  const exportCsv = async () => {
    setBusy( true );
    try {
      const response = await apiFetch( {
        path: '/subtleforms/v1/submissions/export',
        method: 'POST',
        data: { form_id: target ? Number( target ) : null },
      } );
      if ( response?.success && response.csv ) {
        const binary = atob( response.csv );
        const bytes = new Uint8Array( binary.length );
        for ( let i = 0; i < binary.length; i++ ) {
          bytes[ i ] = binary.charCodeAt( i );
        }
        const url = URL.createObjectURL( new Blob( [ bytes ], { type: 'text/csv;charset=utf-8;' } ) );
        const link = document.createElement( 'a' );
        link.href = url;
        link.download = response.filename || 'submissions.csv';
        link.click();
        URL.revokeObjectURL( url );
      } else {
        tell( 'error', response?.message || __( 'CSV export failed.', 'subtleforms' ) );
      }
    } catch {
      tell( 'error', __( 'CSV export failed.', 'subtleforms' ) );
    }
    setBusy( false );
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
                    <span>{ formTitle( form ) }</span>
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
              __( 'JSON import and export move entries between %s sites. Passwords are left out, and read and starred state is kept. A form with more than 2,000 submissions is not exported in part. Export CSV makes a spreadsheet file.', 'subtleforms' ),
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
              ...forms.map( ( form ) => ( { label: formTitle( form ), value: String( form.id ) } ) ),
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

function FileButton( { label, busy, onFile } ) {
  return (
    <label className='sf-tools__file'>
      <Button variant='secondary' disabled={ busy }>{ label }</Button>
      <input
        type='file'
        accept='application/json,.json'
        disabled={ busy }
        onChange={ ( event ) => {
          const file = event.target.files?.[ 0 ];
          event.target.value = '';
          if ( file ) {
            onFile( file );
          }
        } }
      />
    </label>
  );
}

function Migrate( { busy, setBusy, tell, description } ) {
  const [ preview, setPreview ] = useState( null );
  const [ fileJson, setFileJson ] = useState( null );

  const onFile = async ( file ) => {
    setBusy( true );
    try {
      const packageJson = await readJsonFile( file );
      const result = await apiPost( '/tools/migrate/preview', { package: packageJson } );
      if ( ! result.ok ) {
        setPreview( null );
        tell( 'error', messageFrom( result ) );
      } else {
        setFileJson( packageJson );
        setPreview( result.body.data );
      }
    } catch {
      tell( 'error', __( 'That file is not JSON.', 'subtleforms' ) );
    }
    setBusy( false );
  };

  const run = async () => {
    if ( ! fileJson || ! preview?.source ) {
      return;
    }
    setBusy( true );
    const result = await apiPost( '/tools/migrate/import', { source: preview.source, package: fileJson } );
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
          <h2 className='sf-panel__title'>{ __( 'Gravity Forms and Fluent Forms', 'subtleforms' ) }</h2>
          <p className='sf-panel__subtitle'>{ description }</p>
        </div>
      </header>
      <div className='sf-panel__body'>
        <p>{ __( 'Upload the JSON export. You will see what will be created, and what is left out, before anything is saved. New forms are drafts.', 'subtleforms' ) }</p>
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
        <FileButton label={ __( 'Choose export file', 'subtleforms' ) } busy={ busy } onFile={ onFile } />
        { preview && (
          <Button variant='primary' disabled={ busy } onClick={ run }>{ __( 'Create draft forms', 'subtleforms' ) }</Button>
        ) }
      </footer>
    </section>
  );
}

function LogList( { kind, forms, description } ) {
  const [ page, setPage ] = useState( 1 );
  const [ level, setLevel ] = useState( '' );
  const [ formId, setFormId ] = useState( '' );
  const [ data, setData ] = useState( null );
  const [ loading, setLoading ] = useState( true );

  useEffect( () => {
    let cancelled = false;
    setLoading( true );
    const params = new URLSearchParams( { kind, page: String( page ), per_page: '20' } );
    if ( level ) {
      params.set( 'level', level );
    }
    if ( formId ) {
      params.set( 'form_id', formId );
    }
    apiGet( `/tools/logs?${ params.toString() }` ).then( ( result ) => {
      if ( ! cancelled ) {
        setData( result.ok ? result.body.data : { rows: [], total: 0 } );
        setLoading( false );
      }
    } );
    return () => {
      cancelled = true;
    };
  }, [ kind, page, level, formId ] );

  const rows = data?.rows || [];
  const pages = Math.max( 1, Math.ceil( ( data?.total || 0 ) / 20 ) );

  return (
    <section className='sf-panel'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title'>{ kind === 'webhook' ? __( 'Webhooks', 'subtleforms' ) : __( 'Activity', 'subtleforms' ) }</h2>
          <p className='sf-panel__subtitle'>{ description }</p>
        </div>
        <div className='sf-tools__filters'>
          <SelectControl
            label={ __( 'Level', 'subtleforms' ) }
            hideLabelFromVision
            value={ level }
            options={ [
              { label: __( 'Any level', 'subtleforms' ), value: '' },
              { label: __( 'Info', 'subtleforms' ), value: 'info' },
              { label: __( 'Warning', 'subtleforms' ), value: 'warning' },
              { label: __( 'Error', 'subtleforms' ), value: 'error' },
            ] }
            onChange={ ( value ) => { setPage( 1 ); setLevel( value ); } }
            __nextHasNoMarginBottom
          />
          <SelectControl
            label={ __( 'Form', 'subtleforms' ) }
            hideLabelFromVision
            value={ formId }
            options={ [
              { label: __( 'Any form', 'subtleforms' ), value: '' },
              ...forms.map( ( form ) => ( { label: formTitle( form ), value: String( form.id ) } ) ),
            ] }
            onChange={ ( value ) => { setPage( 1 ); setFormId( value ); } }
            __nextHasNoMarginBottom
          />
        </div>
      </header>
      <div className='sf-panel__body sf-panel__body--flush'>
        { loading ? <div className='sf-tools__loading'><Spinner /></div> : (
          <div className='sf-tools__table-wrap'>
            <table className='sf-tools__table'>
              <thead>
                <tr>
                  <th>{ __( 'When', 'subtleforms' ) }</th>
                  <th>{ __( 'Level', 'subtleforms' ) }</th>
                  <th>{ __( 'Form', 'subtleforms' ) }</th>
                  <th>{ __( 'What happened', 'subtleforms' ) }</th>
                </tr>
              </thead>
              <tbody>
                { rows.length === 0 && (
                  <tr><td colSpan='4'>{ __( 'Nothing here yet.', 'subtleforms' ) }</td></tr>
                ) }
                { rows.map( ( row ) => (
                  <tr key={ row.id }>
                    <td className='sf-tools__when'>{ row.created_at }</td>
                    <td><span className={ clsx( 'sf-pill', 'sf-pill--dot', row.level === 'error' ? 'sf-pill--danger' : row.level === 'warning' ? 'sf-pill--warning' : 'sf-pill--info' ) }>{ row.level }</span></td>
                    <td>{ row.form_title || ( row.form_id ? `#${ row.form_id }` : '-' ) }</td>
                    <td>
                      { row.message }
                      { row.url && <div className='sf-tools__meta'>{ row.method } { row.url }{ row.http_status ? ` · ${ row.http_status }` : '' }</div> }
                      { row.error && <div className='sf-tools__meta'>{ row.error }</div> }
                      { row.response && <div className='sf-tools__meta'>{ row.response }</div> }
                    </td>
                  </tr>
                ) ) }
              </tbody>
            </table>
          </div>
        ) }
      </div>
      <Pager page={ page } pages={ pages } setPage={ setPage } />
    </section>
  );
}

function ApiList( { description } ) {
  const [ page, setPage ] = useState( 1 );
  const [ data, setData ] = useState( null );
  const [ loading, setLoading ] = useState( true );

  useEffect( () => {
    let cancelled = false;
    setLoading( true );
    apiGet( `/tools/api-logs?page=${ page }&per_page=20` ).then( ( result ) => {
      if ( ! cancelled ) {
        setData( result.ok ? result.body.data : { rows: [], total: 0 } );
        setLoading( false );
      }
    } );
    return () => {
      cancelled = true;
    };
  }, [ page ] );

  const rows = data?.rows || [];
  const pages = Math.max( 1, Math.ceil( ( data?.total || 0 ) / 20 ) );

  return (
    <section className='sf-panel'>
      <header className='sf-panel__header'>
        <div>
          <h2 className='sf-panel__title'>{ __( 'API', 'subtleforms' ) }</h2>
          <p className='sf-panel__subtitle'>{ description } { __( 'The address and the result are stored. The request itself is not.', 'subtleforms' ) }</p>
        </div>
      </header>
      <div className='sf-panel__body sf-panel__body--flush'>
        { loading ? <div className='sf-tools__loading'><Spinner /></div> : (
          <div className='sf-tools__table-wrap'>
            <table className='sf-tools__table'>
              <thead>
                <tr>
                  <th>{ __( 'When', 'subtleforms' ) }</th>
                  <th>{ __( 'Method', 'subtleforms' ) }</th>
                  <th>{ __( 'Route', 'subtleforms' ) }</th>
                  <th>{ __( 'Status', 'subtleforms' ) }</th>
                  <th>{ __( 'User', 'subtleforms' ) }</th>
                  <th>{ __( 'Time', 'subtleforms' ) }</th>
                </tr>
              </thead>
              <tbody>
                { rows.length === 0 && (
                  <tr><td colSpan='6'>{ __( 'Nothing here yet.', 'subtleforms' ) }</td></tr>
                ) }
                { rows.map( ( row ) => (
                  <tr key={ row.id }>
                    <td className='sf-tools__when'>{ row.created_at }</td>
                    <td>{ row.method }</td>
                    <td>{ row.route }</td>
                    <td>{ row.status }</td>
                    <td>{ row.user_id ? `#${ row.user_id }` : '-' }</td>
                    <td>{ row.duration_ms } ms</td>
                  </tr>
                ) ) }
              </tbody>
            </table>
          </div>
        ) }
      </div>
      <Pager page={ page } pages={ pages } setPage={ setPage } />
    </section>
  );
}

function Pager( { page, pages, setPage } ) {
  return (
    <footer className='sf-panel__footer'>
      <Button variant='secondary' disabled={ page <= 1 } onClick={ () => setPage( ( n ) => n - 1 ) }>{ __( 'Previous', 'subtleforms' ) }</Button>
      <span className='sf-tools__page'>{ sprintf(
        /* translators: 1: current page, 2: page count */
        __( 'Page %1$d of %2$d', 'subtleforms' ),
        page,
        pages
      ) }</span>
      <Button variant='secondary' disabled={ page >= pages } onClick={ () => setPage( ( n ) => n + 1 ) }>{ __( 'Next', 'subtleforms' ) }</Button>
    </footer>
  );
}
