import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

const SettingsDashboard = lazy(() => import('../components/settings/SettingsDashboard'));
const SettingsWriting = lazy(() => import('../components/settings/SettingsWriting'));
const SettingsUsers = lazy(() => import('../components/settings/SettingsUsers'));

function SettingsPage() {
  return (
    <Suspense fallback={<div className="route-loading">설정 페이지를 불러오는 중...</div>}>
      <Routes>
        <Route path="/" element={<SettingsDashboard />} />
        <Route path="writing" element={<SettingsWriting />} />
        <Route path="users" element={<SettingsUsers />} />
      </Routes>
    </Suspense>
  );
}

export default SettingsPage;
