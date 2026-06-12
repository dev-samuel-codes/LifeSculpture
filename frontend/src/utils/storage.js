import { ref, deleteObject } from 'firebase/storage';
import { extractStoragePath } from '../components/text-editor/utils/media';

export async function deleteStorageImages({ urls, storage, uid, role }) {
  if (!Array.isArray(urls) || urls.length === 0) return 0;
  if (!uid || role !== 'admin') return 0;

  const tasks = urls.map(async (url) => {
    const path = extractStoragePath(url);
    if (!path) return false;
    if (!path.startsWith('post-images/')) return false;
    try {
      await deleteObject(ref(storage, path));
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('이미지 삭제 실패:', error);
      }
      return false;
    }
  });

  const results = await Promise.all(tasks);
  return results.filter(Boolean).length;
}
