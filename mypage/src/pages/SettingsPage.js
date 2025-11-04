import React from 'react';
import { Routes, Route } from 'react-router-dom';
import SettingsDashboard from '../components/SettingsDashboard';
import SettingsWriting from '../components/SettingsWriting';
import SettingsUsers from '../components/SettingsUsers';

function SettingsPage() {
  return (
    <Routes>
      <Route path="/" element={<SettingsDashboard />} />
      <Route path="writing" element={<SettingsWriting />} />
      <Route path="users" element={<SettingsUsers />} />
    </Routes>
  );
}

export default SettingsPage;
