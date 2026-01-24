// AdminDashboard.js
import React from 'react';
import '../style/components/layout/AdminDashboard.css';
import { FaUserShield, FaTools, FaChartLine } from 'react-icons/fa';

function AdminDashboardPage() {
  return (
    <div className="settings-dashboard-container">
      <h3>관리자 대시보드</h3>
      <p className="dashboard-subtitle">안녕하세요, 관리자님! 아래에서 주요 기능을 한눈에 확인하고 관리하세요.</p>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <FaUserShield className="dashboard-icon" aria-hidden="true" />
          <h4>사용자 관리</h4>
          <p>회원 목록, 권한 설정, 계정 상태 제어</p>
        </div>

        <div className="dashboard-card">
          <FaTools className="dashboard-icon" aria-hidden="true" />
          <h4>시스템 설정</h4>
          <p>사이트 환경, 보안, 알림 및 통합 관리</p>
        </div>

        <div className="dashboard-card">
          <FaChartLine className="dashboard-icon" aria-hidden="true" />
          <h4>통계 분석</h4>
          <p>트래픽, 게시물, 사용자 활동 지표 확인</p>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
