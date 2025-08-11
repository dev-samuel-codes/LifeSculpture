import React from 'react';
import { NavLink } from 'react-router-dom';
import '../style/SettingsMenu.css';

function SettingsMenu() {
  return (
    <div className="col-md-3 settings-menu-container h-100">
      <div className="list-group settings-menu">
        <NavLink to="/settings" end className="list-group-item list-group-item-action">Dashboard</NavLink>
        <NavLink to="/settings/writing" className="list-group-item list-group-item-action">Writing</NavLink>
        <NavLink to="/settings/users" className="list-group-item list-group-item-action">Users</NavLink>
      </div>
    </div>
  );
}

export default SettingsMenu;