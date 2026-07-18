import { render, screen } from '@testing-library/react';
import FullPageLoading from './components/layout/FullPageLoading';
import { extractHashtagsFromContent } from './utils/tags';

test('본문에서 해시태그를 중복 없이 추출한다', () => {
  const content = '<p>#React 와 #Firebase 를 함께 사용하고 #React 를 다시 언급합니다.</p>';
  expect(extractHashtagsFromContent(content)).toEqual(['React', 'Firebase']);
});

test('전체 페이지 로딩 상태를 안내한다', () => {
  render(<FullPageLoading />);

  expect(screen.getByRole('status')).toHaveTextContent('페이지를 불러오는 중입니다');
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
});
