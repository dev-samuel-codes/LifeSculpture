export const POST_COLLECTION_CONFIGS = {
  study: {
    collectionName: 'study',
    emptyMessage: '학습 게시물이 아직 없습니다.',
    sections: [
      {
        title: '개발 · IT',
        tags: ['Flutter', 'React', 'Angular', 'Node.js', 'Django', 'Spring', 'Supabase', 'Firebase', 'MySQL', 'MongoDB', 'Git'],
      },
      { title: '과학', tags: ['물리학', '화학', '생물학', '지구과학', '천문학'] },
      { title: '수학', tags: ['기초수학', '대수학', '기하학', '미적분', '확률과 통계', '논리'] },
      { title: '인문 · 사회', tags: ['역사', '철학', '심리학', '사회학', '정치', '경제'] },
      { title: '프로젝트', tags: ['일기 앱'] },
    ],
  },
  blog: {
    collectionName: 'blog',
    emptyMessage: '블로그 게시물이 아직 없습니다.',
    sections: [
      { title: '에세이 · 일상', tags: ['일상', '생각', '회고', '일기'] },
      { title: '여행', tags: ['여행', '국내여행', '해외여행', '일정', '후기'] },
      { title: '사진', tags: ['사진', '포토', '촬영', '카메라'] },
      { title: '튜토리얼 · 팁', tags: ['팁', '가이드', '튜토리얼', '노하우', '설정'] },
      { title: '리뷰', tags: ['리뷰', '사용기', '언박싱'] },
      { title: '개발 블로그', tags: ['개발', 'React', 'Next.js', 'Node', 'Firebase'] },
    ],
  },
};
