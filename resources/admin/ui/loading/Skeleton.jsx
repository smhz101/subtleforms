/**
 * Skeleton Loading Components
 */

import './loading.scss';

export function Skeleton({ width, height, className = '' }) {
  return (
    <div 
      className={`sf-skeleton ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({ lines = 3, lastLineWidth = '60%' }) {
  return (
    <div className="sf-skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="16px"
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="sf-skeleton-card">
      <Skeleton width="100%" height="120px" className="sf-skeleton-card__image" />
      <div className="sf-skeleton-card__content">
        <Skeleton width="80%" height="20px" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="sf-skeleton-table">
      <div className="sf-skeleton-table__header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="100%" height="16px" />
        ))}
      </div>
      <div className="sf-skeleton-table__body">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="sf-skeleton-table__row">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton key={colIdx} width="100%" height="16px" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({ items = 5 }) {
  return (
    <div className="sf-skeleton-list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="sf-skeleton-list__item">
          <Skeleton width="40px" height="40px" className="sf-skeleton-list__avatar" />
          <div className="sf-skeleton-list__content">
            <Skeleton width="60%" height="16px" />
            <Skeleton width="40%" height="14px" />
          </div>
        </div>
      ))}
    </div>
  );
}
