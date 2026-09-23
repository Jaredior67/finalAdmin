import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Printer,
  Search,
  Check,
  SlidersHorizontal
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';

const PROCUREMENT_STAGES = [
  { id: 'Pending Purchase Request (PR)', label: '1. PR Preparation', short: 'PR Prep' },
  { id: 'PR Submitted to Supply & BAC', label: '2. BAC Submission', short: 'BAC Review' },
  { id: 'Canvassing / Purchase Order (PO) Issued', label: '3. Canvassing / PO', short: 'PO Issued' },
  { id: 'Delivered & Awaiting Installation', label: '4. Delivered', short: 'Delivered' }
];

export const ReplacementRequests = () => {
  const { requisitions, updateProcurementStatus } = useData();
  const { currentUser, isAdmin } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedItemForUpdate, setSelectedItemForUpdate] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');

  const flaggedRequests = useMemo(() => {
    return requisitions.filter(request => {
      if (!request.replacementFlag?.isFlagged) return false;
      if (isAdmin) return true;
      return request.requesterEmail?.toLowerCase() === currentUser?.email?.toLowerCase() ||
        request.replacementFlag.flaggedBy?.toLowerCase().includes(currentUser?.name?.toLowerCase() || '');
    });
  }, [requisitions, isAdmin, currentUser]);

  const filteredRequests = useMemo(() => {
    return flaggedRequests.filter(req => {
      const currentProcStatus = req.replacementFlag.procurementStatus || 'Pending Purchase Request (PR)';
      const matchesStage = stageFilter === 'all' || currentProcStatus === stageFilter;

      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        String(req.controlNo || '').toLowerCase().includes(term) ||
        String(req.replacementFlag.itemSpecs || '').toLowerCase().includes(term) ||
        String(req.replacementFlag.reason || '').toLowerCase().includes(term) ||
        String(req.location || '').toLowerCase().includes(term) ||
        String(req.replacementFlag.flaggedBy || '').toLowerCase().includes(term);

      return matchesStage && matchesSearch;
    });
  }, [flaggedRequests, stageFilter, searchTerm]);

  const getStageIndex = (status) => {
    const idx = PROCUREMENT_STAGES.findIndex(s => s.id === status);
    return idx === -1 ? 0 : idx;
  };

  const handleOpenStatusModal = (req) => {
    setSelectedItemForUpdate(req);
    setNewStatus(req.replacementFlag.procurementStatus || 'Pending Purchase Request (PR)');
    setUpdateNotes('');
  };

  const handleSaveStatus = (e) => {
    e.preventDefault();
    if (selectedItemForUpdate && newStatus) {
      updateProcurementStatus(selectedItemForUpdate.id, newStatus, updateNotes);
      setSelectedItemForUpdate(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">Replacement & Irreparable Asset Tracking</h1>
            <span style={{
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              Supply & Procurement Pipeline
            </span>
          </div>
          <p className="page-subtitle">
            Track equipment and facilities flagged as irreparable by technicians through the university procurement lifecycle
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print Replacement Report
          </button>
        </div>
      </div>

      {/* Pipeline Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {PROCUREMENT_STAGES.map((stage, idx) => {
          const count = flaggedRequests.filter(r => (r.replacementFlag.procurementStatus || 'Pending Purchase Request (PR)') === stage.id).length;
          const isSelected = stageFilter === stage.id;
          return (
            <div
              key={stage.id}
              onClick={() => setStageFilter(isSelected ? 'all' : stage.id)}
              style={{
                background: isSelected ? '#eff6ff' : '#ffffff',
                border: isSelected ? '2px solid #001f9c' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                Stage {idx + 1}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                {stage.short}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#001f9c', marginTop: '6px' }}>
                {count} {count === 1 ? 'item' : 'items'}
              </div>
            </div>
          );
        })}
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
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="all">All Procurement Stages ({flaggedRequests.length})</option>
          {PROCUREMENT_STAGES.map(stage => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>
      </div>

      {/* Flagged Items List */}
      <div className="content-card">
        <div className="card-header">
          <h2 className="card-title">Flagged Irreparable Items ({filteredRequests.length})</h2>
          <span style={{ fontSize: '12.5px', color: '#64748b' }}>
            Updated automatically with Supply & BAC Office milestones
          </span>
        </div>

        {filteredRequests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 10px auto' }} />
            <p style={{ margin: 0, fontWeight: '600', color: '#475569' }}>
              No replacement items matching current filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            {filteredRequests.map(request => {
              const currentProcStatus = request.replacementFlag.procurementStatus || 'Pending Purchase Request (PR)';
              const currentStageIdx = getStageIndex(currentProcStatus);

              return (
                <div
                  key={request.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#001f9c' }}>
                          {request.controlNo}
                        </span>
                        <span style={{
                          background: '#fef2f2',
                          color: '#b91c1c',
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertTriangle size={12} /> Irreparable
                        </span>
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '4px 0 2px 0' }}>
                        {request.replacementFlag.itemSpecs || 'Replacement Item'}
                      </h3>
                      <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span><strong>Location:</strong> {request.location}</span>
                        <span><strong>Flagged By:</strong> {request.replacementFlag.flaggedBy}</span>
                        <span><strong>Date:</strong> {request.replacementFlag.flaggedDate}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenStatusModal(request)}
                      >
                        <SlidersHorizontal size={14} /> Update Procurement Status
                      </button>
                    )}
                  </div>

                  {/* Defect Description */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12.5px',
                    color: '#334155',
                    marginBottom: '14px'
                  }}>
                    <strong>Defect Reason:</strong> {request.replacementFlag.reason}
                  </div>

                  {/* 4-Stage Stepper Progress */}
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      University Procurement Milestone Progress:
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px'
                    }}>
                      {PROCUREMENT_STAGES.map((st, i) => {
                        const isDone = i <= currentStageIdx;
                        const isCurrent = i === currentStageIdx;
                        return (
                          <div
                            key={st.id}
                            style={{
                              background: isCurrent ? '#eff6ff' : isDone ? '#ecfdf5' : '#f8fafc',
                              border: isCurrent ? '1.5px solid #3b82f6' : isDone ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '8px 10px',
                              fontSize: '11.5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: isCurrent ? '#001f9c' : isDone ? '#10b981' : '#cbd5e1',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: '800',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {isDone ? <Check size={11} /> : i + 1}
                            </div>
                            <span style={{
                              fontWeight: isCurrent ? '800' : '600',
                              color: isCurrent ? '#001f9c' : isDone ? '#047857' : '#94a3b8',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {st.short}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for Admin to update procurement status */}
      {selectedItemForUpdate && (
        <Modal
          isOpen={!!selectedItemForUpdate}
          onClose={() => setSelectedItemForUpdate(null)}
          title="Update University Procurement Milestone"
          maxWidth="540px"
        >
          <form onSubmit={handleSaveStatus}>
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#001f9c' }}>
                {selectedItemForUpdate.controlNo} — {selectedItemForUpdate.replacementFlag.itemSpecs}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Location: {selectedItemForUpdate.location}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Procurement Stage *</label>
              <select
                className="form-select"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                required
              >
                {PROCUREMENT_STAGES.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Procurement / PO Reference Note (Optional)</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="e.g. PO #2026-088 approved by Campus Admin, supplier dispatched unit..."
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedItemForUpdate(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save & Dispatch Update
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
