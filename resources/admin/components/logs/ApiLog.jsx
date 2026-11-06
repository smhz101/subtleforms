import { useEffect, useState } from '@wordpress/element';
import { Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { apiGet } from '../../utils/api';
import SectionHeader from '../sectionPanel/SectionHeader';
import Pager from './Pager';

/**
 * The API log: REST calls to SubtleForms from the last 30 days.
 *
 * @param {Object} props
 * @param {string} props.title       Section title.
 * @param {string} props.description One line under the title.
 */
export default function ApiLog({ title, description }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet(`/tools/api-logs?page=${page}&per_page=20`).then((result) => {
      if (!cancelled) {
        setData(result.ok ? result.body.data : { rows: [], total: 0 });
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const rows = data?.rows || [];
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 20));

  return (
    <>
      <SectionHeader title={title} description={description} />
      {loading ? (
        <div className='sf-logs__loading'>
          <Spinner />
        </div>
      ) : (
        <div className='sf-logs__table-wrap'>
          <table className='sf-logs__table'>
            <thead>
              <tr>
                <th>{__('When', 'subtleforms')}</th>
                <th>{__('Method', 'subtleforms')}</th>
                <th>{__('Route', 'subtleforms')}</th>
                <th>{__('Status', 'subtleforms')}</th>
                <th>{__('User', 'subtleforms')}</th>
                <th>{__('Time', 'subtleforms')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan='6'>{__('Nothing here yet.', 'subtleforms')}</td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className='sf-logs__when'>{row.created_at}</td>
                  <td>{row.method}</td>
                  <td>{row.route}</td>
                  <td>{row.status}</td>
                  <td>{row.user_id ? `#${row.user_id}` : '-'}</td>
                  <td>{row.duration_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={pages} setPage={setPage} />
    </>
  );
}
