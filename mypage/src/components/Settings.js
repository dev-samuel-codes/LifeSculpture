import React from 'react';
import { Routes, Route } from 'react-router-dom';
import SettingsDashboard from './SettingsDashboard';
import SettingsWriting from './SettingsWriting';
import SettingsUsers from './SettingsUsers';

function Settings() {
  return (
    <Routes>
      <Route path="/" element={<SettingsDashboard />} />
      <Route path="writing" element={<SettingsWriting />} />
      <Route path="users" element={<SettingsUsers />} />
    </Routes>
  );
}

export default Settings;