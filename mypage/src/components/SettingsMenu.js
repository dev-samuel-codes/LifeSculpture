import React from 'react';
import { Link } from 'react-router-dom';
import './Settings.css'; // Assuming Settings.css contains styles for settings-menu

function SettingsMenu() {
  return (
    <div className="col-md-3 settings-menu-container h-100">
      <div className="list-group settings-menu">
        <Link to="/settings" className="list-group-item list-group-item-action">Dashboard</Link>
        <Link to="/settings/writing" className="list-group-item list-group-item-action">Writing</Link>
        <Link to="/settings/users" className="list-group-item list-group-item-action">Users</Link>
      </div>
    </div>
  );
}

export default SettingsMenu;
