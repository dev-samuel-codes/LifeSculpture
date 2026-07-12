import { useEffect, useState } from 'react';
import { sanitizeHtml } from '../components/text-editor/utils/content';
import { setupResponsiveImageSizing } from '../components/text-editor/utils/imageSizing';
import { applyContentTableSettingsToRoot } from '../components/text-editor/utils/contentTableSettings';
import { buildContentWithToc } from '../utils/postContentPresentation';

export function usePostContentPresentation(post) {
  const [renderedContent, setRenderedContent] = useState('');
  const [tocItems, setTocItems] = useState([]);

  useEffect(() => {
    if (!post?.content) {
      setRenderedContent('');
      setTocItems([]);
      return;
    }

    const { html, toc } = buildContentWithToc(sanitizeHtml(post.content));
    setRenderedContent(html);
    setTocItems(toc);
  }, [post?.content]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const contentElement = document.querySelector('.post-content');
      if (!contentElement) return;

      const codeBlocks = contentElement.querySelectorAll('pre');
      codeBlocks.forEach((block) => {
        block.style.setProperty('white-space', 'pre', 'important');
        block.style.setProperty('overflow-x', 'auto', 'important');
        block.style.setProperty('max-width', '800px', 'important');
        block.style.setProperty('margin', '1.75rem auto', 'important');
        block.style.setProperty('padding', '1.5rem', 'important');
        block.style.setProperty('background-color', '#1a1f2a', 'important');
        block.style.setProperty('border-radius', '14px', 'important');
        block.style.setProperty('color', '#cfd2d1', 'important');

        const container = block.closest('.ql-code-block-container');
        if (container) {
          container.style.setProperty('background-color', 'transparent', 'important');
          container.style.setProperty('padding', '0', 'important');
          container.style.setProperty('border', 'none', 'important');
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [renderedContent]);

  useEffect(() => {
    const contentElement = document.querySelector('.post-content');
    if (!contentElement) return undefined;
    return setupResponsiveImageSizing({ root: contentElement });
  }, [renderedContent]);

  useEffect(() => {
    const contentElement = document.querySelector('.post-content');
    if (!contentElement) return undefined;

    const applyTableSettings = () => {
      applyContentTableSettingsToRoot(contentElement, post?.contentTableSettings);
    };
    applyTableSettings();
    window.addEventListener('resize', applyTableSettings);
    return () => window.removeEventListener('resize', applyTableSettings);
  }, [post?.contentTableSettings, renderedContent]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640 || !post?.content) return;
      const contentElement = document.querySelector('.post-content');
      if (!contentElement) return;

      const paragraphs = contentElement.querySelectorAll('p');
      paragraphs.forEach((paragraph) => {
        if (paragraph.classList.contains('ql-align-justify')) {
          paragraph.style.textAlign = 'left';
        }
        paragraph.style.wordSpacing = 'normal';
        paragraph.style.letterSpacing = 'normal';
      });

      const justifyElements = contentElement.querySelectorAll('.ql-align-justify');
      justifyElements.forEach((element) => {
        element.style.textAlign = 'left';
        element.style.wordSpacing = 'normal';
        element.style.letterSpacing = 'normal';
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [post]);

  return { renderedContent, tocItems };
}
