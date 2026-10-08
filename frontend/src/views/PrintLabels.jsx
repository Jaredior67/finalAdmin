import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer, QrCode, Search, Building2, MapPin, Tag,
  Plus, Edit2, Trash2, Layers, LayoutGrid, Table as TableIcon,
  CheckSquare, Square, Copy, Check
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Modal } from '../components/common/Modal';

export const PrintLabels = () => {
  const { 
    campusLocations, 
    addCampusLocation, 
    updateCampusLocation, 
    deleteCampusLocation,
    requisitions
  } = useData();

  const [selectedBldg, setSelectedBldg] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [labelFormat, setLabelFormat] = useState('cards'); // 'cards' | 'sheet' | 'table'

  // Selection for batch printing
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [copiedTag, setCopiedTag] = useState(null);

  // Modal State for Building/Room Registration & Editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [formData, setFormData] = useState({
    building: '',
    bldgShort: '',
    floor: 'Ground Floor',
    room: '',
    qrCodeRef: ''
  });
  const [formError, setFormError] = useState('');

  // Delete Confirmation Modal State
  const [deletingLoc, setDeletingLoc] = useState(null);

  // Combine campusLocations with any custom rooms found in requisitions if not present
  const allLocations = useMemo(() => {
    const list = campusLocations || [];
    const map = new Map();
    list.forEach(loc => map.set(loc.qrCodeRef, loc));
    
    requisitions.forEach(req => {
      if (req.qrCodeRef && !map.has(req.qrCodeRef)) {
        map.set(req.qrCodeRef, {
          id: `req-loc-${req.qrCodeRef}`,
          building: req.building || req.location || 'ISAT U Campus',
          bldgShort: 'General',
          floor: req.floor || 'Ground Floor',
          room: req.room || req.location || 'Assigned Room',
          qrCodeRef: req.qrCodeRef
        });
      }
    });
    return Array.from(map.values());
  }, [campusLocations, requisitions]);

  /* Real, scannable QR images for the printed tags.
     The label drew the lucide <QrCode /> glyph — a decorative square pattern no
     camera can decode — directly above a "SCAN ME" caption, so a printed tag
     told people to scan something that was not a QR code. The scanner accepts a
     raw `qrCodeRef` string (QrCodeScannerModal.parseQrText, direct match), so
     encoding that value is all a working tag needs. */
  const [qrImages, setQrImages] = useState({});

  useEffect(() => {
    let live = true;
    const targets = allLocations.filter((loc) => loc.qrCodeRef);
    if (targets.length === 0) {
      setQrImages({});
      return () => { live = false; };
    }
    import('qrcode')
      .then((m) => {
        const toDataURL = (m.default || m).toDataURL;
        return Promise.all(
          targets.map(async (loc) => {
            try {
              const url = await toDataURL(String(loc.qrCodeRef), {
                width: 240,
                margin: 1,
                errorCorrectionLevel: 'M'
              });
              return [loc.qrCodeRef, url];
            } catch {
              return [loc.qrCodeRef, null];
            }
          })
        );
      })
      .then((pairs) => { if (live) setQrImages(Object.fromEntries(pairs)); })
      .catch(() => { if (live) setQrImages({}); });
    return () => { live = false; };
  }, [allLocations]);

  // Live preview of the tag being typed in the registration modal, so the admin
  // sees the exact code that will be printed rather than a decorative glyph.
  const [previewQr, setPreviewQr] = useState('');
  useEffect(() => {
    const value = (formData.qrCodeRef || '').trim();
    if (!value) {
      setPreviewQr('');
      return () => {};
    }
    let live = true;
    import('qrcode')
      .then((m) => (m.default || m).toDataURL(value, { width: 200, margin: 1, errorCorrectionLevel: 'M' }))
      .then((url) => { if (live) setPreviewQr(url); })
      .catch(() => { if (live) setPreviewQr(''); });
    return () => { live = false; };
  }, [formData.qrCodeRef]);

  // Unique list of registered buildings for filtering and dropdowns
  const uniqueBuildings = useMemo(() => {
    const bldgMap = new Map();
    allLocations.forEach(loc => {
      if (loc.building) {
        if (!bldgMap.has(loc.building)) {
          bldgMap.set(loc.building, loc.bldgShort || loc.building.split(' ')[0]);
        }
      }
    });
    return Array.from(bldgMap.entries()).map(([name, short]) => ({ name, short }));
  }, [allLocations]);

  // Filtered locations based on search and building tabs
  const filteredLocations = useMemo(() => {
    return allLocations.filter(loc => {
      const matchesBldg = selectedBldg === 'all' || 
        (loc.bldgShort && loc.bldgShort.toLowerCase() === selectedBldg.toLowerCase()) ||
        (loc.building && loc.building.toLowerCase().includes(selectedBldg.toLowerCase()));
      
      const term = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        (loc.room && loc.room.toLowerCase().includes(term)) ||
        (loc.building && loc.building.toLowerCase().includes(term)) ||
        (loc.qrCodeRef && loc.qrCodeRef.toLowerCase().includes(term)) ||
        (loc.floor && loc.floor.toLowerCase().includes(term));

      return matchesBldg && matchesSearch;
    });
  }, [allLocations, selectedBldg, searchTerm]);

  // Dynamic Tabs
  const bldgTabs = useMemo(() => {
    const tabs = [{ id: 'all', label: 'All Campus Buildings', count: allLocations.length }];
    uniqueBuildings.forEach(b => {
      const count = allLocations.filter(l => 
        l.bldgShort?.toLowerCase() === b.short.toLowerCase() || 
        l.building?.toLowerCase() === b.name.toLowerCase()
      ).length;
      tabs.push({
        id: b.short || b.name,
        label: b.name.length > 25 ? `${b.name.slice(0, 22)}...` : b.name,
        count
      });
    });
    return tabs;
  }, [allLocations, uniqueBuildings]);

  // Open Modal for New Registration
  const handleOpenRegister = () => {
    setEditingLoc(null);
    setFormData({
      building: uniqueBuildings[0]?.name || 'Administration Building',
      bldgShort: uniqueBuildings[0]?.short || 'Admin',
      floor: 'Ground Floor',
      room: '',
      qrCodeRef: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Modal for Editing Existing Location
  const handleOpenEdit = (loc) => {
    setEditingLoc(loc);
    setFormData({
      building: loc.building || '',
      bldgShort: loc.bldgShort || '',
      floor: loc.floor || 'Ground Floor',
      room: loc.room || '',
      qrCodeRef: loc.qrCodeRef || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Auto-generate QR Tag helper
  const handleAutoGenerateQR = () => {
    const short = formData.bldgShort || (formData.building ? formData.building.split(' ')[0] : 'BLDG');
    const cleanShort = short.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanRoom = formData.room ? formData.room.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() : 'RM';
    const floorDigit = formData.floor.includes('2') ? '2' : formData.floor.includes('3') ? '3' : formData.floor.includes('4') ? '4' : 'G';
    const tag = `ISATU-${cleanShort}-${floorDigit}-${cleanRoom || Math.floor(100 + Math.random() * 900)}`;
    setFormData(prev => ({ ...prev, qrCodeRef: tag }));
  };

  // Submit Register / Edit
  const handleSubmitLocation = (e) => {
    e.preventDefault();
    if (!formData.building.trim()) {
      setFormError('Building name is required.');
      return;
    }
    if (!formData.room.trim()) {
      setFormError('Room or Facility Name is required.');
      return;
    }

    let finalQrRef = formData.qrCodeRef.trim();
    if (!finalQrRef) {
      const short = formData.bldgShort || formData.building.split(' ')[0] || 'BLDG';
      finalQrRef = `ISATU-${short.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    }

    if (editingLoc) {
      updateCampusLocation(editingLoc.id || editingLoc.qrCodeRef, {
        ...formData,
        qrCodeRef: finalQrRef
      });
    } else {
      addCampusLocation({
        ...formData,
        qrCodeRef: finalQrRef
      });
    }

    setIsModalOpen(false);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (deletingLoc) {
      deleteCampusLocation(deletingLoc.id || deletingLoc.qrCodeRef);
      setDeletingLoc(null);
    }
  };

  // Batch Selection
  const toggleSelectTag = (qrRef) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(qrRef)) next.delete(qrRef);
      else next.add(qrRef);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedTags.size === filteredLocations.length) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(filteredLocations.map(l => l.qrCodeRef)));
    }
  };

  const handleCopyTag = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1800);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="page-title">Facility Asset & Location QR Registry</h1>
            <span style={{
              background: '#001f9c',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 10px',
              borderRadius: '6px'
            }}>
              ISAT U Admin Control
            </span>
            <span style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px solid #bfdbfe'
            }}>
              {allLocations.length} Registered Rooms & Facilities
            </span>
          </div>
          <p className="page-subtitle">
            Admin master control for campus buildings, floors, rooms, and verifiable physical QR door & equipment tags
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleOpenRegister}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Register Building & Room
          </button>

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} /> Print {selectedTags.size > 0 ? `Selected (${selectedTags.size})` : `All (${filteredLocations.length})`}
          </button>
        </div>
      </div>

      {/* Building Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '20px',
        paddingBottom: '2px',
        overflowX: 'auto'
      }}>
        {bldgTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${selectedBldg === tab.id ? 'active' : ''}`}
            onClick={() => setSelectedBldg(tab.id)}
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '700',
              border: 'none',
              background: 'none',
              color: selectedBldg === tab.id ? '#001f9c' : '#64748b',
              borderBottom: selectedBldg === tab.id ? '2.5px solid #001f9c' : '2.5px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search & Layout Controls Bar */}
      <div className="filter-bar" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="search-input-wrapper" style={{ flex: '1', minWidth: '260px' }}>
          <Search size={16} className="search-input-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search room name, building, floor, or QR tag reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Multi-Select Select All Button */}
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={handleSelectAllFiltered}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {selectedTags.size === filteredLocations.length && filteredLocations.length > 0 ? (
            <CheckSquare size={15} color="#001f9c" />
          ) : (
            <Square size={15} />
          )}
          <span>{selectedTags.size > 0 ? `Selected (${selectedTags.size}/${filteredLocations.length})` : 'Select All'}</span>
        </button>

        {/* Layout Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
          <span>View:</span>
          <button
            type="button"
            className={`btn btn-sm ${labelFormat === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLabelFormat('cards')}
            title="Standard QR Cards"
          >
            <LayoutGrid size={14} style={{ marginRight: '4px' }} /> Cards
          </button>
          <button
            type="button"
            className={`btn btn-sm ${labelFormat === 'sheet' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLabelFormat('sheet')}
            title="Compact Printable Sticker Sheet"
          >
            <Layers size={14} style={{ marginRight: '4px' }} /> Sticker Sheet
          </button>
          <button
            type="button"
            className={`btn btn-sm ${labelFormat === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setLabelFormat('table')}
            title="Asset Registry Table"
          >
            <TableIcon size={14} style={{ marginRight: '4px' }} /> Database Table
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredLocations.length === 0 ? (
        <div className="content-card" style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
          <Building2 size={42} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
            No Matching Campus Locations Found
          </h3>
          <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto 16px auto' }}>
            No registered rooms match your search query or selected building tab.
          </p>
          <button type="button" className="btn btn-primary" onClick={handleOpenRegister}>
            <Plus size={15} /> Register New Room / Building
          </button>
        </div>
      ) : labelFormat === 'table' ? (
        /* Table View */
        <div className="content-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: '700' }}>
                  <th style={{ padding: '12px 14px', width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedTags.size === filteredLocations.length && filteredLocations.length > 0}
                      onChange={handleSelectAllFiltered}
                    />
                  </th>
                  <th style={{ padding: '12px 14px' }}>QR Code Preview</th>
                  <th style={{ padding: '12px 14px' }}>Room / Facility Name</th>
                  <th style={{ padding: '12px 14px' }}>Building</th>
                  <th style={{ padding: '12px 14px' }}>Floor Level</th>
                  <th style={{ padding: '12px 14px' }}>QR Reference Tag</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map((loc, idx) => (
                  <tr 
                    key={loc.id || loc.qrCodeRef || idx}
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      background: selectedTags.has(loc.qrCodeRef) ? '#f0f9ff' : idx % 2 === 0 ? '#ffffff' : '#fafafa'
                    }}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedTags.has(loc.qrCodeRef)}
                        onChange={() => toggleSelectTag(loc.qrCodeRef)}
                      />
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: '#f0f4ff', padding: '6px', borderRadius: '6px', border: '1px solid #dbeafe' }}>
                          <QrCode size={26} color="#001f9c" />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#001f9c' }}>
                          {loc.qrCodeRef}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>
                      {loc.room}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={13} color="#f59e0b" />
                        <span>{loc.building}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} color="#3b82f6" />
                        <span>{loc.floor}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <code style={{ background: 'var(--bg-muted)', padding: '2px 6px', borderRadius: '4px', fontSize: '11.5px', color: '#0f172a' }}>
                        {loc.qrCodeRef}
                      </code>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Copy QR Tag"
                          onClick={() => handleCopyTag(loc.qrCodeRef)}
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff', cursor: 'pointer' }}
                        >
                          {copiedTag === loc.qrCodeRef ? <Check size={14} color="#059669" /> : <Copy size={14} color="#64748b" />}
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Edit Building/Room"
                          onClick={() => handleOpenEdit(loc)}
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #dbeafe', background: '#eff6ff', cursor: 'pointer', color: '#1d4ed8' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          title="Delete Location"
                          onClick={() => setDeletingLoc(loc)}
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', cursor: 'pointer', color: '#dc2626' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards or Sticker Sheet Grid View */
        <div style={{
          display: 'grid',
          gridTemplateColumns: labelFormat === 'sheet' 
            ? 'repeat(auto-fill, minmax(270px, 1fr))' 
            : 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: labelFormat === 'sheet' ? '12px' : '18px'
        }}>
          {filteredLocations.map(loc => {
            const isSelected = selectedTags.has(loc.qrCodeRef);
            return (
              <div
                key={loc.id || loc.qrCodeRef}
                className="content-card"
                style={{
                  padding: labelFormat === 'sheet' ? '16px' : '20px',
                  border: isSelected ? '2px solid #001f9c' : '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  background: isSelected ? '#f8faff' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Header Badge */}
                <div style={{
                  background: '#001f9c',
                  color: '#ffffff',
                  margin: labelFormat === 'sheet' ? '-16px -16px 12px -16px' : '-20px -20px 14px -20px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '0.04em'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectTag(loc.qrCodeRef)}
                      style={{ cursor: 'pointer' }}
                      title="Select for print"
                    />
                    <span>ISAT U DUMANGAS CAMPUS</span>
                  </div>
                  <span style={{ background: '#f59e0b', color: '#0f172a', padding: '1px 6px', borderRadius: '4px', fontSize: '9.5px', fontWeight: '800' }}>
                    PDAS FIXIT
                  </span>
                </div>

                {/* Main Content with QR simulation */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{
                    background: 'var(--bg-sunken)',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {qrImages[loc.qrCodeRef] ? (
                      <img
                        src={qrImages[loc.qrCodeRef]}
                        alt={`QR tag for ${loc.room}`}
                        style={{
                          width: labelFormat === 'sheet' ? 52 : 64,
                          height: labelFormat === 'sheet' ? 52 : 64,
                          display: 'block',
                          imageRendering: 'pixelated'
                        }}
                      />
                    ) : (
                      <QrCode size={labelFormat === 'sheet' ? 52 : 64} color="#001f9c" />
                    )}
                    <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#64748b', marginTop: '3px' }}>
                      SCAN ME
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: labelFormat === 'sheet' ? '13.5px' : '15px',
                      fontWeight: '800',
                      color: '#0f172a',
                      lineHeight: 1.3,
                      marginBottom: '4px'
                    }}>
                      {loc.room}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {loc.building}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} color="#3b82f6" style={{ flexShrink: 0 }} />
                      <span>{loc.floor}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Asset Tag & Admin Actions */}
                <div style={{
                  borderTop: '1px dashed #cbd5e1',
                  paddingTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Tag size={12} color="#001f9c" /> Tag: <strong style={{ color: '#001f9c' }}>{loc.qrCodeRef}</strong>
                  </span>
                  
                  {/* Admin Quick Buttons */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      type="button"
                      title="Copy QR Tag"
                      onClick={() => handleCopyTag(loc.qrCodeRef)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '3px', color: '#64748b' }}
                    >
                      {copiedTag === loc.qrCodeRef ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                    </button>
                    <button
                      type="button"
                      title="Edit Room / Building"
                      onClick={() => handleOpenEdit(loc)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '3px', color: '#1d4ed8' }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      title="Delete Location"
                      onClick={() => setDeletingLoc(loc)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '3px', color: '#dc2626' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Register / Edit Campus Building & Room */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLoc ? "Edit Registered Building & Room" : "Register New Campus Building & Room"}
        maxWidth="600px"
      >
        <form onSubmit={handleSubmitLocation}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {formError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            {/* Building Name & Short Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                  Building Full Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Technology Building"
                  value={formData.building}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      building: val,
                      bldgShort: prev.bldgShort || val.split(' ')[0]
                    }));
                  }}
                  required
                />
                {/* Quick Select from existing */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Quick select:</span>
                  {uniqueBuildings.map(b => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, building: b.name, bldgShort: b.short }))}
                      style={{
                        background: 'var(--bg-muted)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        color: '#1e293b'
                      }}
                    >
                      {b.short || b.name.slice(0, 10)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                  Short Code *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CEA, ADMIN, CICT"
                  value={formData.bldgShort}
                  onChange={(e) => setFormData(prev => ({ ...prev, bldgShort: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
            </div>

            {/* Floor Level */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                  Floor Level *
                </label>
                <select
                  className="form-select"
                  value={formData.floor}
                  onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                >
                  <option value="Ground Floor">Ground Floor</option>
                  <option value="1st Floor">1st Floor</option>
                  <option value="2nd Floor">2nd Floor</option>
                  <option value="3rd Floor">3rd Floor</option>
                  <option value="4th Floor">4th Floor</option>
                  <option value="Basement">Basement</option>
                  <option value="Roof Deck / Penthouse">Roof Deck / Penthouse</option>
                  <option value="Outdoor Facility">Outdoor Facility</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '4px', display: 'block' }}>
                  Room / Facility Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Room 302 Electronics Lab, Dean Office"
                  value={formData.room}
                  onChange={(e) => setFormData(prev => ({ ...prev, room: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* QR Tag Reference & Auto Generate */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12.5px', margin: 0 }}>
                  QR Code Reference Tag
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateQR}
                  style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Generate tag
                </button>
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. ISATU-CEA-3-302"
                value={formData.qrCodeRef}
                onChange={(e) => setFormData(prev => ({ ...prev, qrCodeRef: e.target.value.toUpperCase() }))}
              />
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                This unique QR tag will be embedded into the physical camera scanning matrix and official QF-PDAS-DC-01 request documents.
              </p>
            </div>

            {/* Live Visual Label Preview Box */}
            <div style={{
              background: 'var(--bg-sunken)',
              border: '1.5px dashed #cbd5e1',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px',
                textAlign: 'center'
              }}>
                {previewQr ? (
                  <img src={previewQr} alt="QR tag preview" style={{ width: 48, height: 48, display: 'block', imageRendering: 'pixelated' }} />
                ) : (
                  <QrCode size={48} color="#001f9c" />
                )}
                <div style={{ fontSize: '8px', fontWeight: '800', color: '#64748b', marginTop: '2px' }}>PREVIEW</div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                  {formData.room || 'Room / Laboratory Name'}
                </div>
                <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                  {formData.building || 'Building Name'} • {formData.floor}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#001f9c', marginTop: '4px' }}>
                  TAG: <code>{formData.qrCodeRef || 'ISATU-AUTO-GEN'}</code>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingLoc ? "Save Changes" : "Register Location"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Delete Confirmation */}
      <Modal
        isOpen={!!deletingLoc}
        onClose={() => setDeletingLoc(null)}
        title="Remove Facility Asset from Registry?"
        maxWidth="460px"
      >
        <div>
          <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
            Are you sure you want to remove <strong>{deletingLoc?.room}</strong> ({deletingLoc?.building}) from the campus QR database?
          </p>
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#b91c1c', marginBottom: '16px' }}>
            QR Code tag <code>{deletingLoc?.qrCodeRef}</code> will no longer appear in automated location presets.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeletingLoc(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmDelete}
            >
              Delete Location
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
