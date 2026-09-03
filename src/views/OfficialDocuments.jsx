import React, { useState } from 'react';
import { FileText, Printer, Download, Eye, CheckCircle2, Shield } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Modal } from '../components/common/Modal';
import fixitLogo from '../assets/fixit-logo.png';

export const OfficialDocuments = () => {
  const { requisitions } = useData();
  const [selectedDocReq, setSelectedDocReq] = useState(requisitions[0] || null);
  const [docType, setDocType] = useState('work-order');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Official Documents & Work Orders</h1>
          <p className="page-subtitle">Generate, review, and print official ISAT U Dumangas PDAS documentation</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <div 
          className="content-card"
          style={{ padding: '24px', cursor: 'pointer', border: docType === 'work-order' ? '2px solid #0f3ba2' : '1px solid #e2e8f0' }}
          onClick={() => setDocType('work-order')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px' }}>Job Work Order</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Form PDAS-F01</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
            Official dispatch order authorizing technical staff to perform maintenance and charge materials.
          </p>
          <button 
            type="button" 
            className="btn btn-primary btn-sm"
            onClick={(e) => { e.stopPropagation(); setDocType('work-order'); setIsPreviewOpen(true); }}
          >
            <Eye size={14} />
            Generate & Preview
          </button>
        </div>

        <div 
          className="content-card"
          style={{ padding: '24px', cursor: 'pointer', border: docType === 'gate-pass' ? '2px solid #0f3ba2' : '1px solid #e2e8f0' }}
          onClick={() => setDocType('gate-pass')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={22} />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px' }}>Equipment Gate Pass</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Form PDAS-GP02</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
            Campus security clearance for tools, aircon components, or test instruments leaving campus.
          </p>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); setDocType('gate-pass'); setIsPreviewOpen(true); }}
          >
            <Eye size={14} />
            Generate & Preview
          </button>
        </div>

        <div 
          className="content-card"
          style={{ padding: '24px', cursor: 'pointer', border: docType === 'inspection' ? '2px solid #0f3ba2' : '1px solid #e2e8f0' }}
          onClick={() => setDocType('inspection')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px' }}>Inspection Certificate</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Form PDAS-IC04</div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
            Post-repair validation verifying work completion, safety standards compliance, and sign-off.
          </p>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); setDocType('inspection'); setIsPreviewOpen(true); }}
          >
            <Eye size={14} />
            Generate & Preview
          </button>
        </div>
      </div>

      {/* Select Requisition to Generate For */}
      <div className="content-card">
        <div className="card-header">
          <h2 className="card-title">Select Requisition Reference for Document Generation</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>CONTROL NO</th>
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
                  <td style={{ fontWeight: '700', color: '#0f3ba2' }}>{r.controlNo}</td>
                  <td>{r.location}</td>
                  <td>{r.category}</td>
                  <td>{r.requestedBy}</td>
                  <td>{r.status}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setSelectedDocReq(r); setIsPreviewOpen(true); }}
                    >
                      <Eye size={13} />
                      Generate Document
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Document Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Official Document Print Preview"
        maxWidth="760px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>ISAT U Dumangas Quality Management System (ISO 9001:2015 Compliant)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsPreviewOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handlePrint}
              >
                <Printer size={15} />
                Print / Save PDF
              </button>
            </div>
          </div>
        }
      >
        {selectedDocReq && (
          <div style={{
            background: '#ffffff',
            border: '2px solid #0f172a',
            padding: '32px 28px',
            borderRadius: '4px',
            fontFamily: 'serif',
            color: '#000000'
          }}>
            {/* University & PDAS Official Header */}
            <div style={{ borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ width: '64px', height: '64px', flexShrink: 0 }}>
                  <img 
                    src={fixitLogo} 
                    alt="PDAS Logo" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={(e) => { e.target.src = '/fixit-logo.png'; }}
                  />
                </div>

                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Republic of the Philippines</div>
                  <div style={{ fontSize: '17px', fontWeight: 'bold', textTransform: 'uppercase', color: '#001f9c' }}>
                    Iloilo Science and Technology University
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>DUMANGAS CAMPUS</div>
                  <div style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '2px' }}>
                    ISAT U DUMANGAS CAMPUS 2026
                  </div>
                </div>

                <div style={{ textAlign: 'right', width: '64px', fontSize: '10px', color: '#64748b' }}>
                  <div style={{ fontWeight: 'bold', color: '#001f9c' }}>ISO 9001</div>
                  <div>Certified</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '14px', letterSpacing: '0.08em', textDecoration: 'underline' }}>
                {docType === 'work-order' ? 'FACILITY JOB & WORK ORDER' : docType === 'gate-pass' ? 'OFFICIAL EQUIPMENT GATE PASS' : 'FACILITY INSPECTION & COMPLETION CERTIFICATE'}
              </div>
            </div>

            {/* Document Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '20px' }}>
              <div><strong>CONTROL NO:</strong> {selectedDocReq.controlNo}</div>
              <div><strong>DATE ISSUED:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div><strong>LOCATION:</strong> {selectedDocReq.location}</div>
              <div><strong>CATEGORY:</strong> {selectedDocReq.category}</div>
              <div><strong>REQUISITIONER:</strong> {selectedDocReq.requestedBy}</div>
              <div><strong>DEPARTMENT:</strong> {selectedDocReq.department}</div>
              <div><strong>ASSIGNED SPECIALIST:</strong> {selectedDocReq.assignedTo || 'PDAS Technical Crew'}</div>
            </div>

            {/* Description & Scope */}
            <div style={{ border: '1px solid #000000', padding: '14px', marginBottom: '24px', fontSize: '13px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>WORK SCOPE & SPECIFICATIONS:</div>
              <div>{selectedDocReq.title}</div>
              <div style={{ marginTop: '6px', color: '#222222', fontStyle: 'italic' }}>{selectedDocReq.description}</div>
              {selectedDocReq.notes && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #666666' }}>
                  <strong>Director Remarks:</strong> {selectedDocReq.notes}
                </div>
              )}
            </div>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', textAlign: 'center', marginTop: '40px', fontSize: '12px' }}>
              <div>
                <div style={{ borderBottom: '1px solid #000000', paddingBottom: '4px', fontWeight: 'bold' }}>{selectedDocReq.requestedBy}</div>
                <div style={{ marginTop: '4px' }}>Requisitioner</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #000000', paddingBottom: '4px', fontWeight: 'bold' }}>{selectedDocReq.assignedTo || 'Technical Specialist'}</div>
                <div style={{ marginTop: '4px' }}>Assigned Technician</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #000000', paddingBottom: '4px', fontWeight: 'bold' }}>ENGR. REYNALDO BAUTISTA</div>
                <div style={{ marginTop: '4px' }}>PDAS Director (Approved)</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
