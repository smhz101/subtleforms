import { useEffect, useState } from '@wordpress/element';
import { Button, Notice, SelectControl, Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import AdminShell from '../components/AdminShell';
import { apiGet, apiPost } from '../utils/api';
import { isProFeature, requirePro } from '../utils/featureGate';
import './ToolsPage.scss';

const SECTIONS = [
  { id: 'transfer', label: __( 'Transfer', 'subtleforms' ) },
  { id: 'migrate', label: __( 'Migrate', 'subtleforms' ) },
  { id: 'activity', label: __( 'Activity', 'subtleforms' ) },
  { id: 'webhooks', label: __( 'Webhooks', 'subtleforms' ) },
  { id: 'api', label: __( 'API', 'subtleforms' ) },
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

export default function ToolsPage() {
  const [ section, setSection ] = useState( 'transfer' );
  const [ forms, setForms ] = useState( [] );
  const [ notice, setNotice ] = useState( null );
  const [ busy, setBusy ] = useState( false );

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
      { notice && (
        <Notice status={ notice.status } onRemove={ () => setNotice( null ) } isDismissible>
          { notice.content }
        </Notice>
      ) }
      <div className='sf-tools__tabs' role='tablist'>
        { SECTIONS.map( ( item ) => (
          <Button
            key={ item.id }
            variant={ section === item.id ? 'primary' : 'secondary' }
            onClick={ () => setSection( item.id ) }
            aria-selected={ section === item.id }>
            { item.label }
          </Button>
        ) ) }
      </div>
      { section === 'transfer' && (
        <Transfer forms={ forms } busy={ busy } setBusy={ setBusy } tell={ tell } />
      ) }
      { section === 'migrate' && (
        <Migrate busy={ busy } setBusy={ setBusy } tell={ tell } />
      ) }
      { section === 'activity' && <LogList kind='activity' forms={ forms } /> }
      { section === 'webhooks' && <LogList kind='webhook' forms={ forms } /> }
      { section === 'api' && <ApiList /> }
    </AdminShell>
  );
}

function Transfer( { forms, busy, setBusy, tell } ) {
  const [ selected, setSelected ] = useState( [] );
  const [ target, setTarget ] = useState( '' );
  const canExport = isProFeature( 'submissions.export' );

  const toggle = ( id ) => {
    setSelected( ( current ) => (
      current.includes( id ) ? current.filter( ( item ) => item !== id ) : [ ...current, id ]
    ) );
  };

  const exportForms = async () => {
    setBusy( true );
    const query = selected.length ? `?ids=${ selected.join( ',' ) }` : '';
    const result = await apiGet( `/tools/forms/export${ query }` );
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

  const exportCsv = () => {
    requirePro( 'submissions.export', async () => {
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
    }, { label: __( 'CSV export', 'subtleforms' ) } );
  };

  return (
    <div className='sf-tools__panel'>
      <section>
        <h2>{ __( 'Forms', 'subtleforms' ) }</h2>
        <p>{ __( 'Export is SubtleForms JSON. Import creates new forms and keeps published or draft.', 'subtleforms' ) }</p>
        <ul className='sf-tools__checks'>
          { forms.map( ( form ) => (
            <li key={ form.id }>
              <label>
                <input
                  type='checkbox'
                  checked={ selected.includes( Number( form.id ) ) }
                  onChange={ () => toggle( Number( form.id ) ) }
                />
                { form.title || sprintf( __( 'Form #%d', 'subtleforms' ), form.id ) }
              </label>
            </li>
          ) ) }
        </ul>
        <p className='sf-tools__hint'>{ __( 'Leave them all unticked to export every form.', 'subtleforms' ) }</p>
        <div className='sf-tools__actions'>
          <Button variant='primary' disabled={ busy } onClick={ exportForms }>{ __( 'Export forms', 'subtleforms' ) }</Button>
          <label className='sf-tools__file'>
            <Button variant='secondary' disabled={ busy }>{ __( 'Import forms', 'subtleforms' ) }</Button>
            <input type='file' accept='application/json,.json' disabled={ busy } onChange={ ( event ) => {
              const file = event.target.files?.[ 0 ];
              event.target.value = '';
              if ( file ) {
                importForms( file );
              }
            } } />
          </label>
        </div>
      </section>
      <section>
        <h2>{ __( 'Submissions', 'subtleforms' ) }</h2>
        <p>{ __( 'JSON import and export move entries between SubtleForms sites. Passwords are left out. CSV export is part of Pro.', 'subtleforms' ) }</p>
        <SelectControl
          label={ __( 'Form', 'subtleforms' ) }
          value={ target }
          options={ [
            { label: __( 'Choose a form', 'subtleforms' ), value: '' },
            ...forms.map( ( form ) => ( {
              label: form.title || sprintf( __( 'Form #%d', 'subtleforms' ), form.id ),
              value: String( form.id ),
            } ) ),
          ] }
          onChange={ setTarget }
        />
        <div className='sf-tools__actions'>
          <Button variant='primary' disabled={ busy } onClick={ exportEntries }>{ __( 'Export submissions', 'subtleforms' ) }</Button>
          <label className='sf-tools__file'>
            <Button variant='secondary' disabled={ busy }>{ __( 'Import submissions', 'subtleforms' ) }</Button>
            <input type='file' accept='application/json,.json' disabled={ busy } onChange={ ( event ) => {
              const file = event.target.files?.[ 0 ];
              event.target.value = '';
              if ( file ) {
                importEntries( file );
              }
            } } />
          </label>
          <Button variant='secondary' disabled={ busy } onClick={ exportCsv }>
            { canExport ? __( 'Export CSV', 'subtleforms' ) : __( 'Export CSV (Pro)', 'subtleforms' ) }
          </Button>
        </div>
      </section>
    </div>
  );
}

function Migrate( { busy, setBusy, tell } ) {
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
    <div className='sf-tools__panel'>
      <h2>{ __( 'Gravity Forms and Fluent Forms', 'subtleforms' ) }</h2>
      <p>{ __( 'Upload the JSON export. You will see what will be created, and what is left out, before anything is saved. New forms are drafts.', 'subtleforms' ) }</p>
      <label className='sf-tools__file'>
        <Button variant='secondary' disabled={ busy }>{ __( 'Choose export file', 'subtleforms' ) }</Button>
        <input type='file' accept='application/json,.json' disabled={ busy } onChange={ ( event ) => {
          const file = event.target.files?.[ 0 ];
          event.target.value = '';
          if ( file ) {
            onFile( file );
          }
        } } />
      </label>
      { preview && (
        <>
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
          <Button variant='primary' disabled={ busy } onClick={ run }>{ __( 'Create draft forms', 'subtleforms' ) }</Button>
        </>
      ) }
    </div>
  );
}

function LogList( { kind, forms } ) {
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
    <div className='sf-tools__panel'>
      <div className='sf-tools__filters'>
        <SelectControl
          label={ __( 'Level', 'subtleforms' ) }
          value={ level }
          options={ [
            { label: __( 'Any level', 'subtleforms' ), value: '' },
            { label: __( 'Info', 'subtleforms' ), value: 'info' },
            { label: __( 'Warning', 'subtleforms' ), value: 'warning' },
            { label: __( 'Error', 'subtleforms' ), value: 'error' },
          ] }
          onChange={ ( value ) => { setPage( 1 ); setLevel( value ); } }
        />
        <SelectControl
          label={ __( 'Form', 'subtleforms' ) }
          value={ formId }
          options={ [
            { label: __( 'Any form', 'subtleforms' ), value: '' },
            ...forms.map( ( form ) => ( { label: form.title || String( form.id ), value: String( form.id ) } ) ),
          ] }
          onChange={ ( value ) => { setPage( 1 ); setFormId( value ); } }
        />
      </div>
      { loading ? <Spinner /> : (
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
                <td>{ row.created_at }</td>
                <td>{ row.level }</td>
                <td>{ row.form_title || ( row.form_id ? `#${ row.form_id }` : '—' ) }</td>
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
      ) }
      <div className='sf-tools__pager'>
        <Button variant='secondary' disabled={ page <= 1 } onClick={ () => setPage( ( n ) => n - 1 ) }>{ __( 'Previous', 'subtleforms' ) }</Button>
        <span>{ sprintf(
          /* translators: 1: current page, 2: page count */
          __( 'Page %1$d of %2$d', 'subtleforms' ),
          page,
          pages
        ) }</span>
        <Button variant='secondary' disabled={ page >= pages } onClick={ () => setPage( ( n ) => n + 1 ) }>{ __( 'Next', 'subtleforms' ) }</Button>
      </div>
    </div>
  );
}

function ApiList() {
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
    <div className='sf-tools__panel'>
      <p>{ __( 'SubtleForms REST calls from the last 30 days. The address and the result are stored. The request itself is not.', 'subtleforms' ) }</p>
      { loading ? <Spinner /> : (
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
                <td>{ row.created_at }</td>
                <td>{ row.method }</td>
                <td>{ row.route }</td>
                <td>{ row.status }</td>
                <td>{ row.user_id ? `#${ row.user_id }` : '—' }</td>
                <td>{ row.duration_ms } ms</td>
              </tr>
            ) ) }
          </tbody>
        </table>
      ) }
      <div className='sf-tools__pager'>
        <Button variant='secondary' disabled={ page <= 1 } onClick={ () => setPage( ( n ) => n - 1 ) }>{ __( 'Previous', 'subtleforms' ) }</Button>
        <span>{ sprintf(
          /* translators: 1: current page, 2: page count */
          __( 'Page %1$d of %2$d', 'subtleforms' ),
          page,
          pages
        ) }</span>
        <Button variant='secondary' disabled={ page >= pages } onClick={ () => setPage( ( n ) => n + 1 ) }>{ __( 'Next', 'subtleforms' ) }</Button>
      </div>
    </div>
  );
}
