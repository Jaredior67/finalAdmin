import React, { useState, useEffect } from 'react';

/**
 * Custom hook to prevent skeleton flicker: only shows skeleton if loading takes longer than `delay` ms (default 200ms).
 */
export const useDelayedLoading = (loading, delay = 200) => {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        setShowSkeleton(true);
      }, delay);
    } else {
      setShowSkeleton(false);
    }
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return showSkeleton;
};

export const Skeleton = ({ width = '100%', height = '20px', borderRadius = '6px', style = {}, className = '' }) => {
  return (
    <div
      className={`skeleton-loader animate-pulse ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 0.8s infinite linear',
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

export const SkeletonCard = ({ height = '140px', className = '' }) => {
  return (
    <div 
      className={`content-card animate-pulse ${className}`}
      style={{ padding: '18px', borderRadius: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Skeleton width="40%" height="18px" />
        <Skeleton width="60px" height="22px" borderRadius="12px" />
      </div>
      <Skeleton width="85%" height="14px" style={{ marginBottom: '8px' }} />
      <Skeleton width="60%" height="14px" style={{ marginBottom: '16px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
        <Skeleton width="30%" height="14px" />
        <Skeleton width="25%" height="14px" />
      </div>
    </div>
  );
};

export const SkeletonList = ({ count = 4 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
};

export const SkeletonStat = ({ count = 4 }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: '14px' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="content-card animate-pulse" style={{ padding: '16px 20px', borderRadius: '10px' }}>
          <Skeleton width="50%" height="14px" style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height="26px" />
        </div>
      ))}
    </div>
  );
};
