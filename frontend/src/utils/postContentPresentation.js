export const enhanceCodeBlocks = (html) => {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof document === 'undefined') return html;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const containers = wrapper.querySelectorAll('.ql-code-block-container');

  containers.forEach((container) => {
    if (!container.classList.contains('has-separated-header')) {
      if (!container.querySelector('.code-block-header')) {
        const header = document.createElement('div');
        header.className = 'code-block-header';
        const indicators = document.createElement('div');
        indicators.className = 'code-block-indicators';

        ['red', 'yellow', 'green'].forEach((color) => {
          const indicator = document.createElement('span');
          indicator.className = `code-block-indicator ${color}`;
          indicators.appendChild(indicator);
        });

        header.appendChild(indicators);
        container.insertBefore(header, container.firstChild);
      }

      let body = container.querySelector('.code-block-body');
      if (!body) {
        body = document.createElement('div');
        body.className = 'code-block-body';
        while (container.children.length > 1) {
          body.appendChild(container.children[1]);
        }
        container.appendChild(body);
      }

      const preElements = body.querySelectorAll('pre');
      preElements.forEach((pre) => {
        if (pre.dataset.lineNumbered === 'true') return;

        const textContent = pre.textContent || '';
        const normalized = textContent.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');
        if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();

        const codeElement = document.createElement('code');
        lines.forEach((line, index) => {
          const lineSpan = document.createElement('span');
          lineSpan.textContent = line.length === 0 ? '\u00A0' : line;
          const lineNumber = String(index + 1);
          lineSpan.dataset.lineNumber = lineNumber;
          lineSpan.setAttribute('data-line-number', lineNumber);
          codeElement.appendChild(lineSpan);
        });

        if (lines.length === 0) {
          const placeholderLine = document.createElement('span');
          placeholderLine.textContent = '\u00A0';
          placeholderLine.dataset.lineNumber = '1';
          placeholderLine.setAttribute('data-line-number', '1');
          codeElement.appendChild(placeholderLine);
        }

        pre.innerHTML = '';
        pre.appendChild(codeElement);
        pre.dataset.lineNumbered = 'true';
      });

      container.classList.add('has-separated-header');
    }
  });

  return wrapper.innerHTML;
};

export const buildContentWithToc = (html) => {
  if (!html) return { html: '', toc: [] };

  const enhancedHtml = enhanceCodeBlocks(html);
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { html: enhancedHtml, toc: [] };
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = enhancedHtml;
  const idCounts = {};
  const headings = wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const tocItems = Array.from(headings)
    .filter((heading) => heading.textContent && heading.textContent.trim().length > 0)
    .map((heading, index) => {
      const text = heading.textContent.trim();
      const normalizedBase = text
        .toLowerCase()
        .replace(/[^0-9a-zA-Z\u3131-\u318E\uAC00-\uD7A3\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      const baseId = normalizedBase || `heading-${index + 1}`;
      const count = idCounts[baseId] || 0;
      idCounts[baseId] = count + 1;
      const uniqueId = count === 0 ? baseId : `${baseId}-${count}`;
      heading.id = uniqueId;
      return {
        id: uniqueId,
        text,
        level: Number(heading.tagName.replace('H', '')) || 2,
      };
    });

  return { html: wrapper.innerHTML, toc: tocItems };
};
