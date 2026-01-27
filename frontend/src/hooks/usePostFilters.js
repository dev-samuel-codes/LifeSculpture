import { useCallback, useEffect, useRef, useState } from 'react';
import { getPostFilters, savePostFilters } from '../services/filters';

const normalizeSections = (sections) => (Array.isArray(sections) ? sections : []);

function usePostFilters({ collectionName, defaultSections = [] }) {
  const [sections, setSections] = useState(() => normalizeSections(defaultSections));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const sectionsRef = useRef(sections);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    let active = true;

    const fetchFilters = async () => {
      setLoading(true);
      setError(null);
      if (!collectionName) {
        setSections(normalizeSections(defaultSections));
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getPostFilters(collectionName);
        if (!active) return;
        if (snapshot?.sections) {
          setSections(normalizeSections(snapshot.sections));
        } else {
          setSections(normalizeSections(defaultSections));
        }
      } catch (err) {
        console.error('[usePostFilters] 필터 로드 실패:', err);
        if (!active) return;
        setSections(normalizeSections(defaultSections));
        setError('필터를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchFilters();
    return () => {
      active = false;
    };
  }, [collectionName, defaultSections]);

  const updateSections = useCallback(
    async (nextSections) => {
      const previous = sectionsRef.current;
      setSections(nextSections);
      try {
        await savePostFilters({ collectionName, sections: nextSections });
        setError(null);
        return { ok: true };
      } catch (err) {
        console.error('[usePostFilters] 필터 저장 실패:', err);
        setSections(previous);
        setError('필터 저장에 실패했습니다.');
        return { ok: false, error: err };
      }
    },
    [collectionName],
  );

  return {
    sections,
    loading,
    error,
    updateSections,
  };
}

export default usePostFilters;
