import React from 'react';
import { JobRequestPrintSheet } from './JobRequestPrintSheet';

// Canonical QF-PDAS-DC-01 Form Document component.
// Re-exports JobRequestPrintSheet for complete visual and functional consistency across all views.
export const PDASJobRequestFormDocument = ({ req, customConfig = null }) => {
  return <JobRequestPrintSheet req={req} customConfig={customConfig} />;
};
