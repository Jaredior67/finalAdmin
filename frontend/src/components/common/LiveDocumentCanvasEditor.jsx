import React, { useState, useRef, useEffect } from 'react';
import { printElement } from '../../utils/print';
import {
  FileText,
  Star,
  Printer,
  Save,
  RotateCcw,
  X,
  Move,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Check,
  Type,
  Maximize2,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import isatuLogo from '../../assets/isatu-logo.png';
import { PDAS_HEAD_NAME, CAMPUS_ADMIN_NAME, PDAS_HEAD_TITLE, APPROVER_TITLE } from '../../utils/approvalSignatures';

/**
 * Microsoft Word-style Live Interactive Document Canvas Editor
 * Allows live, WYSIWYG in-place editing of text and draggable positioning of the logo
 * for both the Job Request Form (QF-PDAS-DC-01) and Client Satisfaction Measurement (QF-HRM-15).
 */
export const LiveDocumentCanvasEditor = ({ isOpen, onClose, initialForm = 'job-request' }) => {
  const {
    formTemplateConfig,
    updateFormTemplateConfig,
    resetFormTemplateConfig,
    csmTemplateConfig,
    updateCsmTemplateConfig,
    resetCsmTemplateConfig
  } = useData();

  const [activeForm, setActiveForm] = useState(initialForm); // 'job-request' | 'csm'
  const [zoom, setZoom] = useState(100);
  const [showRuler, setShowRuler] = useState(true);
  const [saveToast, setSaveToast] = useState('');
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const sheetRef = useRef(null);

  // Job Request live draft state
  const [jobDraft, setJobDraft] = useState({ ...formTemplateConfig });

  // CSM live draft state
  const [csmDraft, setCsmDraft] = useState({ ...csmTemplateConfig });

  // Sync draft when opened or initialForm changes
  useEffect(() => {
    if (isOpen) {
      setJobDraft({
        ...formTemplateConfig,
        logoWidth: formTemplateConfig.logoWidth || 54,
        logoOffsetX: formTemplateConfig.logoOffsetX || 0,
        logoOffsetY: formTemplateConfig.logoOffsetY || 0,
        logoAlign: formTemplateConfig.logoAlign || 'left'
      });
      setCsmDraft({
        ...csmTemplateConfig,
        logoWidth: csmTemplateConfig.logoWidth || 54,
        logoOffsetX: csmTemplateConfig.logoOffsetX || 0,
        logoOffsetY: csmTemplateConfig.logoOffsetY || 0,
        logoAlign: csmTemplateConfig.logoAlign || 'left'
      });
    }
  }, [isOpen, formTemplateConfig, csmTemplateConfig]);

  if (!isOpen) return null;

  const currentDraft = activeForm === 'job-request' ? jobDraft : csmDraft;
  const setCurrentDraft = (updater) => {
    if (activeForm === 'job-request') {
      setJobDraft(updater);
    } else {
      setCsmDraft(updater);
    }
  };

  const updateField = (key, value) => {
    setCurrentDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (activeForm === 'job-request') {
      updateFormTemplateConfig(jobDraft);
      setSaveToast('Job Request Form (QF-PDAS-DC-01) saved live!');
    } else {
      updateCsmTemplateConfig(csmDraft);
      setSaveToast('Client Satisfaction Form (QF-HRM-15) saved live!');
    }
    setTimeout(() => setSaveToast(''), 3500);
  };

  const handleReset = () => {
    if (window.confirm(`Reset ${activeForm === 'job-request' ? 'Job Request' : 'Client Satisfaction'} template to institutional default layout?`)) {
      if (activeForm === 'job-request') {
        const def = resetFormTemplateConfig();
        setJobDraft({ ...def, logoWidth: 54, logoOffsetX: 0, logoOffsetY: 0, logoAlign: 'left' });
        setSaveToast('Job Request reset to official defaults.');
      } else {
        const def = resetCsmTemplateConfig();
        setCsmDraft({ ...def, logoWidth: 54, logoOffsetX: 0, logoOffsetY: 0, logoAlign: 'left' });
        setSaveToast('Client Satisfaction Form reset to official defaults.');
      }
      setTimeout(() => setSaveToast(''), 3500);
    }
  };

  // Logo dragging handlers
  const handleLogoMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingLogo(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: currentDraft.logoOffsetX || 0,
      initialY: currentDraft.logoOffsetY || 0
    };
  };

  const handleMouseMove = (e) => {
    if (!isDraggingLogo) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = Math.round(dragStartRef.current.initialX + dx);
    const newY = Math.round(dragStartRef.current.initialY + dy);
    updateField('logoOffsetX', newX);
    updateField('logoOffsetY', newY);
    updateField('logoAlign', 'free');
  };

  const handleMouseUp = () => {
    if (isDraggingLogo) {
      setIsDraggingLogo(false);
    }
  };

  // Word-style formatting execution
  const execFormat = (command) => {
    document.execCommand(command, false, null);
  };

  // Inline editable cell/text helper
  const EditableText = ({ tag = 'span', fieldKey, fallback = '', style = {}, className = '', placeholder = 'Type text...' }) => {
    const Tag = tag;
    const content = currentDraft[fieldKey] !== undefined ? currentDraft[fieldKey] : fallback;

    return (
      <Tag
        contentEditable
        suppressContentEditableWarning
        className={`live-editable-word ${className}`}
        style={{
          outline: 'none',
          cursor: 'text',
          minWidth: '20px',
          display: style.display || 'inline-block',
          transition: 'all 0.15s ease',
          ...style
        }}
        onBlur={(e) => {
          const text = e.currentTarget.innerText.trim();
          updateField(fieldKey, text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && tag !== 'div' && tag !== 'p') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        title="Click to edit text live (like MS Word)"
      >
        {content}
      </Tag>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#334155',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: isDraggingLogo ? 'none' : 'auto'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 1. Word Title Bar */}
      <div style={{
        background: '#001f9c',
        color: '#ffffff',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1e3a8a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: '#ffffff', borderRadius: '4px', padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#001f9c', fontWeight: '900', fontSize: '13px' }}>W</span>
          </div>
          <span style={{ fontSize: '13.5px', fontWeight: '700', letterSpacing: '0.02em' }}>
            Manage Forms — {activeForm === 'job-request' ? 'Job Request Form (QF-PDAS-DC-01)' : 'Client Satisfaction Measurement (QF-HRM-15)'}
          </span>
          <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '10.5px', padding: '1px 8px', borderRadius: '10px', fontWeight: '600' }}>
            Interactive Word Mode
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saveToast && (
            <div style={{ background: '#10b981', color: '#ffffff', fontSize: '12px', padding: '4px 12px', borderRadius: '6px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} /> {saveToast}
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            style={{
              background: '#22c55e',
              border: 'none',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Save size={14} /> Save Live Changes
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
            title="Close Editor"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 2. Microsoft Word-Style Ribbon Toolbar */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid #cbd5e1',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        {/* Form Selector Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveForm('job-request')}
            style={{
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeForm === 'job-request' ? '#ffffff' : 'transparent',
              color: activeForm === 'job-request' ? '#001f9c' : '#475569',
              boxShadow: activeForm === 'job-request' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={14} /> Job Request (QF-PDAS-DC-01)
          </button>
          <button
            type="button"
            onClick={() => setActiveForm('csm')}
            style={{
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              background: activeForm === 'csm' ? '#ffffff' : 'transparent',
              color: activeForm === 'csm' ? '#001f9c' : '#475569',
              boxShadow: activeForm === 'csm' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Star size={14} color="#d97706" /> Feedback / CSM (QF-HRM-15)
          </button>
        </div>

        {/* Word Text Formatting Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 8px' }}>
          <button
            type="button"
            onClick={() => execFormat('bold')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', fontWeight: 'bold' }}
            title="Bold (Ctrl+B)"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            onClick={() => execFormat('italic')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
            title="Italic (Ctrl+I)"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            onClick={() => execFormat('underline')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
            title="Underline (Ctrl+U)"
          >
            <Underline size={15} />
          </button>
          <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 4px' }} />
          <button
            type="button"
            onClick={() => execFormat('justifyLeft')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
            title="Align Left"
          >
            <AlignLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => execFormat('justifyCenter')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
            title="Center"
          >
            <AlignCenter size={15} />
          </button>
          <button
            type="button"
            onClick={() => execFormat('justifyRight')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
            title="Align Right"
          >
            <AlignRight size={15} />
          </button>
        </div>

        {/* Logo Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '12px' }}>
          <span style={{ fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ImageIcon size={14} /> Logo Size:
          </span>
          <input
            type="range"
            min="36"
            max="96"
            value={currentDraft.logoWidth || 54}
            onChange={(e) => updateField('logoWidth', Number(e.target.value))}
            style={{ width: '80px', cursor: 'pointer' }}
            title="Resize Logo"
          />
          <span style={{ fontSize: '11px', color: '#64748b', minWidth: '32px' }}>{currentDraft.logoWidth || 54}px</span>

          <div style={{ width: '1px', height: '18px', background: '#e2e8f0', margin: '0 4px' }} />

          <button
            type="button"
            onClick={() => {
              updateField('logoOffsetX', 0);
              updateField('logoOffsetY', 0);
              updateField('logoAlign', 'left');
            }}
            style={{ background: 'var(--bg-sunken)', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
            title="Reset logo to left column"
          >
            Reset Logo Pos
          </button>
        </div>

        {/* Zoom & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px' }}>
            <button
              type="button"
              onClick={() => setZoom(prev => Math.max(60, prev - 10))}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span style={{ fontSize: '11.5px', fontWeight: '700', minWidth: '40px', textAlign: 'center' }}>{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom(prev => Math.min(150, prev + 10))}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px' }}
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: '600', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Reset to default layout"
          >
            <RotateCcw size={13} /> Reset
          </button>

          <button
            type="button"
            onClick={() => printElement(sheetRef.current)}
            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', color: '#001f9c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Informative Tip Banner */}
      <div style={{ background: '#e0e7ff', borderBottom: '1px solid #c7d2fe', padding: '4px 16px', fontSize: '11.5px', color: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          💡 <strong>Tip:</strong> Click on <em>any words</em> on the sheet below to edit them directly in-place. You can also drag the <strong>ISAT U Logo</strong> to reposition it anywhere on the document!
        </span>
        <span style={{ fontSize: '11px', color: '#4338ca' }}>
          Drag coordinates: X: {currentDraft.logoOffsetX || 0}px, Y: {currentDraft.logoOffsetY || 0}px
        </span>
      </div>

      {/* 3. The Interactive Document Workspace (Word Canvas) */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '30px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        background: '#475569'
      }}>
        {/* The White Letter Paper Sheet */}
        <div
          ref={sheetRef}
          style={{
            background: '#ffffff',
            width: '816px', // Standard 8.5" width at 96 DPI
            minHeight: '1056px', // Standard 11" height
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            padding: '36px 44px',
            boxSizing: 'border-box',
            fontFamily: '"Times New Roman", Times, Georgia, serif',
            color: '#000000',
            position: 'relative',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease'
          }}
        >
          {/* ======================================================== */}
          {/* FORM 1: JOB REQUEST FOR REPAIR (QF-PDAS-DC-01)          */}
          {/* ======================================================== */}
          {activeForm === 'job-request' && (
            <div style={{ position: 'relative' }}>
              {/* Header Box Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', marginBottom: '10px', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    {/* Logo Box with Draggable Logo */}
                    <td style={{ width: '80px', borderRight: '1.5px solid #000000', padding: '6px', textAlign: 'center', verticalAlign: 'middle', position: 'relative' }}>
                      <div
                        onMouseDown={handleLogoMouseDown}
                        style={{
                          display: 'inline-block',
                          cursor: isDraggingLogo ? 'grabbing' : 'grab',
                          position: 'relative',
                          transform: `translate(${jobDraft.logoOffsetX || 0}px, ${jobDraft.logoOffsetY || 0}px)`,
                          padding: '2px',
                          border: isDraggingLogo ? '2px dashed #001f9c' : '1px dashed transparent',
                          borderRadius: '4px',
                          transition: isDraggingLogo ? 'none' : 'transform 0.1s ease',
                          zIndex: isDraggingLogo ? 1000 : 10
                        }}
                        title="Click and drag to move the logo freely around the page!"
                      >
                        <img
                          src={jobDraft.customLogoUrl || isatuLogo}
                          alt="ISAT U Logo"
                          style={{
                            width: `${jobDraft.logoWidth || 54}px`,
                            height: `${jobDraft.logoWidth || 54}px`,
                            objectFit: 'contain',
                            pointerEvents: 'none'
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '-8px',
                          right: '-8px',
                          background: '#001f9c',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }}>
                          <Move size={10} />
                        </div>
                      </div>
                    </td>

                    {/* University & Title Column */}
                    <td style={{ borderRight: '1.5px solid #000000', padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <EditableText fieldKey="republicLine" fallback="Republic of the Philippines" />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '2px 0' }}>
                        <EditableText fieldKey="institutionName" fallback="ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY" />
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        <EditableText fieldKey="campusName" fallback="DUMANGAS CAMPUS" />
                      </div>
                      <div style={{ fontSize: '9.5px' }}>
                        <EditableText fieldKey="campusAddress" fallback="P.D. Monfort South, Dumangas, Iloilo" />
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.02em', borderTop: '1px solid #000000', paddingTop: '4px' }}>
                        <EditableText fieldKey="documentTitle" fallback="JOB REQUEST FOR REPAIR, MAINTENANCE AND CONSTRUCTION" />
                      </div>
                    </td>

                    {/* Metadata Column */}
                    <td style={{ width: '190px', padding: 0, verticalAlign: 'top', fontSize: '9.5px' }}>
                      <div style={{ borderBottom: '1px solid #000000', padding: '3px 6px', fontWeight: 'bold' }}>
                        <EditableText fieldKey="department" fallback="Department: PDAS" />
                      </div>
                      <div style={{ borderBottom: '1px solid #000000', padding: '3px 6px' }}>
                        Document Code: <strong><EditableText fieldKey="documentCode" fallback="QF-PDAS-DC-01" /></strong>
                      </div>
                      <div style={{ borderBottom: '1px solid #000000', padding: '3px 6px' }}>
                        Revision Number: <strong><EditableText fieldKey="revisionNo" fallback="00" /></strong>
                      </div>
                      <div style={{ padding: '3px 6px' }}>
                        Effective Date: <strong><EditableText fieldKey="effectiveDate" fallback="February 3, 2025" /></strong>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Meta Requester Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '8px' }}>
                <div>
                  <strong>Tracking Number: </strong>
                  <span style={{ borderBottom: '1px solid #000', padding: '0 4px', fontWeight: 'bold' }}>REQ-2026-001 (Sample)</span>
                </div>
                <div>
                  <strong>Date of Request: </strong>
                  <span style={{ borderBottom: '1px solid #000', padding: '0 4px' }}>October 24, 2026</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Name of Client: </strong>
                  <span style={{ borderBottom: '1px solid #000', padding: '0 4px', width: '70%', display: 'inline-block' }}>Prof. Juan Dela Cruz (Sample Requester)</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Office of Client: </strong>
                  <span style={{ borderBottom: '1px solid #000', padding: '0 4px', width: '70%', display: 'inline-block' }}>Administration Building, Room 102</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Immediate Supervisor: </strong>
                  <span style={{ borderBottom: '1px solid #000', padding: '0 4px', width: '70%', display: 'inline-block' }}>Dr. Maria Santos</span>
                </div>
              </div>

              {/* Scope of Works Section Header */}
              <div style={{ border: '1.5px solid #000', padding: '4px 8px', background: 'var(--bg-surface)', fontWeight: 'bold', fontSize: '11px', textAlign: 'center', marginBottom: '4px' }}>
                SCOPE OF WORKS (Editable Trade Categories)
              </div>

              {/* Scope Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10px', marginBottom: '8px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ width: '25%', padding: '4px', borderRight: '1px solid #000', fontWeight: 'bold' }}>1. Physical Structures</td>
                    <td style={{ padding: '4px' }}>[✓] Repair [ ] New Structure [ ] Rehabilitation [ ] Others</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '4px', borderRight: '1px solid #000', fontWeight: 'bold' }}>2. Electrical Works</td>
                    <td style={{ padding: '4px' }}>[✓] Repair [ ] New Installation [ ] Renovation</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '4px', borderRight: '1px solid #000', fontWeight: 'bold' }}>3. Air Conditioning</td>
                    <td style={{ padding: '4px' }}>[✓] Repair [ ] Cleaning &amp; Maintenance [ ] Relocation</td>
                  </tr>
                </tbody>
              </table>

              {/* Action Taken & Approvals */}
              <div style={{ border: '1.5px solid #000', padding: '6px', fontSize: '10.5px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '3px', marginBottom: '4px' }}>
                  ACTION TAKEN (PDAS Head Evaluation &amp; Assignment)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <div>
                    <div>Status: <strong>Approved for Dispatch</strong></div>
                    <div>Assigned To: <strong>Lead Maintenance Specialist</strong></div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid #000', paddingLeft: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#1e40af', fontWeight: 'bold' }}>✓ Electronically Approved</div>
                    <div style={{ fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #000', margin: '4px 10px' }}>
                      <EditableText fieldKey="pdasHeadName" fallback={PDAS_HEAD_NAME} />
                    </div>
                    <div style={{ fontSize: '9.5px' }}>
                      <EditableText fieldKey="pdasHeadTitle" fallback={PDAS_HEAD_TITLE} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Action (Campus Administrator) */}
              <div style={{ border: '1.5px solid #000', padding: '6px', fontSize: '10.5px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '3px', marginBottom: '4px' }}>
                  FINAL ACTION (Campus Administrator Confirmation)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <div>
                    <div>Final Decision: <strong>Approved</strong></div>
                    <div>Institutional Log: <strong>Recorded in PDAS Registry</strong></div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid #000', paddingLeft: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#1e40af', fontWeight: 'bold' }}>✓ Electronically Approved</div>
                    <div style={{ fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #000', margin: '4px 10px' }}>
                      <EditableText fieldKey="approverName" fallback={CAMPUS_ADMIN_NAME} />
                    </div>
                    <div style={{ fontSize: '9.5px' }}>
                      <EditableText fieldKey="approverTitle" fallback={APPROVER_TITLE} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Disclaimers */}
              <div style={{ fontSize: '9px', color: '#475569', textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '4px', lineHeight: 1.3 }}>
                <EditableText fieldKey="copyDistribution" fallback="Copy distribution: 1 – PDAS, 1 – GSM, 1 – Client" />
                <br />
                <EditableText fieldKey="disclaimerNotice" fallback="The electronic approvals recorded on this form are internal, timestamped administrative confirmations." />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* FORM 2: CLIENT SATISFACTION MEASUREMENT (QF-HRM-15)     */}
          {/* ======================================================== */}
          {activeForm === 'csm' && (
            <div style={{ position: 'relative' }}>
              {/* Header Box Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', marginBottom: '8px' }}>
                <tbody>
                  <tr>
                    {/* Draggable Logo Cell */}
                    <td style={{ width: '80px', padding: '6px', textAlign: 'center', borderRight: '1px solid #000000', verticalAlign: 'middle', position: 'relative' }}>
                      <div
                        onMouseDown={handleLogoMouseDown}
                        style={{
                          display: 'inline-block',
                          cursor: isDraggingLogo ? 'grabbing' : 'grab',
                          position: 'relative',
                          transform: `translate(${csmDraft.logoOffsetX || 0}px, ${csmDraft.logoOffsetY || 0}px)`,
                          padding: '2px',
                          border: isDraggingLogo ? '2px dashed #001f9c' : '1px dashed transparent',
                          borderRadius: '4px',
                          transition: isDraggingLogo ? 'none' : 'transform 0.1s ease',
                          zIndex: isDraggingLogo ? 1000 : 10
                        }}
                        title="Click and drag to move the logo freely around the page!"
                      >
                        <img
                          src={csmDraft.customLogoUrl || isatuLogo}
                          alt="ISAT U Seal"
                          style={{
                            width: `${csmDraft.logoWidth || 54}px`,
                            height: `${csmDraft.logoWidth || 54}px`,
                            objectFit: 'contain',
                            pointerEvents: 'none'
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '-8px',
                          right: '-8px',
                          background: '#001f9c',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }}>
                          <Move size={10} />
                        </div>
                      </div>
                    </td>

                    {/* University & Title */}
                    <td style={{ padding: '6px 12px', textAlign: 'center', borderRight: '1.5px solid #000000', verticalAlign: 'middle' }}>
                      <div style={{ fontSize: '10px' }}>
                        <EditableText fieldKey="republicLine" fallback="Republic of the Philippines" />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '2px 0' }}>
                        <EditableText fieldKey="institutionName" fallback="ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY" />
                      </div>
                      <div style={{ fontSize: '10px' }}>
                        <EditableText fieldKey="campusAddress" fallback="La Paz, Iloilo City" />
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', letterSpacing: '0.05em' }}>
                        <EditableText fieldKey="documentTitle" fallback="CLIENT SATISFACTION MEASUREMENT" />
                      </div>
                    </td>

                    {/* Metadata Right Box */}
                    <td style={{ width: '190px', padding: '4px 8px', fontSize: '9.5px', verticalAlign: 'top', borderLeft: '1.5px solid #000000' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '75px 1fr', rowGap: '2px' }}>
                        <span>Department:</span><strong><EditableText fieldKey="department" fallback="HRMO" /></strong>
                        <span>Doc. Code:</span><strong><EditableText fieldKey="documentCode" fallback="QF-HRM-15" /></strong>
                        <span>Rev. No.:</span><strong><EditableText fieldKey="revisionNo" fallback="07" /></strong>
                        <span>Effective Date:</span><strong><EditableText fieldKey="effectiveDate" fallback="April 15, 2026" /></strong>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Intro Note */}
              <p style={{ margin: '0 0 6px', fontSize: '9.5px', textAlign: 'justify', lineHeight: '1.2' }}>
                <EditableText fieldKey="introText" tag="span" fallback="This Client Satisfaction Measurement (CSM) tracks the customer experience of government offices. Your feedback on your recently concluded transaction will help this office provide a better service. Personal information shared will be kept confidential and you always have the option to not answer this form." />
              </p>

              {/* Data Privacy Commitment */}
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '10px', margin: '4px 0 2px' }}>
                <EditableText fieldKey="dataPrivacyTitle" fallback="Data Privacy Commitment" />
              </div>
              <p style={{ margin: '0 0 5px', fontSize: '9px', textAlign: 'justify', lineHeight: '1.2' }}>
                <EditableText fieldKey="dataPrivacyText" tag="span" fallback="Pursuant to Republic Act No. 10173, also known as the Data Privacy Act of 2012, Iloilo Science and Technology University affirms its commitment to protect and respect the privacy of its clients and stakeholders. All information collected through the Client Satisfaction Measurement (CSM) Form shall be processed and safeguarded in accordance with the principles of transparency, legitimate purpose, and proportionality, as mandated under the Data Privacy Act of 2012." />
              </p>

              {/* Consent of Data Subject */}
              <div style={{ border: '1px dashed #666', padding: '4px 6px', marginBottom: '8px', fontSize: '9px', background: '#fafafa' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '2px' }}>
                  <EditableText fieldKey="consentTitle" fallback="Consent of Data Subject" />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', gap: '2px', fontWeight: 'bold' }}>
                    <span>☒ Yes</span>
                    <span>☐ No</span>
                  </div>
                  <div style={{ textAlign: 'justify', lineHeight: '1.15' }}>
                    <EditableText fieldKey="consentText" tag="span" fallback="I hereby give my consent and authorize Iloilo Science and Technology University to collect, process, share, disclose, or transfer my personal data to authorized third parties when necessary for journalistic, artistic, literary, research, or other lawful purposes, in accordance with the provisions of Republic Act No. 10173, also known as the Data Privacy Act of 2012." />
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: '4px', fontSize: '10px', marginBottom: '8px' }}>
                <div>
                  <span>Office transacted with: </span>
                  <span style={{ borderBottom: '1px solid #000', padding: '0 6px', fontWeight: 'bold' }}>
                    <EditableText fieldKey="officeTransactedWith" fallback="Physical Development and Auxiliary Services (PDAS)" />
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <span>Client type:</span>
                  <span>☐ Citizen</span>
                  <span>☐ Business</span>
                  <span>☒ Government (Employee or another agency)</span>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div>Date: <span style={{ borderBottom: '1px solid #000', padding: '0 6px' }}>October 24, 2026</span></div>
                  <div>Sex: <span>☒ Male</span> <span>☐ Female</span></div>
                  <div>Age: <span style={{ borderBottom: '1px solid #000', padding: '0 10px' }}>28</span></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    Region of residence: <span style={{ borderBottom: '1px solid #000', padding: '0 4px', fontWeight: 'bold' }}>
                      <EditableText fieldKey="defaultRegion" fallback="Region VI - Western Visayas" />
                    </span>
                  </div>
                  <div>
                    Service Availed: <span style={{ borderBottom: '1px solid #000', padding: '0 4px', fontWeight: 'bold' }}>Aircon Maintenance (REQ-2026-001)</span>
                  </div>
                </div>
              </div>

              {/* Citizen's Charter Section */}
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginBottom: '6px' }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '3px' }}>
                  INSTRUCTIONS: <EditableText fieldKey="ccInstructions" fallback="Check mark (✓) your answer to the Citizen's Charter (CC) questions. The Citizen's Charter is an official document that reflects the services of a government agency/office." />
                </div>
                <div style={{ fontSize: '9.5px', marginBottom: '4px' }}>
                  <strong>CC1. </strong>
                  <EditableText fieldKey="cc1Prompt" fallback="Which of the following best describes your awareness of a CC?" />
                </div>
                <div style={{ fontSize: '9.5px', marginBottom: '4px' }}>
                  <strong>CC2. </strong>
                  <EditableText fieldKey="cc2Prompt" fallback="If aware of CC (answered 1-3 in CC1), would you say that the CC of this office was...?" />
                </div>
                <div style={{ fontSize: '9.5px', marginBottom: '6px' }}>
                  <strong>CC3. </strong>
                  <EditableText fieldKey="cc3Prompt" fallback="If aware of CC (answered codes 1-3 in CC1), how much did the CC help you in your transaction?" />
                </div>
              </div>

              {/* SQD Table with In-Place Editable Questions */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000000', textAlign: 'center', fontSize: '9px', marginBottom: '6px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #000000', background: 'var(--bg-surface)' }}>
                    <th style={{ width: '48%', borderRight: '1px solid #000000', padding: '4px', textAlign: 'left' }}>
                      <EditableText fieldKey="sqdInstructions" fallback="For SQD 0-8, please put a check mark (✓) on the column that best corresponds to your answer." />
                    </th>
                    <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '2px' }}>😃<br />Strongly Agree<br />5</th>
                    <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '2px' }}>🙂<br />Agree<br />4</th>
                    <th style={{ width: '9.5%', borderRight: '1px solid #000000', padding: '2px' }}>😐<br />Neutral<br />3</th>
                    <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '2px' }}>🙁<br />Disagree<br />2</th>
                    <th style={{ width: '8.5%', borderRight: '1px solid #000000', padding: '2px' }}>😫<br />Strongly Disagree<br />1</th>
                    <th style={{ width: '8.5%', padding: '2px' }}>—<br />N/A<br />0</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['sqd0', 'SQD0', 'I am satisfied with the service that I availed.'],
                    ['sqd1', 'SQD1', 'I spent a reasonable amount of time for my transaction.'],
                    ['sqd2', 'SQD2', "The office followed the transaction's requirements and steps based on the information provided."],
                    ['sqd3', 'SQD3', 'The steps (including payment) I needed to do for my transaction were easy and simple.'],
                    ['sqd4', 'SQD4', 'I easily found information about my transaction from the office or its website.'],
                    ['sqd5', 'SQD5', 'I paid a reasonable amount of fees for my transaction.'],
                    ['sqd6', 'SQD6', 'I feel the office was fair to everyone, or "walang palakasan", during my transaction.'],
                    ['sqd7', 'SQD7', 'I was treated courteously by the staff, and (if asked for help) the staff was helpful.'],
                    ['sqd8', 'SQD8', 'I got what I needed from the government office, or (if denied) denial of request was sufficiently explained to me.']
                  ].map(([k, code, defText]) => (
                    <tr key={k} style={{ borderBottom: '1px solid #000000' }}>
                      <td style={{ borderRight: '1px solid #000000', padding: '3px 6px', textAlign: 'left', lineHeight: '1.2' }}>
                        <strong>{code}. </strong>
                        <EditableText fieldKey={k} fallback={defText} />
                      </td>
                      <td style={{ borderRight: '1px solid #000000', fontWeight: 'bold' }}>✓</td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Suggestions & Closing */}
              <div style={{ fontSize: '9.5px', margin: '4px 0' }}>
                <EditableText fieldKey="suggestionsPrompt" fallback="Suggestions on how we can further improve our services (optional):" />
                <span style={{ borderBottom: '1px solid #000', display: 'inline-block', width: '50%', minHeight: '12px', marginLeft: '6px' }}></span>
              </div>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.1em', marginTop: '6px' }}>
                <EditableText fieldKey="footerClosing" fallback="THANK YOU!" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
