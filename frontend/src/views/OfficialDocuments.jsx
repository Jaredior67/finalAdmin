import React, { useState } from 'react';
import { FileText, Printer, Eye, Pencil } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Modal } from '../components/common/Modal';
import { JobRequestFormOverlay } from '../components/common/JobRequestFormOverlay';
import { JobRequestPrintSheet } from '../components/common/JobRequestPrintSheet';

export const OfficialDocuments = () => {
  const { requisitions, updateRequisitionForm } = useData();
  const [selectedDocReq, setSelectedDocReq] = useState(requisitions[0] || null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const openPreview = (r) => { setSelectedDocReq(r); setIsPreviewOpen(true); };
  const openEdit = (r) => { setSelectedDocReq(r); setIsEditOpen(true); };

  const handleOverlaySave = (edited, printAfter = false) => {
    if (!selectedDocReq) return;
    updateRequisitionForm(selectedDocReq.id, edited);
    setSelectedDocReq(prev => ({ ...prev, ...edited }));
    setIsEditOpen(false);
    if (printAfter) setIsPreviewOpen(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Official Documents & Job Requests</h1>
          <p className="page-subtitle">Edit every field in the overlay, then generate & print the aligned QF-PDAS-DC-01 sheet</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <div className="content-card" style={{ padding: '24px', border: '2px solid #0f3ba2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px' }}>Job Request</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Form QF-PDAS-DC-01 • Tracking issued only on Final Approval</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
            Select a request below, edit all fields in the overlay (Word-like), then print the clean aligned sheet.
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => selectedDocReq && openPreview(selectedDocReq)} disabled={!selectedDocReq}>
              <Eye size={14} /> Generate & Preview
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => selectedDocReq && openEdit(selectedDocReq)} disabled={!selectedDocReq}>
              <Pencil size={14} /> Edit All Fields
            </button>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="card-header">
          <h2 className="card-title">Select Request Reference for Document Generation</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>TRACKING NUMBER</th>
                <th>LOCATION</th>
                <th>CATEGORY</th>
                <th>REQUESTED BY</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: '700', color: '#0f3ba2' }}>{r.controlNo || 'PENDING'}</td>
                  <td>{r.location}</td>
                  <td>{r.category}</td>
                  <td>{r.requestedBy}</td>
                  <td>{r.status}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openPreview(r)}>
                        <Eye size={13} /> Generate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Official Document Print Preview — QF-PDAS-DC-01"
        maxWidth="800px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{selectedDocReq?.controlNo || 'PENDING — issued on Final Approval'}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setIsPreviewOpen(false); setIsEditOpen(true); }}>
                <Pencil size={14} /> Edit Fields
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPreviewOpen(false)}>Close</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                <Printer size={15} /> Print / Save PDF
              </button>
            </div>
          </div>
        }
      >
        {selectedDocReq && <JobRequestPrintSheet req={selectedDocReq} />}
      </Modal>
      {selectedDocReq && isPreviewOpen && (
        <div className="jr-print-only" aria-hidden="true">
          <JobRequestPrintSheet req={selectedDocReq} />
        </div>
      )}

      <JobRequestFormOverlay
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        initialReq={selectedDocReq || {}}
        allowActionTaken
        allowFinalAction={false}
        title="Edit Job Request Fields (QF-PDAS-DC-01) — All Fields Editable"
        onSave={(edited) => handleOverlaySave(edited, false)}
        onSaveAndPrint={(edited) => handleOverlaySave(edited, true)}
      />
    </div>
  );
};
