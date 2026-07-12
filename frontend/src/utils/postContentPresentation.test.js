import {
  buildContentWithToc,
  enhanceCodeBlocks,
} from './postContentPresentation';

test('builds stable unique heading ids for the table of contents', () => {
  // Given: duplicate Korean headings and one empty heading.
  const content = '<h2>보안 점검</h2><h2>보안 점검</h2><h3></h3>';

  // When: detail content is prepared for rendering.
  const result = buildContentWithToc(content);

  // Then: visible headings receive deterministic unique ids.
  expect(result.toc).toEqual([
    { id: '보안-점검', text: '보안 점검', level: 2 },
    { id: '보안-점검-1', text: '보안 점검', level: 2 },
  ]);
  expect(result.html).toContain('<h2 id="보안-점검">보안 점검</h2>');
  expect(result.html).toContain('<h2 id="보안-점검-1">보안 점검</h2>');
});

test('enhances code blocks once while preserving empty lines', () => {
  // Given: a Quill code container with an empty middle line.
  const content = [
    '<div class="ql-code-block-container">',
    '<pre>first\n\nthird\n</pre>',
    '</div>',
  ].join('');

  // When: the same content is enhanced twice.
  const once = enhanceCodeBlocks(content);
  const twice = enhanceCodeBlocks(once);

  // Then: one header remains and every meaningful line has a number.
  const wrapper = document.createElement('div');
  wrapper.innerHTML = twice;
  expect(wrapper.querySelectorAll('.code-block-header')).toHaveLength(1);
  expect(wrapper.querySelectorAll('pre code > span')).toHaveLength(3);
  expect(wrapper.querySelector('pre code > span:nth-child(2)').textContent).toBe('\u00A0');
});

test('returns empty presentation for empty content', () => {
  // Given: no post body content.

  // When: the content presentation is built.
  const result = buildContentWithToc('');

  // Then: no rendered HTML or table-of-contents items are produced.
  expect(result).toEqual({ html: '', toc: [] });
});
