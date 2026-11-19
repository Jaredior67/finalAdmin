import React from 'react';

export const PageTransition = ({ children, className = '' }) => {
  return (
    <div 
      className={`page-transition-wrap ${className}`}
      style={{
        animation: 'pageSlideFadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {children}
    </div>
  );
};
