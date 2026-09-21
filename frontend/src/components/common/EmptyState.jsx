import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No items found',
  description = 'There are no records matching your current filter criteria.',
  action = null
}) => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      background: '#ffffff',
      borderRadius: '12px',
      border: '1px dashed #cbd5e1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: '#f1f5f9',
        color: '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '14px'
      }}>
        <Icon size={26} />
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
        {title}
      </h3>

      <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '380px', margin: '0 0 18px 0', lineHeight: '1.5' }}>
        {description}
      </p>

      {action}
    </div>
  );
};
