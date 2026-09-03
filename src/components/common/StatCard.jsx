import React from 'react';
import { Inbox, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';

export const StatCard = ({ type, title, value, onClick }) => {
  const getCardDetails = () => {
    switch (type) {
      case 'total':
        return {
          icon: <Inbox size={24} strokeWidth={2.2} />,
          colorClass: 'blue',
          defaultTitle: 'TOTAL REQUEST',
        };
      case 'pending':
        return {
          icon: <Clock size={24} strokeWidth={2.2} />,
          colorClass: 'amber',
          defaultTitle: 'PENDING APPROVAL',
        };
      case 'ongoing':
        return {
          icon: <TrendingUp size={24} strokeWidth={2.2} />,
          colorClass: 'sky',
          defaultTitle: 'ONGOING WORK ORDERS',
        };
      case 'completed':
        return {
          icon: <CheckCircle2 size={24} strokeWidth={2.2} />,
          colorClass: 'emerald',
          defaultTitle: 'COMPLETED REPAIRS',
        };
      default:
        return {
          icon: <Inbox size={24} strokeWidth={2.2} />,
          colorClass: 'blue',
          defaultTitle: title,
        };
    }
  };

  const details = getCardDetails();

  return (
    <div className="kpi-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className={`kpi-icon-box ${details.colorClass}`}>
        {details.icon}
      </div>
      <div className="kpi-text-info">
        <span className="kpi-label">{title || details.defaultTitle}</span>
        <span className="kpi-value">{value !== undefined ? value : 0}</span>
      </div>
    </div>
  );
};
