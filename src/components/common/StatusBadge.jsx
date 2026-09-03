import React from 'react';

export const StatusBadge = ({ status }) => {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '-');
  
  const getBadgeClass = () => {
    switch (normalized) {
      case 'pending':
        return 'status-pending';
      case 'approved':
        return 'status-approved';
      case 'in-progress':
      case 'ongoing':
        return 'status-progress';
      case 'completed':
      case 'resolved':
        return 'status-completed';
      case 'rejected':
      case 'cancelled':
        return 'status-rejected';
      default:
        return 'status-pending';
    }
  };

  return (
    <span className={`badge ${getBadgeClass()}`}>
      <span className="badge-dot"></span>
      {status || 'Pending'}
    </span>
  );
};

export const UrgencyBadge = ({ urgency }) => {
  const normalized = (urgency || '').toLowerCase();
  
  const getBadgeClass = () => {
    switch (normalized) {
      case 'emergency':
        return 'urgency-emergency';
      case 'high':
        return 'urgency-high';
      case 'medium':
        return 'urgency-medium';
      case 'low':
        return 'urgency-low';
      default:
        return 'urgency-medium';
    }
  };

  return (
    <span className={`badge ${getBadgeClass()}`}>
      {urgency || 'Normal'}
    </span>
  );
};

export const CategoryPill = ({ category }) => {
  return (
    <span className="category-pill">
      {category || 'General'}
    </span>
  );
};
