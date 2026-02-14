import { extractHashtagsFromContent } from './utils/tags';

test('본문에서 해시태그를 중복 없이 추출한다', () => {
  const content = '<p>#React 와 #Firebase 를 함께 사용하고 #React 를 다시 언급합니다.</p>';
  expect(extractHashtagsFromContent(content)).toEqual(['React', 'Firebase']);
});
