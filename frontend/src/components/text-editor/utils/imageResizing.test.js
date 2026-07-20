import { setupImageResizing } from './imageResizing';
import { applyStoredImageSizing } from './imageSizing';

const rect = ({ left = 0, top = 0, width, height }) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  x: left,
  y: top,
  toJSON: () => {},
});

describe('setupImageResizing', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };
    window.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    document.body.replaceChildren();
  });

  const setup = () => {
    const container = document.createElement('div');
    const root = document.createElement('div');
    const image = document.createElement('img');
    image.src = 'https://example.com/image.jpg';
    root.appendChild(image);
    container.appendChild(root);
    document.body.appendChild(container);

    Object.defineProperty(root, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(image.parentElement, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    container.getBoundingClientRect = () => rect({ left: 0, top: 0, width: 800, height: 600 });
    root.getBoundingClientRect = () => rect({ left: 0, top: 0, width: 800, height: 600 });
    image.getBoundingClientRect = () => rect({ left: 20, top: 30, width: 300, height: 200 });

    const editor = { update: jest.fn() };
    const onResize = jest.fn();
    const cleanup = setupImageResizing({ root, editor, onResize });
    return { cleanup, container, editor, image, onResize, root };
  };

  test('선택한 이미지의 핸들을 표시하고 방향키로 너비를 저장한다', () => {
    const { cleanup, container, editor, image, onResize } = setup();

    image.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    const handle = container.querySelector('.ql-image-resize-handle');
    const label = container.querySelector('.ql-image-resize-size');

    expect(handle.hidden).toBe(false);
    expect(label.textContent).toBe('300 px');

    handle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));

    expect(image.getAttribute('width')).toBe('310');
    expect(image.style.getPropertyValue('width')).toBe('310px');
    expect(image.style.getPropertyPriority('width')).toBe('important');
    expect(editor.update).toHaveBeenCalledWith('user');
    expect(onResize).toHaveBeenCalledWith(expect.stringContaining('width="310"'));

    cleanup();
  });

  test('드래그한 크기를 편집 영역 너비 안에서 제한하고 정리한다', () => {
    const { cleanup, container, image, onResize } = setup();

    image.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    const handle = container.querySelector('.ql-image-resize-handle');
    handle.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 300 }),
    );
    document.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, button: 0, clientX: 1200 }),
    );
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));

    expect(image.getAttribute('width')).toBe('800');
    expect(onResize).toHaveBeenCalledWith(expect.stringContaining('width="800"'));

    cleanup();
    expect(container.querySelector('.ql-image-resize-handle')).toBeNull();
    expect(container.querySelector('.ql-image-resize-outline')).toBeNull();
    expect(container.querySelector('.ql-image-resize-size')).toBeNull();
  });

  test('저장된 숫자 너비만 안전한 표시 스타일로 복원한다', () => {
    const image = document.createElement('img');
    image.setAttribute('width', '420');

    expect(applyStoredImageSizing(image)).toBe(true);
    expect(image.style.getPropertyValue('width')).toBe('420px');
    expect(image.style.getPropertyPriority('width')).toBe('important');
    expect(image.style.getPropertyValue('max-height')).toBe('none');

    image.setAttribute('width', '100%');
    expect(applyStoredImageSizing(image)).toBe(false);
  });
});
