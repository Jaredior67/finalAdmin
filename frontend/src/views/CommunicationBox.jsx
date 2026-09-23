import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Plus,
  CheckCheck,
  Users,
  Hash,
  Pencil
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { AutoSaveIndicator } from '../components/common/AutoSaveIndicator';
import { useOfflineAutoSave } from '../utils/useOfflineAutoSave';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const getRoleColor = (senderStr) => {
  const s = (senderStr || '').toLowerCase();
  if (s.includes('director') || s.includes('admin') || s.includes('pdas')) return { bg: '#001f9c', text: '#fff', label: 'Admin' };
  if (s.includes('maintenance') || s.includes('tech') || s.includes('mark') || s.includes('ronaldo') || s.includes('arthur')) return { bg: '#0f766e', text: '#fff', label: 'Tech' };
  if (s.includes('faculty') || s.includes('dean') || s.includes('dr.') || s.includes('prof.')) return { bg: '#7c3aed', text: '#fff', label: 'Faculty' };
  if (s.includes('staff') || s.includes('engr.') || s.includes('ms.') || s.includes('mr.')) return { bg: '#d97706', text: '#fff', label: 'Staff' };
  return { bg: '#475569', text: '#fff', label: 'User' };
};

const getInitials = (name = '') => {
  const parts = name.replace(/\(.*?\)/g, '').trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

/* ── Main Component ──────────────────────────────────────────────────────── */
export const CommunicationBox = () => {
  const { messages, sendMessage, createMessageThread, requisitions, messageParticipants = [] } = useData();
  const { currentUser, isAdmin } = useAuth();

  const [activeThreadId, setActiveThreadId] = useState(messages[0]?.id || null);
  const [replyText, setReplyText] = useState('');
  const [searchMsg, setSearchMsg] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newControlNo, setNewControlNo] = useState('');
  const [newInitialMsg, setNewInitialMsg] = useState('');

  const messagesEndRef = useRef(null);

  // Scroll to bottom on thread change or new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadId, messages]);

  // Auto-save compose draft
  const composeDraft = useMemo(() => ({ newRecipient, newSubject, newControlNo, newInitialMsg }),
    [newRecipient, newSubject, newControlNo, newInitialMsg]);

  const { isOnline: isComposeOnline, lastSaved: composeSaved, hasDraft: hasComposeDraft, clearDraft: clearComposeDraft } =
    useOfflineAutoSave(`msg_compose_${currentUser?.id || 'guest'}`, composeDraft, (draft) => {
      if (draft.newRecipient) setNewRecipient(draft.newRecipient);
      if (draft.newSubject) setNewSubject(draft.newSubject);
      if (draft.newControlNo) setNewControlNo(draft.newControlNo);
      if (draft.newInitialMsg) setNewInitialMsg(draft.newInitialMsg);
    });

  const activeThread = messages.find(m => m.id === activeThreadId) || messages[0];

  const approvedParticipants = messageParticipants.filter(user => {
    const role = String(user.role || user.userType || '').toLowerCase();
    const status = String(user.status || '').toLowerCase();
    return (
      ['admin', 'faculty', 'staff', 'maintenance', 'technician'].includes(role) &&
      (!status || ['active', 'approved'].includes(status)) &&
      user.id !== currentUser?.id
    );
  });

  const getParticipantName = (u) =>
    u.name || `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() || u.email;

  const senderName = currentUser?.name
    ? `${currentUser.name} (${currentUser.roleTitle || currentUser.title || 'PDAS'})`
    : 'PDAS Director (Engr. Reynaldo Bautista)';

  const handleSend = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeThread) return;
    sendMessage(activeThread.id, replyText.trim(), senderName);
    setReplyText('');
  };

  const handleCreateThread = (e) => {
    e.preventDefault();
    if (!newRecipient.trim() || !newSubject.trim() || !newInitialMsg.trim()) return;
    const thread = createMessageThread({
      subject: newSubject.trim(),
      recipient: newRecipient.trim(),
      controlNo: newControlNo.trim() || 'CAMPUS-DISPATCH',
      initialMessage: newInitialMsg.trim(),
      senderName
    });
    if (thread) setActiveThreadId(thread.id);
    clearComposeDraft();
    setIsComposeOpen(false);
    setNewRecipient(''); setNewSubject(''); setNewControlNo(''); setNewInitialMsg('');
  };

  const filteredMessages = messages.filter(m => {
    const matchFilter = filterTab === 'all' || (filterTab === 'unread' && m.unread);
    const term = searchMsg.toLowerCase();
    const matchSearch = !searchMsg ||
      (m.sender || '').toLowerCase().includes(term) ||
      (m.subject || '').toLowerCase().includes(term) ||
      (m.controlNo || '').toLowerCase().includes(term);
    return matchFilter && matchSearch;
  });

  const unreadCount = messages.filter(m => m.unread).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              PDAS Communication &amp; Dispatch Desk
            </h1>
            <span style={{ background: '#eff6ff', color: '#001f9c', fontSize: '10.5px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
              Direct Messaging
            </span>
            {unreadCount > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '20px' }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
            Direct communication between requesters, technicians &amp; PDAS administration
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsComposeOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '9px 18px', background: 'linear-gradient(135deg, #001f9c, #0a2ebf)',
            color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700',
            fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,31,156,0.3)',
            transition: 'all 0.15s ease'
          }}
        >
          <Pencil size={14} /> Compose
        </button>
      </div>

      {/* ── Two-Panel Chat Shell ───────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        flex: 1,
        minHeight: '580px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>

        {/* ── LEFT: Thread List ───────────────────────────────────────────── */}
        <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

          {/* Search bar */}
          <div style={{ padding: '12px 12px 10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchMsg}
                onChange={e => setSearchMsg(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px 7px 30px', boxSizing: 'border-box',
                  borderRadius: '8px', border: '1px solid #e2e8f0', background: '#ffffff',
                  fontSize: '12px', color: '#0f172a', outline: 'none'
                }}
              />
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[['all', `All (${messages.length})`], ['unread', `Unread (${unreadCount})`]].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterTab(key)}
                  style={{
                    flex: 1, padding: '5px 8px', borderRadius: '7px', border: 'none',
                    fontSize: '11.5px', fontWeight: '600', cursor: 'pointer',
                    background: filterTab === key ? '#001f9c' : '#ffffff',
                    color: filterTab === key ? '#ffffff' : '#64748b',
                    transition: 'all 0.12s ease'
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Thread items */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredMessages.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <MessageSquare size={28} style={{ color: '#cbd5e1', marginBottom: '10px' }} />
                <div style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600' }}>No conversations found</div>
              </div>
            ) : filteredMessages.map(thread => {
              const isActive = thread.id === activeThreadId;
              const { bg } = getRoleColor(thread.sender);
              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  style={{
                    padding: '13px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: isActive ? '#eff6ff' : thread.unread ? '#fffbeb' : 'transparent',
                    borderLeft: `3px solid ${isActive ? '#001f9c' : 'transparent'}`,
                    transition: 'all 0.12s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '800', color: '#fff', flexShrink: 0
                    }}>
                      {getInitials(thread.sender)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontWeight: thread.unread ? '800' : '600', fontSize: '12.5px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                          {thread.sender.split('(')[0].trim()}
                        </span>
                        <span style={{ fontSize: '10.5px', color: '#94a3b8', flexShrink: 0 }}>{thread.time}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#001f9c', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {thread.subject}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {thread.preview}
                      </div>
                    </div>
                  </div>
                  {thread.unread && (
                    <div style={{
                      position: 'absolute', top: '13px', right: '10px',
                      width: '8px', height: '8px', borderRadius: '50%', background: '#001f9c'
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom compose CTA */}
          <div style={{ padding: '12px', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setIsComposeOpen(true)}
              style={{
                width: '100%', padding: '9px', borderRadius: '8px',
                border: '1.5px dashed #cbd5e1', background: 'transparent',
                color: '#64748b', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'all 0.12s ease'
              }}
            >
              <Plus size={14} /> New Conversation
            </button>
          </div>
        </div>

        {/* ── RIGHT: Chat Detail ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {activeThread ? (
            <>
              {/* Thread header */}
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
                background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {(() => {
                    const { bg } = getRoleColor(activeThread.sender);
                    return (
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', background: bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: '800', color: '#fff', flexShrink: 0
                      }}>
                        {getInitials(activeThread.sender)}
                      </div>
                    );
                  })()}
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a' }}>
                      {activeThread.subject}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        With <strong style={{ color: '#001f9c' }}>{activeThread.sender.split('(')[0].trim()}</strong>
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>•</span>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', padding: '1px 7px',
                        borderRadius: '4px', background: '#f1f5f9', color: '#475569',
                        fontFamily: 'monospace'
                      }}>
                        {activeThread.controlNo}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '11px', color: '#059669', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                    Active Thread
                  </span>
                </div>
              </div>

              {/* Messages body */}
              <div style={{
                flex: 1, padding: '20px', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: '16px',
                background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
              }}>
                {activeThread.thread.map((item, idx) => {
                  const isMine = (isAdmin && item.sender.includes('Director')) ||
                    (currentUser?.name && item.sender.includes(currentUser.name));
                  const { bg, text, label } = getRoleColor(item.sender);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: isMine ? 'row-reverse' : 'row',
                        alignItems: 'flex-end',
                        gap: '10px',
                        maxWidth: '80%',
                        alignSelf: isMine ? 'flex-end' : 'flex-start'
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '50%', background: bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10.5px', fontWeight: '800', color: text, flexShrink: 0
                      }}>
                        {getInitials(item.sender)}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', gap: '3px' }}>
                        {/* Sender + time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!isMine && (
                            <span style={{
                              fontSize: '10px', fontWeight: '700', padding: '1px 6px',
                              borderRadius: '4px', background: bg, color: text
                            }}>{label}</span>
                          )}
                          <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#374151' }}>
                            {item.sender.split('(')[0].trim()}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#9ca3af' }}>•</span>
                          <span style={{ fontSize: '10.5px', color: '#9ca3af' }}>{item.time}</span>
                        </div>

                        {/* Bubble */}
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMine
                            ? 'linear-gradient(135deg, #001f9c, #0a2ebf)'
                            : '#ffffff',
                          color: isMine ? '#ffffff' : '#1e293b',
                          fontSize: '13px',
                          lineHeight: 1.55,
                          boxShadow: isMine
                            ? '0 4px 12px rgba(0,31,156,0.25)'
                            : '0 2px 8px rgba(0,0,0,0.08)',
                          border: isMine ? 'none' : '1px solid #f1f5f9',
                          maxWidth: '100%',
                          wordBreak: 'break-word'
                        }}>
                          {item.text}
                        </div>

                        {/* Read receipt for own messages */}
                        {isMine && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#60a5fa' }}>
                            <CheckCheck size={12} />
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Delivered</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply bar */}
              <form
                onSubmit={handleSend}
                style={{
                  padding: '12px 16px', borderTop: '1px solid #e2e8f0',
                  background: '#ffffff', display: 'flex', gap: '10px', alignItems: 'center'
                }}
              >
                {/* My avatar */}
                {(() => {
                  const { bg, text } = getRoleColor(senderName);
                  return (
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', background: bg, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '800', color: text
                    }}>
                      {getInitials(currentUser?.name || 'PD')}
                    </div>
                  );
                })()}
                <input
                  type="text"
                  placeholder={`Reply as ${currentUser?.name?.split('(')[0]?.trim() || 'PDAS Director'}...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #e2e8f0', background: '#f8fafc',
                    fontSize: '13px', color: '#0f172a', outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#001f9c'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  style={{
                    padding: '10px 18px', borderRadius: '10px', border: 'none',
                    background: replyText.trim() ? 'linear-gradient(135deg, #001f9c, #0a2ebf)' : '#e2e8f0',
                    color: replyText.trim() ? '#ffffff' : '#94a3b8',
                    fontWeight: '700', fontSize: '13px', cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.15s ease',
                    boxShadow: replyText.trim() ? '0 4px 10px rgba(0,31,156,0.25)' : 'none'
                  }}
                >
                  <Send size={14} /> Send
                </button>
              </form>
            </>
          ) : (
            /* Empty state */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#94a3b8' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <MessageSquare size={28} style={{ color: '#cbd5e1' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  No conversation selected
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Choose a thread on the left or compose a new message
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(true)}
                style={{
                  marginTop: '4px', padding: '9px 18px', borderRadius: '8px',
                  background: '#001f9c', color: '#fff', border: 'none',
                  fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Plus size={14} /> Start a Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Compose Modal ──────────────────────────────────────────────────── */}
      {isComposeOpen && (
        <Modal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          title="New PDAS Dispatch Message"
          maxWidth="520px"
        >
          <form onSubmit={handleCreateThread}>
            <div style={{ marginBottom: '12px' }}>
              <AutoSaveIndicator
                isOnline={isComposeOnline}
                lastSaved={composeSaved}
                hasDraft={hasComposeDraft}
                compact
                onClearDraft={() => {
                  clearComposeDraft();
                  setNewRecipient(''); setNewSubject(''); setNewControlNo(''); setNewInitialMsg('');
                }}
              />
            </div>

            {/* Recipient */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">
                <Users size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Recipient *
              </label>
              <input
                type="text"
                className="form-input"
                list="approved-message-participants"
                placeholder="Type or select faculty, staff, or technician..."
                value={newRecipient}
                onChange={e => setNewRecipient(e.target.value)}
                required
              />
              <datalist id="approved-message-participants">
                {approvedParticipants.map(u => (
                  <option key={u.id} value={getParticipantName(u)}>
                    {u.role || u.userType || 'Participant'}
                  </option>
                ))}
              </datalist>
              {approvedParticipants.length > 0 && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#059669' }}>
                  ✓ {approvedParticipants.length} participant{approvedParticipants.length === 1 ? '' : 's'} available
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">
                <Hash size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Subject *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Work Order Follow-up / Dispatch Note"
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                required
              />
            </div>

            {/* Related ticket */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Related Job Ticket <span style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</span></label>
              <select
                className="form-select"
                value={newControlNo}
                onChange={e => setNewControlNo(e.target.value)}
              >
                <option value="">— General Inquiry (No Specific Ticket) —</option>
                {requisitions.map(r => (
                  <option key={r.id} value={r.controlNo}>
                    {r.controlNo} — {r.title} ({r.location})
                  </option>
                ))}
              </select>
            </div>

            {/* Message body */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Message *</label>
              <textarea
                className="form-textarea"
                rows="4"
                placeholder="Write your dispatch instruction, question, or follow-up note..."
                value={newInitialMsg}
                onChange={e => setNewInitialMsg(e.target.value)}
                required
                style={{ resize: 'vertical', minHeight: '90px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsComposeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={14} /> Send Message
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
