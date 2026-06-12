import { sanitizeHtml } from './content';

describe('sanitizeHtml', () => {
  test('removes executable tags and event handlers', () => {
    const result = sanitizeHtml('<p>safe</p><script>alert(1)</script><img src="x" onerror="alert(2)">');

    expect(result).toContain('<p>safe</p>');
    expect(result).toContain('<img src="x">');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('onerror');
  });

  test('removes javascript URLs and SVG or math markup', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">bad</a><svg><circle /></svg><math></math>');

    expect(result).toContain('<a>bad</a>');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<svg');
    expect(result).not.toContain('<math');
  });

  test('keeps allowed video iframe embeds', () => {
    const result = sanitizeHtml('<iframe src="https://www.youtube.com/embed/video-id" allowfullscreen></iframe>');

    expect(result).toContain('<iframe');
    expect(result).toContain('https://www.youtube.com/embed/video-id');
    expect(result).toContain('allowfullscreen');
  });

  test('removes disallowed iframe embeds', () => {
    const result = sanitizeHtml('<iframe src="https://evil.example/embed"></iframe>');

    expect(result).not.toContain('<iframe');
  });

  test('removes inline styles to avoid CSS injection', () => {
    const result = sanitizeHtml('<p style="position:fixed;inset:0;z-index:999999">cover</p>');

    expect(result).toBe('<p>cover</p>');
  });
});
