import React from 'react';
import { ChevronRight } from 'lucide-react';

export const PageHeader = ({ breadcrumbs = [], title, description, action }) => {
  return (
    <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={14} color="#94a3b8" />}
              <span style={{ color: idx === breadcrumbs.length - 1 ? '#001f9c' : '#64748b', fontWeight: idx === breadcrumbs.length - 1 ? '600' : '500' }}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Title Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '27px', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
            {title}
          </h1>
          {description && (
            <p style={{ fontSize: '15px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '400' }}>
              {description}
            </p>
          )}
        </div>

        {action && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {action}
          </div>
        )}
      </div>
    </div>
  );
};
