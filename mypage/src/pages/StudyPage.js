import React from 'react';
import PostCollectionPage from './PostCollectionPage';

const TAG_SECTIONS = [
  {
    title: '개발 · IT',
    tags: [
      'Flutter',
      'React',
      'Angular',
      'Node.js',
      'Django',
      'Spring',
      'Supabase',
      'Firebase',
      'MySQL',
      'MongoDB',
      'Git',
    ],
  },
  { title: '과학', tags: ['물리학', '화학', '생물학', '지구과학', '천문학'] },
  { title: '수학', tags: ['기초수학', '대수학', '기하학', '미적분', '확률과 통계', '논리'] },
  { title: '인문 · 사회', tags: ['역사', '철학', '심리학', '사회학', '정치', '경제'] },
  { title: '프로젝트', tags: ['일기 앱'] },
];

function StudyPage() {
  return <PostCollectionPage collectionName="study" sections={TAG_SECTIONS} />;
}

export default StudyPage;
