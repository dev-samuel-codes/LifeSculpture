import React, { useState, useEffect } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import '../style/SettingsUsers.css';

function SettingsUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, "users"), orderBy("email", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedUsers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(fetchedUsers);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return (
      <div className="container mt-4 h-100">
        <h2>Settings</h2>
        <div className="row settings-row d-flex h-100">
          <SettingsMenu />
          <div className="col-md-9 h-100 flex-grow-1">
            <h3>Users Management</h3>
            <p>Loading users...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4 h-100">
        <h2>Settings</h2>
        <div className="row settings-row d-flex h-100">
          <SettingsMenu />
          <div className="col-md-9 h-100 flex-grow-1">
            <h3>Users Management</h3>
            <p className="text-danger">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 h-100">
      <h2>Settings</h2>
      <div className="row settings-row d-flex h-100">
        <SettingsMenu />
        <div className="col-md-9 h-100 flex-grow-1 settings-users-container">
          <h3>Users Management</h3>
          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.name || 'N/A'}</td>
                    <td>{user.email}</td>
                    <td>{user.role || 'user'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsUsers;
