import { useEffect, useState } from 'react';
import { getResponsiveEditorHeight } from '../components/text-editor/utils/layout';

function useResponsiveEditorHeight() {
  const [height, setHeight] = useState(() => getResponsiveEditorHeight());

  useEffect(() => {
    const handleResize = () => {
      setHeight(getResponsiveEditorHeight());
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return height;
}

export default useResponsiveEditorHeight;
