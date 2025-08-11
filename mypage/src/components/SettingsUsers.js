import React from 'react';
import SettingsMenu from './SettingsMenu';

function SettingsUsers() {
  return (
    <div className="container mt-4 h-100">
      <h2>Settings</h2>
      <div className="row settings-row d-flex h-100">
        <SettingsMenu />
        <div className="col-md-9 h-100 flex-grow-1">
          <h3>Settings Users</h3>
          <p>This is where you can manage user accounts.</p>
        </div>
      </div>
    </div>
  );
}

export default SettingsUsers;
