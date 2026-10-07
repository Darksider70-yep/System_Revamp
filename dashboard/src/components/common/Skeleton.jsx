import React from 'react';

export const Skeleton = ({ width = '100%', height = '16px', borderRadius = 'var(--radius-sm)', className = '' }) => {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--border-subtle)',
        animation: 'skeleton-shimmer 1.5s infinite ease-in-out',
      }}
    />
  );
};

export const TableSkeleton = ({ rows = 5, cols = 6 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              height="24px"
              width={c === 0 ? '180px' : c === 1 ? '120px' : '90px'}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
