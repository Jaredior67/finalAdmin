import React from 'react';
import { FacultyStaffPortal } from '../FacultyStaffPortal';

export const SubmitJobRequest = (props) => (
  <FacultyStaffPortal 
    {...props} 
    activeTab={props.activeTab === 'faculty-urgent' ? 'faculty-submit' : props.activeTab || 'faculty-submit'} 
    initialRequestType="Standard Request"
  />
);
