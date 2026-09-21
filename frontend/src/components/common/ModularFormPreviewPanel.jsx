import React, { useState } from 'react';
import { 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  FileText, 
  CheckCircle2
} from 'lucide-react';
import { PDASJobRequestFormDocument } from './PDASJobRequestFormDocument';
import { Modal } from './Modal';

export const ModularFormPreviewPanel = ({ 
  formData, 
  title = "Live QF-PDAS-DC-01 Form Preview",
  subtitle = "Official ISAT U Job Request Paper Preview",
  onPrint = null,
  showControls = true,
  defaultScale = 1.0,
  className = ""
}) => {
  const [scale, setScale] = useState(defaultScale);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.6));
  const handleResetZoom = () => setScale(1.0);

  const handleNativePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  // Convert formData into full document format for PDASJobRequestFormDocument
  const preparedDocData = {
    controlNo: formData?.controlNo || formData?.ticketNo || formData?.id || null,
    date: formData?.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    requestedBy: formData?.requestedBy || formData?.clientName || 'Requester Name',
    department: formData?.department || formData?.selectedOffice || formData?.office || formData?.location || 'ISAT U Dumangas',
    immediateSupervisor: formData?.immediateSupervisor || '',
    category: formData?.category || 'Electrical',
    urgency: formData?.urgency || 'Medium Risk',
    requestType: formData?.requestType || 'Standard Request',
    description: formData?.description || '',
    scopeOfWorks: formData?.scopeOfWorks || {
      drawingDesign: {
        checked: formData?.category === 'Drawing/Design',
        options: formData?.category === 'Drawing/Design' ? (formData?.selectedScopeOptions || []) : [],
        description: formData?.category === 'Drawing/Design' ? (formData?.description || '') : ''
      },
      physicalStructures: {
        checked: formData?.category === 'Physical Structures',
        options: formData?.category === 'Physical Structures' ? (formData?.selectedScopeOptions || []) : [],
        description: formData?.category === 'Physical Structures' ? (formData?.description || '') : ''
      },
      electrical: {
        checked: formData?.category === 'Electrical',
        options: formData?.category === 'Electrical' ? (formData?.selectedScopeOptions || []) : [],
        description: formData?.category === 'Electrical' ? (formData?.description || '') : ''
      },
      mechanical: {
        checked: formData?.category === 'Mechanical',
        options: formData?.category === 'Mechanical' ? (formData?.selectedScopeOptions || []) : [],
        description: formData?.category === 'Mechanical' ? (formData?.description || '') : ''
      },
      waterSanitary: {
        checked: formData?.category === 'Water/Sanitary',
        options: formData?.category === 'Water/Sanitary' ? (formData?.selectedScopeOptions || []) : [],
        description: formData?.category === 'Water/Sanitary' ? (formData?.description || '') : ''
      },
      airConditioning: {
        checked: formData?.category === 'Air Conditioning',
        options: formData?.category === 'Air Conditioning' ? (formData?.selectedScopeOptions || []) : [],
        description: formData?.category === 'Air Conditioning' ? (formData?.description || '') : ''
      }
    },
    actionTaken: formData?.actionTaken || {},
    finalAction: formData?.finalAction || {},
    replacementFlag: formData?.replacementFlag || {}
  };

  return (
    <div 
      className={`modular-form-preview-panel ${className}`}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Header with Control Toolbar */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: '#001f9c',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={16} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{title}</span>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                fontSize: '10px',
                fontWeight: '800',
                padding: '1px 6px',
                borderRadius: '10px',
              }}>
                Live
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {subtitle} • QF-PDAS-DC-01
            </div>
          </div>
        </div>

        {/* Toolbar actions */}
        {showControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '2px 4px'
            }}>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px'
                }}
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom (100%)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#001f9c',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px'
                }}
              >
                <ZoomIn size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMaximized(true)}
              title="Expand Full View"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 8px',
                color: '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: '600'
              }}
            >
              <Maximize2 size={13} />
            </button>

            <button
              type="button"
              onClick={handleNativePrint}
              title="Print Official Form"
              style={{
                background: '#001f9c',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: '700'
              }}
            >
              <Printer size={13} /> Print
            </button>
          </div>
        )}
      </div>

      {/* Live Sync Notice Bar */}
      <div style={{
        background: '#eff6ff',
        borderBottom: '1px solid #dbeafe',
        padding: '6px 14px',
        fontSize: '11.5px',
        color: '#1e40af',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle2 size={13} color="#059669" />
          <span>Updates automatically as you type request details.</span>
        </div>
        <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
          Mode: <strong style={{ color: formData?.requestType === 'Urgent Request' ? '#dc2626' : '#001f9c' }}>{formData?.requestType || 'Standard Request'}</strong>
        </span>
      </div>

      {/* Scrollable Paper Container */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        background: '#64748b15',
        padding: '16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '400px'
      }}>
        <div style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          maxWidth: '100%',
          width: '680px'
        }}>
          <PDASJobRequestFormDocument req={preparedDocData} />
        </div>
      </div>

      {/* Fullscreen Maximize Modal */}
      <Modal
        isOpen={isMaximized}
        onClose={() => setIsMaximized(false)}
        title="Official PDAS Job Request Form (QF-PDAS-DC-01) - Full View"
        maxWidth="820px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ISO 9001:2015 Compliant Request Document (Effective: Feb 3, 2025)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsMaximized(false)}
              >
                Close Full View
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleNativePrint}
              >
                <Printer size={14} /> Print Document
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <div style={{ width: '100%', maxWidth: '740px', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
            <PDASJobRequestFormDocument req={preparedDocData} />
          </div>
        </div>
      </Modal>
    </div>
  );
};
