import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  Package,
  Trash2,
  ShoppingBag,
  Clock,
  ChevronRight,
  Printer,
  FileText
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useOptionalToast } from '../components/ui/Toast';
import { Modal } from '../components/common/Modal';
import { PrintPortal } from '../components/common/PrintPortal';
import { TechnicalAssessmentReportSheet } from '../components/common/TechnicalAssessmentReportSheet';
import { printDocument } from '../utils/print';

const PROCUREMENT_STAGES = [
  { value: 'Pending Purchase Request (PR)', label: '1. PR Prep', step: 1, color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { value: 'PR Submitted to Supply & BAC', label: '2. BAC / Supply', step: 2, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { value: 'Canvassing / Purchase Order (PO) Issued', label: '3. PO Issued', step: 3, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { value: 'Delivered & Awaiting Installation', label: '4. Delivered', step: 4, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' }
];

// Resolve the actual disposition of a flagged request, including the new
// 'cannot_complete' type that was previously invisible in this view.
const getDisposition = (request) => {
  if (request.maintenanceFlag?.type === 'Cannot Complete') return 'cannot_complete';
  if (request.replacementFlag?.disposition === 'cannot_complete') return 'cannot_complete';
  if (request.replacementFlag?.disposition) return request.replacementFlag.disposition;
  if (request.maintenanceFlag?.type === 'Disposal') return 'disposal';
  return 'replacement';
};

export const ReplacementRequests = () => {
  const { requisitions, updateProcurementStatus } = useData();
  const { currentUser, isAdmin } = useAuth();
  const toastCtx = useOptionalToast();
  const toast = toastCtx?.toast;

  const [searchTerm, setSearchTerm] = useState('');
  // 'all' | 'replacement' | 'disposal' | 'cannot_complete'
  const [dispositionFilter, setDispositionFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [reportReq, setReportReq] = useState(null);

  const handleUpdateStage = (reqId, newStage) => {
    if (updateProcurementStatus) {
      // Fix 2: pass raw numeric id so the backend WHERE id=? matches
      updateProcurementStatus(reqId, newStage);
      setUpdatingId(null);
      if (toast) toast('Procurement status updated successfully.', 'success');
    }
  };

  const isMaintenance = currentUser?.role === 'maintenance' || currentUser?.role === 'technician';

  // Include all three flag types: replacement, disposal, and cannot_complete
  const flaggedRequests = useMemo(() => {
    return requisitions.filter(request => {
      const hasReplacementFlag = request.replacementFlag?.isFlagged;
      const hasDisposalFlag = request.maintenanceFlag?.type === 'Disposal';
      const hasCannotCompleteFlag =
        request.maintenanceFlag?.type === 'Cannot Complete' ||
        request.replacementFlag?.disposition === 'cannot_complete';
      if (!hasReplacementFlag && !hasDisposalFlag && !hasCannotCompleteFlag) return false;
      if (isAdmin || isMaintenance) return true;
      const flaggedBy = request.replacementFlag?.flaggedBy || request.maintenanceFlag?.flaggedBy || '';
      return (
        request.requesterEmail?.toLowerCase() === currentUser?.email?.toLowerCase() ||
        (currentUser?.name && flaggedBy.toLowerCase().includes(currentUser.name.toLowerCase()))
      );
    });
  }, [requisitions, isAdmin, isMaintenance, currentUser]);

  const replacementCount = useMemo(
    () => flaggedRequests.filter(r => getDisposition(r) === 'replacement').length,
    [flaggedRequests]
  );
  const disposalCount = useMemo(
    () => flaggedRequests.filter(r => getDisposition(r) === 'disposal').length,
    [flaggedRequests]
  );
  const cannotCompleteCount = useMemo(
    () => flaggedRequests.filter(r => getDisposition(r) === 'cannot_complete').length,
    [flaggedRequests]
  );

  const filteredRequests = useMemo(() => {
    return flaggedRequests.filter(req => {
      const disposition = getDisposition(req);
      const matchesDisposition = dispositionFilter === 'all' || disposition === dispositionFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        String(req.controlNo || '').toLowerCase().includes(term) ||
        String(req.replacementFlag?.itemSpecs || req.title || '').toLowerCase().includes(term) ||
        String(req.replacementFlag?.reason || req.maintenanceFlag?.reason || '').toLowerCase().includes(term) ||
        String(req.location || '').toLowerCase().includes(term) ||
        String(req.replacementFlag?.flaggedBy || req.maintenanceFlag?.flaggedBy || '').toLowerCase().includes(term);
      return matchesDisposition && matchesSearch;
    });
  }, [flaggedRequests, dispositionFilter, searchTerm]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Replacement</h1>
          <p className="page-subtitle">
            Flagged equipment and assets requiring replacement, disposal, or contractor coordination
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="search-input-wrapper">
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search defective item, room location, defect reason, or ticket..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={dispositionFilter}
          onChange={(e) => setDispositionFilter(e.target.value)}
          aria-label="Filter by disposition"
        >
          <option value="all">All Items ({flaggedRequests.length})</option>
          <option value="replacement">For Replacement ({replacementCount})</option>
          <option value="disposal">For Disposal ({disposalCount})</option>
          <option value="cannot_complete">Cannot Complete ({cannotCompleteCount})</option>
        </select>
      </div>

      {/* List */}
      <div className="content-card">
        <div className="card-header">
          <h2 className="card-title">Flagged Items ({filteredRequests.length})</h2>
          <span style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
              Replacement: {replacementCount}
            </span>
            <span style={{ background: 'var(--bg-muted)', color: '#475569', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
              Disposal: {disposalCount}
            </span>
            {cannotCompleteCount > 0 && (
              <span style={{ background: '#fff7ed', color: '#c2410c', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
                Cannot Complete: {cannotCompleteCount}
              </span>
            )}
          </span>
        </div>

        {filteredRequests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 10px auto' }} />
            <p style={{ margin: 0, fontWeight: '600', color: '#475569' }}>
              No flagged items matching current filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            {filteredRequests.map(request => {
              const disposition = getDisposition(request);
              const borderColor =
                disposition === 'disposal' ? '#64748b'
                : disposition === 'cannot_complete' ? '#ea580c'
                : '#2563eb';

              return (
                <div
                  key={request.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${borderColor}`,
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#001f9c' }}>
                          {request.controlNo || request.ticket_no || request.id}
                        </span>

                        {/* Type badge — disposition-aware label (Bug 6 fix) */}
                        <span style={{
                          background: '#fef2f2', color: '#b91c1c',
                          fontSize: '11px', fontWeight: '700',
                          padding: '2px 8px', borderRadius: '6px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <AlertTriangle size={12} />
                          {disposition === 'disposal'
                            ? 'Condemned Asset'
                            : disposition === 'cannot_complete'
                            ? 'Cannot Complete'
                            : 'Irreparable'}
                        </span>

                        {/* Disposition pill */}
                        <span style={{
                          background: disposition === 'disposal' ? 'var(--bg-sunken)' : (disposition === 'cannot_complete' ? '#fff7ed' : '#eff6ff'),
                          color: disposition === 'disposal' ? '#475569'
                            : disposition === 'cannot_complete' ? '#c2410c'
                            : '#1d4ed8',
                          border: `1px solid ${disposition === 'disposal' ? '#cbd5e1'
                            : disposition === 'cannot_complete' ? '#fed7aa'
                            : '#bfdbfe'}`,
                          fontSize: '11px', fontWeight: '800',
                          padding: '2px 8px', borderRadius: '6px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          {disposition === 'disposal'
                            ? <><Trash2 size={12} /> For Disposal</>
                            : disposition === 'cannot_complete'
                            ? <><Clock size={12} /> External Contractor Needed</>
                            : <><Package size={12} /> For Replacement</>}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '4px 0 2px 0' }}>
                        {disposition === 'cannot_complete'
                          ? (request.maintenanceFlag?.scheduledWork || request.title || 'Pending Contractor Work')
                          : (request.replacementFlag?.itemSpecs || request.title || 'Condemned Asset')}
                      </h3>

                      <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span><strong>Location:</strong> {request.location}</span>
                        <span><strong>Flagged By:</strong> {request.replacementFlag?.flaggedBy || request.maintenanceFlag?.flaggedBy || '—'}</span>
                        <span><strong>Date:</strong> {request.replacementFlag?.flaggedDate || request.maintenanceFlag?.flaggedDate || '—'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setReportReq(request)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}
                        title="View and print official Maintenance Technical Assessment & Flag Report (PDF)"
                      >
                        <Printer size={14} /> View / Print PDF Form
                      </button>
                    </div>
                  </div>

                  {/* Reason row */}
                  <div style={{
                    background: 'var(--bg-sunken)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    borderRadius: '8px', padding: '10px 14px',
                    fontSize: '12.5px', color: '#334155',
                    marginBottom: (disposition === 'disposal' || disposition === 'cannot_complete') ? '0' : '14px'
                  }}>
                    <strong>Reason:</strong>{' '}
                    {request.replacementFlag?.reason || request.maintenanceFlag?.reason || '—'}
                  </div>

                  {/* Cannot Complete — proposed contractor schedule (Bug 7) */}
                  {disposition === 'cannot_complete' && (
                    <div style={{
                      background: '#fff7ed', border: '1px solid #fed7aa',
                      borderRadius: '8px', padding: '10px 14px',
                      fontSize: '12.5px', color: '#9a3412', marginTop: '10px'
                    }}>
                      {request.maintenanceFlag?.scheduledDate ? (
                        <>
                          <strong>Proposed Follow-Up:</strong>{' '}
                          {request.maintenanceFlag.scheduledWork}{' '}on{' '}
                          <strong>{request.maintenanceFlag.scheduledDate}</strong>
                          {request.maintenanceFlag.scheduledTime
                            ? ` at ${request.maintenanceFlag.scheduledTime}`
                            : ''}
                        </>
                      ) : (
                        'Awaiting contractor coordination — no proposed date yet.'
                      )}
                    </div>
                  )}

                  {/* Disposal note */}
                  {disposition === 'disposal' && (
                    <div style={{
                      background: 'var(--bg-sunken)', border: '1px solid #e2e8f0',
                      borderRadius: '8px', padding: '10px 14px',
                      fontSize: '12.5px', color: '#475569', marginTop: '10px'
                    }}>
                      <strong>For Disposal:</strong> condemned asset — coordinate turnover and disposal with PDAS and Supply.
                    </div>
                  )}

                  {/* Replacement only — 4-Stage Procurement Pipeline */}
                  {disposition === 'replacement' && (() => {
                    const currentStatus = request.replacementFlag?.procurementStatus || 'Pending Purchase Request (PR)';
                    const activeStage = PROCUREMENT_STAGES.find(s => s.value === currentStatus) || PROCUREMENT_STAGES[0];
                    const isUpdating = updatingId === request.id;

                    return (
                      <div style={{
                        background: 'var(--bg-sunken)', border: '1px solid #e2e8f0',
                        borderRadius: '10px', padding: '14px 16px', marginTop: '14px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShoppingBag size={14} color="#001f9c" />
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Procurement &amp; Supply Pipeline
                            </span>
                          </div>
                          <span style={{
                            fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
                            background: activeStage.bg, color: activeStage.color, border: `1px solid ${activeStage.border}`
                          }}>
                            {activeStage.label}
                          </span>
                        </div>

                        {/* 4-Step Progress Bar */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: isAdmin ? '12px' : '4px' }}>
                          {PROCUREMENT_STAGES.map(stage => {
                            const isDone = activeStage.step >= stage.step;
                            const isCurrent = activeStage.step === stage.step;
                            return (
                              <div key={stage.step} style={{ textAlign: 'center' }}>
                                <div style={{
                                  height: '6px', borderRadius: '999px',
                                  background: isDone ? stage.color : '#e2e8f0', marginBottom: '4px'
                                }} />
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: isCurrent ? '800' : '600',
                                  color: isCurrent ? stage.color : (isDone ? '#475569' : '#94a3b8')
                                }}>
                                  {stage.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Admin Stage Update Control */}
                        {isAdmin && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                            {isUpdating ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <select
                                  className="form-select"
                                  defaultValue={currentStatus}
                                  onChange={(e) => handleUpdateStage(request.id, e.target.value)}
                                  style={{ fontSize: '12px', padding: '4px 8px', height: '30px' }}
                                >
                                  {PROCUREMENT_STAGES.map(s => (
                                    <option key={s.value} value={s.value}>
                                      {s.label} ({s.value})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setUpdatingId(null)}
                                  style={{ height: '30px', padding: '0 8px', fontSize: '11.5px' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setUpdatingId(request.id)}
                                style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <ChevronRight size={13} /> Update Procurement Stage
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Printable / Exportable PDF Form Report Modal */}
      {reportReq && (
        <Modal
          isOpen={Boolean(reportReq)}
          onClose={() => setReportReq(null)}
          onBack={() => setReportReq(null)}
          title={`Maintenance Technical Assessment & Flag Report (QF-PDAS-TA-02) — ${reportReq.controlNo || reportReq.ticket_no || reportReq.id}`}
          maxWidth="820px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={14} /> Official Printable / Exportable PDF Form (Use "Save as PDF" in your print dialog)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReportReq(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => printDocument()}
                >
                  <Printer size={14} /> Print / Save as PDF
                </button>
              </div>
            </div>
          }
        >
          <TechnicalAssessmentReportSheet req={reportReq} />
        </Modal>
      )}
      {reportReq && (
        <PrintPortal>
          <TechnicalAssessmentReportSheet req={reportReq} />
        </PrintPortal>
      )}
    </div>
  );
};
