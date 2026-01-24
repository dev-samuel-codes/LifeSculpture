import { useEffect, useMemo, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../firebase/firebase';

const urlCache = new Map();

/**
 * Load a public download URL for a Firebase Storage object.
 * The hook caches URLs in-memory so repeated calls are instant.
 *
 * @param {string | null | undefined} path Storage path relative to the bucket root.
 */
export default function useStorageImage(path) {
  const [url, setUrl] = useState(() => (path && urlCache.has(path) ? urlCache.get(path) : null));
  const [loading, setLoading] = useState(() => (path ? !urlCache.has(path) : false));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let isActive = true;

    const load = async () => {
      if (urlCache.has(path)) {
        setUrl(urlCache.get(path));
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const downloadUrl = await getDownloadURL(ref(storage, path));
        if (!isActive) return;
        urlCache.set(path, downloadUrl);
        setUrl(downloadUrl);
      } catch (err) {
        if (!isActive) return;
        console.error(`[useStorageImage] Failed to load ${path}:`, err);
        setError(err);
        setUrl(null);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [path]);

  return useMemo(
    () => ({
      url,
      loading,
      error,
    }),
    [url, loading, error],
  );
}
