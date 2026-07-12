import {
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  ref,
  uploadBytes,
} from 'firebase/storage';
import {
  extractImageUrls,
  extractStoragePath,
} from '../components/text-editor/utils/media';

const isAllowedPath = (path, pathPrefixes = []) =>
  path.startsWith('post-images/') &&
  (pathPrefixes.length === 0 || pathPrefixes.some((prefix) => path.startsWith(`${prefix}/`)));

export function getOwnedStorageImageUrls({ content, pathPrefixes }) {
  return [...new Set(extractImageUrls(content))].filter((url) => {
    const path = extractStoragePath(url);
    return path && isAllowedPath(path, pathPrefixes);
  });
}

export async function deleteStorageObjects({ urls, storage, pathPrefixes = [] }) {
  if (!Array.isArray(urls) || urls.length === 0) return 0;
  const uniqueUrls = [...new Set(urls)];
  const results = await Promise.allSettled(uniqueUrls.map(async (url) => {
    const path = extractStoragePath(url);
    if (!path || !isAllowedPath(path, pathPrefixes)) {
      throw new Error('유효한 게시물 이미지 경로가 아닙니다.');
    }
    try {
      await deleteObject(ref(storage, path));
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') throw error;
    }
  }));

  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`이미지 ${failures.length}개를 삭제하지 못했습니다.`);
  }

  return results.length;
}

export async function deleteStorageImages({ urls, storage, uid, role, pathPrefixes = [] }) {
  if (!uid || role !== 'admin') {
    throw new Error('이미지 삭제에는 관리자 권한이 필요합니다.');
  }
  return deleteStorageObjects({ urls, storage, pathPrefixes });
}

export async function rotateStorageDownloadTokens({
  urls,
  storage,
  pathPrefixes = [],
  targetPathPrefix = '',
}) {
  const uniqueUrls = [...new Set(urls)];
  const images = await Promise.all(uniqueUrls.map(async (url) => {
    const path = extractStoragePath(url);
    if (!path || !path.startsWith('post-images/')) {
      throw new Error('유효한 게시물 이미지 경로가 아닙니다.');
    }
    const imageRef = ref(storage, path);
    const [bytes, metadata] = await Promise.all([
      getBytes(imageRef),
      getMetadata(imageRef),
    ]);
    return { bytes, metadata, path, url };
  }));

  const replacements = new Map();
  const createdRefs = [];
  try {
    for (const image of images) {
      const separator = image.path.lastIndexOf('/');
      const directory = targetPathPrefix || image.path.slice(0, separator);
      const filename = image.path.slice(separator + 1);
      const uniquePart = window.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const privateRef = ref(storage, `${directory}/private-${uniquePart}-${filename}`);
      await uploadBytes(
        privateRef,
        image.bytes,
        {
          cacheControl: image.metadata.cacheControl,
          contentDisposition: image.metadata.contentDisposition,
          contentEncoding: image.metadata.contentEncoding,
          contentLanguage: image.metadata.contentLanguage,
          contentType: image.metadata.contentType,
          customMetadata: image.metadata.customMetadata,
        },
      );
      createdRefs.push(privateRef);
      replacements.set(image.url, await getDownloadURL(privateRef));
    }
  } catch (error) {
    await Promise.allSettled(createdRefs.map((createdRef) => deleteObject(createdRef)));
    throw error;
  }
  return replacements;
}

export async function preparePrivateImageContent({
  content,
  storage,
  pathPrefixes = [],
  targetPathPrefix = '',
}) {
  const originalUrls = getOwnedStorageImageUrls({ content, pathPrefixes });
  const replacements = await rotateStorageDownloadTokens({
    urls: originalUrls,
    storage,
    pathPrefixes,
    targetPathPrefix,
  });
  let privateContent = content;
  replacements.forEach((newUrl, oldUrl) => {
    privateContent = privateContent.split(oldUrl).join(newUrl);
  });
  return {
    content: privateContent,
    originalUrls,
    privateUrls: [...replacements.values()],
  };
}
