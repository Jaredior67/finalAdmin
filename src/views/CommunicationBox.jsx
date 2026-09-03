import React, { useState } from 'react';
import { MessageSquare, Send, Paperclip, CheckCircle2, User, Search } from 'lucide-react';
import { useData } from '../context/DataContext';

export const CommunicationBox = () => {
  const { messages, sendMessage } = useData();
  const [activeThreadId, setActiveThreadId] = useState(messages[0]?.id || 'msg_001');
  const [replyText, setReplyText] = useState('');
  const [searchMsg, setSearchMsg] = useState('');

  const activeThread = messages.find(m => m.id === activeThreadId) || messages[0];

  const handleSend = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    sendMessage(activeThreadId, replyText, 'PDAS Director');
    setReplyText('');
  };

  const filteredMessages = messages.filter(m =>
    m.sender.toLowerCase().includes(searchMsg.toLowerCase()) ||
    m.subject.toLowerCase().includes(searchMsg.toLowerCase()) ||
    m.controlNo.toLowerCase().includes(searchMsg.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">PDAS Communication & Dispatch Center</h1>
          <p className="page-subtitle">Direct communication channel with requisitioners, department heads, and technicians</p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: '24px',
        minHeight: '620px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)'
      }}>
        {/* Thread List Sidebar */}
        <div style={{ borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
            <div className="search-input-wrapper">
              <Search size={15} className="search-input-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search conversations..."
                value={searchMsg}
                onChange={(e) => setSearchMsg(e.target.value)}
                style={{ padding: '7px 12px 7px 34px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredMessages.map(thread => {
              const isSelected = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  onClick={() => setActiveThreadId(thread.id)}
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : thread.unread ? '#f8fafc' : '#ffffff',
                    borderLeft: isSelected ? '4px solid #001f9c' : '4px solid transparent',
                    transition: 'background 0.12s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                      {thread.sender}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{thread.time}</span>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#001f9c', marginBottom: '4px' }}>
                    {thread.controlNo}: {thread.subject}
                  </div>

                  <p style={{
                    fontSize: '12px',
                    color: '#64748b',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {thread.preview}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Detail & Conversation Area */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {activeThread ? (
            <>
              {/* Thread Header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                    {activeThread.subject}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                    Reference: <strong style={{ color: '#001f9c' }}>{activeThread.controlNo}</strong> • With {activeThread.sender} ({activeThread.role})
                  </div>
                </div>
              </div>

              {/* Messages Body */}
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeThread.thread.map((item, idx) => {
                  const isMe = item.sender.includes('Director');
                  return (
                    <div
                      key={idx}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '75%'
                      }}
                    >
                      <div style={{
                        fontSize: '11px',
                        color: '#64748b',
                        marginBottom: '4px',
                        textAlign: isMe ? 'right' : 'left'
                      }}>
                        {item.sender} • {item.time}
                      </div>

                      <div style={{
                        padding: '12px 16px',
                        borderRadius: '14px',
                        background: isMe ? '#001f9c' : '#f1f5f9',
                        color: isMe ? '#ffffff' : '#0f172a',
                        fontSize: '13.5px',
                        lineHeight: 1.5,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        {item.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input Bar */}
              <form onSubmit={handleSend} style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Type an official dispatch instruction or reply as PDAS Director..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  <Send size={15} />
                  Send
                </button>
              </form>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              Select a thread to view message history
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
