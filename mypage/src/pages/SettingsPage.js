import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SettingsDashboard, SettingsWriting, SettingsUsers } from '../components';

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
