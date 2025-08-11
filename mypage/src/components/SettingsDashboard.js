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
  const [allPostsData, setAllPostsData] = useState([]); // New state to store all posts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAndProcessData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedAllPosts = [];

        // Fetch Study posts
        const studyQuery = query(collection(db, "study"), orderBy("createdAt", "asc"));
        const studySnapshot = await getDocs(studyQuery);
        studySnapshot.forEach(doc => {
          fetchedAllPosts.push({ category: 'study', id: doc.id, ...doc.data() });
        });

        // Fetch Blog posts
        const blogQuery = query(collection(db, "blog"), orderBy("createdAt", "asc"));
        const blogSnapshot = await getDocs(blogQuery);
        blogSnapshot.forEach(doc => {
          fetchedAllPosts.push({ category: 'blog', id: doc.id, ...doc.data() });
        });

        setAllPostsData(fetchedAllPosts); // Store all posts in state

        const stats = {};

        fetchedAllPosts.forEach(post => {
          const date = new Date(post.createdAt.toDate()).toLocaleDateString();
          if (!stats[date]) {
            stats[date] = { posts: 0, views: 0 };
          }
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
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  const viewsData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Total Views',
        data: sortedDates.map(date => dailyStats[date].views),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  };

  // Simulated data for Site Visitors
  const siteVisitorsData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Site Visitors',
        data: sortedDates.map(date => Math.floor(Math.random() * 50) + 10), // Random data for demonstration
        borderColor: 'rgb(53, 162, 235)',
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Chart.js Line Chart',
      },
    },
  };

  // Calculate Top 5 Most Viewed Posts
  const top5Posts = [...allPostsData]
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 5);

  if (loading) {
    return (
      <div className="container mt-4 h-100">
        <h2>Settings</h2>
        <div className="row settings-row d-flex h-100">
          <SettingsMenu />
          <div className="col-md-9 h-100 flex-grow-1">
            <h3>Dashboard</h3>
            <p>Loading dashboard data...</p>
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
            <h3>Dashboard</h3>
            <p className="text-danger">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 h-100">
      <div className="row settings-row d-flex h-100">
        <SettingsMenu />
        <div className="col-md-9 h-100 flex-grow-1 settings-dashboard-container">
          <h3>Dashboard</h3>
          {Object.keys(dailyStats).length === 0 && allPostsData.length === 0 ? (
            <p>No data available to display charts or top posts.</p>
          ) : (
            <div className="row">
              <div className="col-md-6 mb-4 chart-container">
                <h4>게시물 수</h4>
                <Line options={{...chartOptions, plugins: {...chartOptions.plugins, title: {display: true, text: 'Posts Created by Date'}}}} data={postsData} />
              </div>
              <div className="col-md-6 mb-4 chart-container">
                <h4>조회수</h4>
                <Line options={{...chartOptions, plugins: {...chartOptions.plugins, title: {display: true, text: 'Total Views by Date'}}}} data={viewsData} />
              </div>
              <div className="col-md-6 mb-4 chart-container">
                <h4>방문자 수</h4>
                <Line options={{...chartOptions, plugins: {...chartOptions.plugins, title: {display: true, text: 'Site Visitors by Date (Simulated)'}}}} data={siteVisitorsData} />
              </div>
              <div className="col-md-6 mb-4 top-posts-container">
                <h4>가장 많이 본 게시물</h4>
                {top5Posts.length === 0 ? (
                  <p>No posts with view data available.</p>
                ) : (
                  <ul className="list-group top-posts-list">
                    {top5Posts.map(post => (
                      <li key={post.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>{post.title}</span>
                        <span className="badge bg-primary rounded-pill">Views: {post.viewCount || 0}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsDashboard;
