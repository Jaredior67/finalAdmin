import React from 'react';

export const Skeleton = ({ width = '100%', height = '20px', borderRadius = '6px', style = {} }) => {
  return (
    <div
      className="skeleton-loader"
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.5s infinite linear',
        ...style
      }}
    />
  );
};

export const TableSkeleton = ({ rows = 5, cols = 6 }) => {
  return (
    <div style={{ width: '100%' }}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} style={{ display: 'flex', gap: '16px', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          {Array.from({ length: cols }).map((_, cIdx) => (
            <Skeleton key={cIdx} width={cIdx === 0 ? '120px' : cIdx === 1 ? '180px' : '90px'} height="16px" />
          ))}
        </div>
      ))}
    </div>
  );
};
