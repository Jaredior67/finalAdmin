import React from 'react';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './Skeleton';

export const DataTable = ({
  columns = [],
  data = [],
  isLoading = false,
  onRowClick = null,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no items to display at this time.',
  emptyAction = null,
  maxHeight = null
}) => {
  if (isLoading) {
    return (
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <TableSkeleton rows={5} cols={columns.length || 5} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyMessage}
        action={emptyAction}
      />
    );
  }

  return (
    <div style={{
      width: '100%',
      overflowX: 'auto',
      maxHeight: maxHeight || 'auto',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      background: '#ffffff',
      boxShadow: 'var(--shadow-subtle)'
    }}>
      <table className="data-table table-nowrap" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5, borderBottom: '1px solid #e2e8f0' }}>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '12px 16px',
                  fontWeight: '700',
                  color: '#475569',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  width: col.width || 'auto'
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rIdx) => (
            <tr
              key={row.id || rIdx}
              onClick={() => onRowClick && onRowClick(row)}
              style={{
                borderBottom: rIdx === data.length - 1 ? 'none' : '1px solid #f1f5f9',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              {columns.map((col, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    padding: '14px 16px',
                    color: '#0f172a',
                    whiteSpace: col.nowrap !== false ? 'nowrap' : 'normal',
                    verticalAlign: 'middle'
                  }}
                >
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
