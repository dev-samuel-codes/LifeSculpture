import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import SettingsDashboard from './SettingsDashboard';
import SettingsWriting from './SettingsWriting';
import SettingsUsers from './SettingsUsers';

function Settings() {
  return (
    <div className="container mt-4">
      <h2>Settings</h2>
      <div className="row">
        <div className="col-md-3">
          <div className="list-group">
            <Link to="/settings" className="list-group-item list-group-item-action">Dashboard</Link>
            <Link to="/settings/writing" className="list-group-item list-group-item-action">Writing</Link>
            <Link to="/settings/users" className="list-group-item list-group-item-action">Users</Link>
          </div>
        </div>
        <div className="col-md-9">
          <Routes>
            <Route path="/" element={<SettingsDashboard />} />
            <Route path="writing" element={<SettingsWriting />} />
            <Route path="users" element={<SettingsUsers />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default Settings;
