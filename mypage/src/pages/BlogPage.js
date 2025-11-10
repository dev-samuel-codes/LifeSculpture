import React from 'react';
import PostCollectionPage from './PostCollectionPage';

const BLOG_SECTIONS = [
  { title: '에세이 · 일상', tags: ['일상', '생각', '회고', '일기'] },
  { title: '여행', tags: ['여행', '국내여행', '해외여행', '일정', '후기'] },
  { title: '사진', tags: ['사진', '포토', '촬영', '카메라'] },
  { title: '튜토리얼 · 팁', tags: ['팁', '가이드', '튜토리얼', '노하우', '설정'] },
  { title: '리뷰', tags: ['리뷰', '사용기', '언박싱'] },
  { title: '개발 블로그', tags: ['개발', 'React', 'Next.js', 'Node', 'Firebase'] },
];

function BlogPage() {
  return <PostCollectionPage collectionName="blog" sections={BLOG_SECTIONS} />;
}

export default BlogPage;
