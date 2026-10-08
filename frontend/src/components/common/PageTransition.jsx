import React from 'react';

export const PageTransition = ({ children, className = '' }) => {
  return (
    <div 
      className={`transition-opacity duration-150 ease-in-out animate-fadeIn ${className}`}
      style={{
        animation: 'fadeIn 0.15s ease-in-out'
      }}
    >
      {children}
    </div>
  );
};
