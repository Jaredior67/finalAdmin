import React from 'react';

/**
 * Pagination — shared pager bar: range summary, page buttons, rows-per-page.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  total,
  itemLabel = 'records',
}) {
  if (!total || totalPages < 1) return null;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  const numbers = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) numbers.push(p);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }

  const btn = (active) => ({
    minWidth: '32px',
    height: '32px',
    padding: '0 8px',
    borderRadius: '8px',
    border: active ? '1px solid #001f9c' : '1px solid #cbd5e1',
    background: active ? '#001f9c' : '#ffffff',
    color: active ? '#ffffff' : '#334155',
    fontSize: '13px',
    fontWeight: active ? '700' : '500',
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '14px 4px 2px 4px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: '400', color: '#64748b' }}>
        Showing {start}–{end} of {total} {itemLabel}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button type="button" style={btn(false)} disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} aria-label="Previous page">‹</button>
        {numbers.map((p, i) => p === '…'
          ? <span key={`gap-${i}`} style={{ color: '#94a3b8', padding: '0 2px' }}>…</span>
          : <button key={p} type="button" style={btn(p === safePage)} onClick={() => onPageChange(p)} aria-label={`Page ${p}`} aria-current={p === safePage ? 'page' : undefined}>{p}</button>
        )}
        <button type="button" style={btn(false)} disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} aria-label="Next page">›</button>
      </div>
      {onPageSizeChange && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '500', color: '#64748b' }}>
          Rows
          <select
            className="form-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{ height: '32px', fontSize: '12.5px' }}
            aria-label="Rows per page"
          >
            {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
