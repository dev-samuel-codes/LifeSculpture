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

// Study.js와 Blog.js의 상위 필터 정의
const STUDY_SECTIONS = [
  '개발 · IT', '과학', '수학', '인문 · 사회'
];

const BLOG_SECTIONS = [
  '에세이 · 일상', '여행', '사진 · 영상', '튜토리얼 · 팁', '리뷰', '개발 블로그'
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
    plugins: { legend: {
      display: false,
       position: 'top' 
      } 
    },
  };

  // 분야별 조회수 통계 계산
  const getCategoryStats = () => {
    const categoryStats = {};
    
    // Study 카테고리 분야별 통계
    STUDY_SECTIONS.forEach(section => {
      categoryStats[section] = { views: 0, posts: 0 };
    });
    
    // Blog 카테고리 분야별 통계
    BLOG_SECTIONS.forEach(section => {
      categoryStats[section] = { views: 0, posts: 0 };
    });

    allPostsData.forEach(post => {
      // Study 게시물의 경우 제목과 내용을 기반으로 분야 분류
      if (post.category === 'study') {
        const title = (post.title || '').toLowerCase();
        const content = (post.content || post.body || post.text || '').toLowerCase();
        
        if (title.includes('개발') || title.includes('it') || title.includes('react') || title.includes('node') || title.includes('firebase') || content.includes('개발') || content.includes('it')) {
          categoryStats['개발 · IT'].views += post.viewCount || 0;
          categoryStats['개발 · IT'].posts += 1;
        } else if (title.includes('과학') || title.includes('physics') || title.includes('chemistry') || title.includes('biology') || content.includes('과학')) {
          categoryStats['과학'].views += post.viewCount || 0;
          categoryStats['과학'].posts += 1;
        } else if (title.includes('수학') || title.includes('math') || title.includes('algebra') || title.includes('calculus') || content.includes('수학')) {
          categoryStats['수학'].views += post.viewCount || 0;
          categoryStats['수학'].posts += 1;
        } else if (title.includes('인문') || title.includes('사회') || title.includes('history') || title.includes('philosophy') || content.includes('인문') || content.includes('사회')) {
          categoryStats['인문 · 사회'].views += post.viewCount || 0;
          categoryStats['인문 · 사회'].posts += 1;
        }
      }
      
      // Blog 게시물의 경우 제목과 내용을 기반으로 분야 분류
      if (post.category === 'blog') {
        const title = (post.title || '').toLowerCase();
        const content = (post.content || post.body || post.text || '').toLowerCase();
        
        if (title.includes('일상') || title.includes('생각') || title.includes('회고') || title.includes('일기') || content.includes('일상') || content.includes('생각')) {
          categoryStats['에세이 · 일상'].views += post.viewCount || 0;
          categoryStats['에세이 · 일상'].posts += 1;
        } else if (title.includes('여행') || title.includes('travel') || content.includes('여행')) {
          categoryStats['여행'].views += post.viewCount || 0;
          categoryStats['여행'].posts += 1;
        } else if (title.includes('사진') || title.includes('포토') || title.includes('촬영') || title.includes('영상') || content.includes('사진') || content.includes('포토')) {
          categoryStats['사진 · 영상'].views += post.viewCount || 0;
          categoryStats['사진 · 영상'].posts += 1;
        } else if (title.includes('팁') || title.includes('가이드') || title.includes('튜토리얼') || title.includes('노하우') || content.includes('팁') || content.includes('가이드')) {
          categoryStats['튜토리얼 · 팁'].views += post.viewCount || 0;
          categoryStats['튜토리얼 · 팁'].posts += 1;
        } else if (title.includes('리뷰') || title.includes('사용기') || title.includes('언박싱') || content.includes('리뷰')) {
          categoryStats['리뷰'].views += post.viewCount || 0;
          categoryStats['리뷰'].posts += 1;
        } else if (title.includes('개발') || title.includes('react') || title.includes('next') || title.includes('node') || content.includes('개발')) {
          categoryStats['개발 블로그'].views += post.viewCount || 0;
          categoryStats['개발 블로그'].posts += 1;
        }
      }
    });

    return categoryStats;
  };

  const categoryStats = getCategoryStats();
  const topCategories = Object.entries(categoryStats)
    .filter(([_, stats]) => stats.views > 0) // 조회수가 있는 분야만
    .sort(([_, a], [__, b]) => b.views - a.views)
    .slice(0, 3);

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
            <h4>게시물 수</h4>
            <Line options={chartOptions} data={postsData} />
          </div>
          <div className="chart-container">
            <h4>총 조회수</h4>
            <Line options={chartOptions} data={viewsData} />
          </div>
          <div className="chart-container">
            <h4>방문자 수</h4>
            <Line options={chartOptions} data={siteVisitorsData} />
          </div>
          <div className="top-posts-container">
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
