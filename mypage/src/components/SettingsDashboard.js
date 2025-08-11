import React from 'react';
import SettingsMenu from './SettingsMenu';

function SettingsDashboard() {
  return (
    <div className="container mt-4 h-100">
      <h2>Settings</h2>
      <div className="row settings-row d-flex h-100">
        <SettingsMenu />
        <div className="col-md-9 h-100 flex-grow-1">
          <h3>Settings Dashboard</h3>
          <p>This is the dashboard for settings.</p>
        </div>
      </div>
    </div>
  );
}

export default SettingsDashboard;
