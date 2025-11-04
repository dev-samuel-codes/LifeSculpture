import React, { useEffect, useMemo, useState } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../../context/ThemeContext';

function ThemeToggleButton({ className = '', iconSize = 20 }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [isPulsing, setIsPulsing] = useState(false);

  const mergedClassName = useMemo(
    () => [
      'theme-toggle-button',
      className,
      isPulsing ? 'theme-toggle-button--pulse' : '',
    ].filter(Boolean).join(' '),
    [className, isPulsing],
  );

  const IconComponent = isDark ? FiSun : FiMoon;
  const nextThemeLabel = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';

  useEffect(() => {
    if (!isPulsing) {
      return;
    }

    const timer = setTimeout(() => setIsPulsing(false), 520);
    return () => clearTimeout(timer);
  }, [isPulsing]);

  const handleClick = () => {
    setIsPulsing(false);

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setIsPulsing(true));
    } else {
      setIsPulsing(true);
    }

    toggleTheme();
  };

  return (
    <button
      type="button"
      className={mergedClassName}
      onClick={handleClick}
      aria-label={nextThemeLabel}
      title={nextThemeLabel}
    >
      <IconComponent size={iconSize} aria-hidden="true" focusable="false" />
    </button>
  );
}

export default ThemeToggleButton;
