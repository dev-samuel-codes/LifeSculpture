// SettingsMenu 컴포넌트: 설정 화면의 내비게이션 메뉴
import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiLayout, FiEdit3, FiUsers } from 'react-icons/fi';
import '../../style/components/settings/SettingsMenu.css';

function SettingsMenu() {
  return (
    <aside className="settings-menu-container">
      <nav className="settings-menu" aria-label="Settings navigation">
        <NavLink to="/settings" end className="settings-menu-item">
          <FiLayout aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/settings/writing" className="settings-menu-item">
          <FiEdit3 aria-hidden="true" />
          <span>Writing</span>
        </NavLink>
        <NavLink to="/settings/users" className="settings-menu-item">
          <FiUsers aria-hidden="true" />
          <span>Users</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export default SettingsMenu;
