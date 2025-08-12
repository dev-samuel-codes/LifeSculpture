import React, { useState, useEffect } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import '../style/SettingsDashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function SettingsDashboard() {
  const [dailyStats, setDailyStats] = useState({});
  const [allPostsData, setAllPostsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndProcessData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedAllPosts = [];

        const studyQuery = query(collection(db, "study"), orderBy("createdAt", "asc"));
        const studySnapshot = await getDocs(studyQuery);
        studySnapshot.forEach(doc => {
          fetchedAllPosts.push({ category: 'study', id: doc.id, ...doc.data() });
        });

        const blogQuery = query(collection(db, "blog"), orderBy("createdAt", "asc"));
        const blogSnapshot = await getDocs(blogQuery);
        blogSnapshot.forEach(doc => {
          fetchedAllPosts.push({ category: 'blog', id: doc.id, ...doc.data() });
        });

        setAllPostsData(fetchedAllPosts);

        const stats = {};
        fetchedAllPosts.forEach(post => {
          const date = new Date(post.createdAt.toDate()).toLocaleDateString();
          if (!stats[date]) stats[date] = { posts: 0, views: 0 };
          stats[date].posts += 1;
          stats[date].views += post.viewCount || 0;
        });

        setDailyStats(stats);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, []);

  const sortedDates = Object.keys(dailyStats).sort();
  const postsData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Posts Created',
        data: sortedDates.map(date => dailyStats[date].posts),
        borderColor: '#4bc0c0',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
    ],
  };

  const viewsData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Total Views',
        data: sortedDates.map(date => dailyStats[date].views),
        borderColor: '#ff6384',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      },
    ],
  };

  const siteVisitorsData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Site Visitors',
        data: sortedDates.map(() => Math.floor(Math.random() * 50) + 10),
        borderColor: '#36a2eb',
        backgroundColor: 'rgba(53, 162, 235, 0.2)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' } },
  };

  const top5Posts = [...allPostsData]
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 5);

  const Content = () => (
    <main className="settings-dashboard-main">
      <header className="dashboard-header">
        <h3>Dashboard</h3>
      </header>

      {Object.keys(dailyStats).length === 0 && allPostsData.length === 0 ? (
        <p>No data available.</p>
      ) : (
        <div className="dashboard-grid">
          <div className="chart-container">
            <h4>Posts Created by Date</h4>
            <Line options={chartOptions} data={postsData} />
          </div>
          <div className="chart-container">
            <h4>Total Views by Date</h4>
            <Line options={chartOptions} data={viewsData} />
          </div>
          <div className="chart-container">
            <h4>Site Visitors by Date</h4>
            <Line options={chartOptions} data={siteVisitorsData} />
          </div>
          <div className="top-posts-container">
            <h4>Top 5 Most Viewed Posts</h4>
            {top5Posts.length === 0 ? (
              <p>No posts available.</p>
            ) : (
              <ul className="top-posts-list">
                {top5Posts.map(post => (
                  <li key={post.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <span>{post.title}</span>
                    <span className="badge bg-primary">Views: {post.viewCount || 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );

  if (loading || error) {
    return (
      <div className="container mt-4 h-100">
        <div className="settings-layout">
          <SettingsMenu />
          <main className="settings-dashboard-main">
            <h3>Dashboard</h3>
            <div className={error ? 'text-danger' : ''}>
              {error ? error : 'Loading dashboard data...'}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 h-100">
      <div className="settings-layout">
        <SettingsMenu />
        <Content />
      </div>
    </div>
  );
}

export default SettingsDashboard;
