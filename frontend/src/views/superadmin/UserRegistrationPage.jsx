import React from 'react';
import { UserRegistrationForm } from '../../components/users/UserRegistrationForm';

/**
 * Standalone registration page.
 *
 * Registration is normally opened from the Personnel Directory. This wrapper
 * keeps the old page route usable for deep links while sharing the same form
 * and validation as the directory modal.
 */
export function UserRegistrationPage({ onNavigate }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <UserRegistrationForm variant="page" onNavigate={onNavigate} />
    </div>
  );
}
