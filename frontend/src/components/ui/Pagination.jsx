import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination — professional 3-column pager bar matching the FixIT PDAS prototype:
 *   [Showing X–Y of Z label]   [‹ 1 2 3 ›]   [Rows ▾]
 *
 * Page arrows and page pills are always rendered (even on a single page),
 * giving the bar a consistent, balanced look.
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
  const start    = (safePage - 1) * pageSize + 1;
  const end      = Math.min(safePage * pageSize, total);

  /* Build the condensed page-number list with ellipsis gaps */
  const numbers = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) {
      numbers.push(p);
    } else if (numbers[numbers.length - 1] !== '…') {
      numbers.push('…');
    }
  }

  /* Base style for nav arrow / page-pill buttons */
  const pillStyle = (active, disabled) => ({
    minWidth   : '32px',
    height     : '32px',
    padding    : '0 10px',
    borderRadius: '6px',
    border     : active  ? '1.5px solid #071746' : '1.5px solid #cbd5e1',
    background : active  ? '#071746' : 'var(--bg-card, #ffffff)',
    color      : active  ? '#ffffff' : disabled ? '#cbd5e1' : '#334155',
    fontSize   : '13px',
    fontWeight : active  ? '700' : '500',
    cursor     : disabled ? 'not-allowed' : 'pointer',
    opacity    : disabled ? 0.5 : 1,
    display    : 'inline-flex',
    alignItems : 'center',
    justifyContent: 'center',
    transition : 'all 0.15s ease',
    boxShadow  : active ? '0 2px 6px rgba(7,23,70,0.18)' : 'none',
  });

  return (
    <div
      style={{
        display       : 'flex',
        alignItems    : 'center',
        justifyContent: 'space-between',
        gap           : '12px',
        flexWrap      : 'wrap',
        width         : '100%',
      }}
    >
      {/* Left: range summary */}
      <div style={{ fontSize: '13px', fontWeight: '500', color: '#64748b', flexShrink: 0 }}>
        Showing{' '}
        <span style={{ fontWeight: '700', color: '#0f172a' }}>{start}</span>
        {'\u2013'}
        <span style={{ fontWeight: '700', color: '#0f172a' }}>{end}</span>
        {' of '}
        <span style={{ fontWeight: '700', color: '#0f172a' }}>{total}</span>
        {' '}{itemLabel}
      </div>

      {/* Centre + Right: page pills and rows selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>

        {/* Page navigation — always visible for consistent layout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            style={pillStyle(false, safePage <= 1)}
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={15} />
          </button>

          {numbers.map((p, i) =>
            p === '…' ? (
              <span
                key={`gap-${i}`}
                style={{ color: '#94a3b8', padding: '0 4px', fontSize: '13px', userSelect: 'none' }}
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                style={pillStyle(p === safePage, false)}
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === safePage ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            style={pillStyle(false, safePage >= totalPages)}
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Rows-per-page selector */}
        {onPageSizeChange && (
          <div
            style={{
              display   : 'inline-flex',
              alignItems: 'center',
              gap       : '7px',
              fontSize  : '12.5px',
              fontWeight: '500',
              color     : '#64748b',
              flexShrink: 0,
            }}
          >
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              style={{
                height      : '32px',
                padding     : '0 8px',
                fontSize    : '12.5px',
                fontWeight  : '600',
                color       : '#1e293b',
                background  : 'var(--bg-card, #ffffff)',
                border      : '1.5px solid #cbd5e1',
                borderRadius: '6px',
                cursor      : 'pointer',
                outline     : 'none',
                boxShadow   : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {[10, 20, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
