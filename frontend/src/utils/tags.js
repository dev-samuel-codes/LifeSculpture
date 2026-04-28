export const normalizeTag = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim();

const cleanTag = (value) =>
  (value || '')
    .toString()
    .replace(/^#+/, '')
    .trim();

export const extractHashtagsFromContent = (content) => {
  const text = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return [];

  const re = /(^|[^#\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu;
  const tags = [];
  const seen = new Set();
  let match;

  while ((match = re.exec(text)) !== null) {
    const raw = match[2];
    const normalized = normalizeTag(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(raw);
  }

  return tags;
};

export const mergePostTags = (...tagGroups) => {
  const tags = [];
  const seen = new Set();

  tagGroups.flat().forEach((tag) => {
    const cleaned = cleanTag(tag);
    const normalized = normalizeTag(cleaned);
    if (!cleaned || !normalized || seen.has(normalized)) return;
    seen.add(normalized);
    tags.push(cleaned);
  });

  return tags;
};
