// SettingsDashboard 컴포넌트: 설정 대시보드의 통계와 요약 정보를 표시
import React, { useState, useEffect } from 'react';
import SettingsMenu from './SettingsMenu';
import { db } from '../../firebase/firebase';
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
import { formatDate } from '../../utils/date';
import '../../style/components/settings/SettingsDashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CATEGORY_KEYWORDS = {
  study: {
    '개발 · IT': ['개발', 'it', 'react', 'node', 'firebase'],
    '과학': ['과학', 'physics', 'chemistry', 'biology'],
    '수학': ['수학', 'math', 'algebra', 'calculus'],
    '인문 · 사회': ['인문', '사회', 'history', 'philosophy'],
  },
  blog: {
    '에세이 · 일상': ['일상', '생각', '회고', '일기'],
    '여행': ['여행', 'travel'],
    '사진 · 영상': ['사진', '포토', '촬영', '영상'],
    '튜토리얼 · 팁': ['팁', '가이드', '튜토리얼', '노하우'],
    '리뷰': ['리뷰', '사용기', '언박싱'],
    '개발 블로그': ['개발', 'react', 'next', 'node'],
  },
};

const CATEGORY_NAMES = Array.from(
  new Set(Object.values(CATEGORY_KEYWORDS).flatMap((sections) => Object.keys(sections))),
);

const createEmptyCategoryStats = () => {
  const stats = {};
  CATEGORY_NAMES.forEach((name) => {
    stats[name] = { views: 0, posts: 0 };
  });
  return stats;
};

const normalizeText = (value) => (value || '').toLowerCase();

const getCombinedPostText = (post) =>
  [post.title, post.content, post.body, post.text].map(normalizeText).join(' ');

const findCategoryByKeywords = (category, text) => {
  const sections = CATEGORY_KEYWORDS[category];
  if (!sections || !text) return null;
  return (
    Object.entries(sections).find(([, keywords]) =>
      keywords.some((keyword) => text.includes(keyword)),
    )?.[0] || null
  );
};

const chartConfigs = [
  {
    key: 'posts',
    title: '게시물 수',
    datasetLabel: 'Posts Created',
    borderColor: '#4bc0c0',
    backgroundColor: 'rgba(75, 192, 192, 0.2)',
    accessor: (stats = {}) => stats.posts || 0,
  },
  {
    key: 'views',
    title: '총 조회수',
    datasetLabel: 'Total Views',
    borderColor: '#ff6384',
    backgroundColor: 'rgba(255, 99, 132, 0.2)',
    accessor: (stats = {}) => stats.views || 0,
  },
  {
    key: 'visitors',
    title: '방문자 수',
    datasetLabel: '추정 방문자 수',
    borderColor: '#36a2eb',
    backgroundColor: 'rgba(53, 162, 235, 0.2)',
    accessor: (stats = {}) => Math.max(stats.views || 0, 1),
  },
];

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

        const studyQuery = query(collection(db, 'study'), orderBy('createdAt', 'asc'));
        const blogQuery = query(collection(db, 'blog'), orderBy('createdAt', 'asc'));

        const [studySnapshot, blogSnapshot] = await Promise.all([
          getDocs(studyQuery),
          getDocs(blogQuery),
        ]);

        studySnapshot.forEach((docSnap) => {
          fetchedAllPosts.push({ category: 'study', id: docSnap.id, ...docSnap.data() });
        });

        blogSnapshot.forEach((docSnap) => {
          fetchedAllPosts.push({ category: 'blog', id: docSnap.id, ...docSnap.data() });
        });

        setAllPostsData(fetchedAllPosts);

        const stats = {};
        fetchedAllPosts.forEach(post => {
          const date = formatDate(post.createdAt);
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
  const chartCards = chartConfigs.map(
    ({ key, title, datasetLabel, borderColor, backgroundColor, accessor }) => ({
      key,
      title,
      data: {
        labels: sortedDates,
        datasets: [
          {
            label: datasetLabel,
            data: sortedDates.map((date) => accessor(dailyStats[date] || {})),
            borderColor,
            backgroundColor,
          },
        ],
      },
    }),
  );

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
        position: 'top',
      },
    },
  };

  // 분야별 조회수 통계 계산
  const getCategoryStats = () => {
    const categoryStats = createEmptyCategoryStats();
    allPostsData.forEach((post) => {
      const text = getCombinedPostText(post);
      const matchedCategory = findCategoryByKeywords(post.category, text);
      if (!matchedCategory) return;
      categoryStats[matchedCategory].views += post.viewCount || 0;
      categoryStats[matchedCategory].posts += 1;
    });
    return categoryStats;
  };

  const categoryStats = getCategoryStats();
  const topCategories = Object.entries(categoryStats)
    .filter(([_, stats]) => stats.views > 0) // 조회수가 있는 분야만
    .sort(([_, a], [__, b]) => b.views - a.views)
    .slice(0, 3);

  const Content = () => (
    <main className="settings-card settings-dashboard-main">
      <header className="dashboard-header">
        <h3>Dashboard</h3>
      </header>

      {Object.keys(dailyStats).length === 0 && allPostsData.length === 0 ? (
        <p>No data available.</p>
      ) : (
        <div className="dashboard-grid">
          {chartCards.map(({ key, title, data }) => (
            <div key={key} className="settings-surface settings-surface-strong chart-container">
              <h4>{title}</h4>
              <Line options={chartOptions} data={data} />
            </div>
          ))}
          <div className="settings-surface settings-surface-strong top-posts-container">
            <h4>가장 많이 본 분야</h4>
            {topCategories.length === 0 ? (
              <p>No category data available.</p>
            ) : (
              <ul className="top-posts-list">
                {topCategories.map(([category, stats]) => (
                  <li key={category} className="list-group-item d-flex justify-content-between align-items-center">
                    <span>{category}</span>
                    <div className="d-flex flex-column align-items-end">
                      <span className="badge bg-primary mb-1">Views: {stats.views}</span>
                      <small className="text-muted">Posts: {stats.posts}</small>
                    </div>
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
          <main className="settings-card settings-dashboard-main">
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
