import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Printer,
  Search,
  Package,
  Trash2
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export const ReplacementRequests = () => {
  const { requisitions } = useData();
  const { currentUser, isAdmin } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState('all'); // 'all' | 'replacement' | 'disposal'

  // 'replacement' = irreparable, procure a new unit; 'disposal' = condemned asset.
  // Records without an explicit marker default to replacement.
  const getDisposition = (request) => {
    if (request.replacementFlag?.disposition) return request.replacementFlag.disposition;
    if (request.maintenanceFlag?.type === 'Disposal') return 'disposal';
    return 'replacement';
  };

  const flaggedRequests = useMemo(() => {
    return requisitions.filter(request => {
      if (!request.replacementFlag?.isFlagged && request.maintenanceFlag?.type !== 'Disposal') return false;
      if (isAdmin) return true;
      const flaggedBy = request.replacementFlag?.flaggedBy || request.maintenanceFlag?.flaggedBy || '';
      return request.requesterEmail?.toLowerCase() === currentUser?.email?.toLowerCase() ||
        flaggedBy.toLowerCase().includes(currentUser?.name?.toLowerCase() || '');
    });
  }, [requisitions, isAdmin, currentUser]);

  // List of replacement: split counts per disposition for clear indication.
  const replacementCount = useMemo(
    () => flaggedRequests.filter(r => getDisposition(r) === 'replacement').length,
    [flaggedRequests]
  );
  const disposalCount = useMemo(
    () => flaggedRequests.filter(r => getDisposition(r) === 'disposal').length,
    [flaggedRequests]
  );

  const filteredRequests = useMemo(() => {
    return flaggedRequests.filter(req => {
      const disposition = getDisposition(req);
      const matchesDisposition = dispositionFilter === 'all' || disposition === dispositionFilter;

      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
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
              Replacement & Disposal List
            </span>
          </div>
          <p className="page-subtitle">
            List of equipment and facilities flagged by technicians for replacement or disposal
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={15} /> Print Replacement Report
          </button>
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
          <option value="all">Replacement + Disposal ({flaggedRequests.length})</option>
          <option value="replacement">For Replacement ({replacementCount})</option>
          <option value="disposal">For Disposal ({disposalCount})</option>
        </select>
      </div>

      {/* List of replacement with disposition indication */}
      <div className="content-card">
        <div className="card-header">
          <h2 className="card-title">List of Replacement ({filteredRequests.length})</h2>
          <span style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
              For Replacement: {replacementCount}
            </span>
            <span style={{ background: '#f1f5f9', color: '#475569', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
              For Disposal: {disposalCount}
            </span>
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
              const disposition = getDisposition(request);

              return (
                <div
                  key={request.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: disposition === 'disposal' ? '4px solid #64748b' : '4px solid #2563eb',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                        <span style={{
                          background: disposition === 'disposal' ? '#f1f5f9' : '#eff6ff',
                          color: disposition === 'disposal' ? '#475569' : '#1d4ed8',
                          border: disposition === 'disposal' ? '1px solid #cbd5e1' : '1px solid #bfdbfe',
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {disposition === 'disposal' ? <><Trash2 size={12} /> For Disposal</> : <><Package size={12} /> For Replacement</>}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '4px 0 2px 0' }}>
                        {request.replacementFlag?.itemSpecs || request.title || 'Condemned Asset'}
                      </h3>
                      <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span><strong>Location:</strong> {request.location}</span>
                        <span><strong>Flagged By:</strong> {request.replacementFlag?.flaggedBy || request.maintenanceFlag?.flaggedBy || '—'}</span>
                        <span><strong>Date:</strong> {request.replacementFlag?.flaggedDate || request.maintenanceFlag?.flaggedDate || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Defect Description */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontSize: '12.5px',
                    color: '#334155',
                    marginBottom: disposition === 'disposal' ? '0' : '14px'
                  }}>
                    <strong>Defect Reason:</strong> {request.replacementFlag?.reason || request.maintenanceFlag?.reason || '—'}
                  </div>

                  {disposition === 'disposal' && (
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontSize: '12.5px',
                      color: '#475569',
                      marginTop: '10px'
                    }}>
                      <strong>For Disposal:</strong> condemned asset — coordinate turnover and disposal with PDAS and Supply.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
