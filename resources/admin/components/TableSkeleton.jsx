/**
 * TableSkeleton - Loading skeleton for DataTable
 * 
 * Provides a skeleton placeholder that matches DataTable structure
 * to prevent layout shift and improve perceived performance.
 */

import { Skeleton } from '../ui';
import './TableSkeleton.scss';

export default function TableSkeleton({ 
  rows = 5,
  columns = 4,
  selectable = false 
}) {
  return (
    <div className="sf-table-skeleton">
      <table className="sf-table-skeleton__table">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '40px' }}>
                <div className="sf-table-skeleton__checkbox" />
              </th>
            )}
            {Array.from({ length: columns }).map((_, idx) => (
              <th key={idx}>
                <Skeleton height={16} width="60%" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {selectable && (
                <td>
                  <div className="sf-table-skeleton__checkbox" />
                </td>
              )}
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx}>
                  <Skeleton 
                    height={16} 
                    width={colIdx === 0 ? '80%' : '60%'} 
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
