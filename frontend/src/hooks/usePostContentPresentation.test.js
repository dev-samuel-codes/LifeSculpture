import { act, renderHook, waitFor } from '@testing-library/react';
import { setupResponsiveImageSizing } from '../components/text-editor/utils/imageSizing';
import { applyContentTableSettingsToRoot } from '../components/text-editor/utils/contentTableSettings';
import { usePostContentPresentation } from './usePostContentPresentation';

jest.mock('../components/text-editor/utils/imageSizing', () => ({
  setupResponsiveImageSizing: jest.fn(),
}));

jest.mock('../components/text-editor/utils/contentTableSettings', () => ({
  applyContentTableSettingsToRoot: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  document.body.innerHTML = '<section class="post-content"><pre>code</pre></section>';
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  document.body.innerHTML = '';
});

test('prepares rendered content and preserves presentation effects', async () => {
  // Given: post content with a heading, code block, and table settings.
  const cleanupImages = jest.fn();
  setupResponsiveImageSizing.mockReturnValue(cleanupImages);
  const post = {
    content: '<h2>제목</h2><p>본문</p>',
    contentTableSettings: { width: 600 },
  };

  // When: the post content presentation hook is mounted.
  const { result, unmount } = renderHook(() => usePostContentPresentation(post));
  await waitFor(() => expect(result.current.tocItems).toHaveLength(1));
  act(() => {
    jest.advanceTimersByTime(100);
    window.dispatchEvent(new Event('resize'));
  });

  // Then: content, TOC, responsive images, and table settings remain active.
  expect(result.current.renderedContent).toContain('id="제목"');
  expect(setupResponsiveImageSizing).toHaveBeenCalledTimes(2);
  expect(applyContentTableSettingsToRoot).toHaveBeenCalledTimes(3);
  expect(document.querySelector('.post-content pre').style.whiteSpace).toBe('pre');
  unmount();
  expect(cleanupImages).toHaveBeenCalledTimes(2);
});

test('clears rendered content when the post body becomes empty', async () => {
  // Given: a post with content that is later removed.
  setupResponsiveImageSizing.mockReturnValue(jest.fn());
  const { result, rerender } = renderHook(
    ({ post }) => usePostContentPresentation(post),
    { initialProps: { post: { content: '<h2>제목</h2>' } } },
  );
  await waitFor(() => expect(result.current.tocItems).toHaveLength(1));

  // When: the post body becomes empty.
  rerender({ post: { content: '' } });

  // Then: rendered HTML and TOC state are both cleared.
  await waitFor(() => expect(result.current.tocItems).toEqual([]));
  expect(result.current.renderedContent).toBe('');
});
