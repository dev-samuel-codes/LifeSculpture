const SETTINGS_VERSION = 1;
const MIN_TABLE_WIDTH = 120;

const parsePx = (value) => {
  const parsed = Number.parseFloat(String(value || '').replace('px', ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const clampNumber = (value, min = 0) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(Math.round(parsed), min);
};

const normalizeTable = (table = {}) => {
  const width = clampNumber(table.width, MIN_TABLE_WIDTH);
  const offset = clampNumber(table.offset, 0);
  const containerWidth = clampNumber(table.containerWidth, MIN_TABLE_WIDTH);
  if (!width && !Number.isFinite(offset)) return null;

  return {
    ...(width ? { width } : {}),
    ...(Number.isFinite(offset) ? { offset } : {}),
    ...(containerWidth ? { containerWidth } : {}),
  };
};

export const normalizeContentTableSettings = (settings) => {
  if (!settings || typeof settings !== 'object' || !Array.isArray(settings.tables)) {
    return null;
  }

  const tables = settings.tables.map(normalizeTable).filter(Boolean);
  if (tables.length === 0) return null;

  return {
    version: SETTINGS_VERSION,
    tables,
  };
};

export const hasContentTableSettings = (settings) =>
  Boolean(normalizeContentTableSettings(settings));

const getTableSettings = (table) => {
  const width =
    parsePx(table?.dataset?.tableWidth) ||
    parsePx(table?.getAttribute?.('width')) ||
    parsePx(table?.style?.width);
  const offset = parsePx(table?.dataset?.tableOffset) || parsePx(table?.style?.marginLeft);
  const containerWidth = parsePx(table?.dataset?.tableContainerWidth);
  return normalizeTable({ width, offset, containerWidth });
};

export const extractContentTableSettingsFromRoot = (root) => {
  if (!root?.querySelectorAll) return null;

  const containerWidth = clampNumber(
    root.clientWidth || root.getBoundingClientRect?.().width,
    MIN_TABLE_WIDTH,
  );
  const tables = Array.from(root.querySelectorAll('table'))
    .map((table) => ({
      ...getTableSettings(table),
      ...(containerWidth ? { containerWidth } : {}),
    }))
    .filter(Boolean);

  return normalizeContentTableSettings({ version: SETTINGS_VERSION, tables });
};

export const extractContentTableSettingsFromHtml = (html) => {
  if (!html || typeof DOMParser === 'undefined') return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  return extractContentTableSettingsFromRoot(doc.body);
};

export const applyContentTableSettingsToRoot = (root, settings) => {
  const normalized = normalizeContentTableSettings(settings);
  if (!root?.querySelectorAll || !normalized) return false;

  let didChange = false;
  const targetContainerWidth = clampNumber(
    root.clientWidth || root.getBoundingClientRect?.().width,
    MIN_TABLE_WIDTH,
  );
  const tables = Array.from(root.querySelectorAll('table'));
  tables.forEach((table, index) => {
    const tableSettings = normalized.tables[index];
    if (!tableSettings) return;

    const sourceContainerWidth = tableSettings.containerWidth || targetContainerWidth;
    const scale =
      sourceContainerWidth > 0 ? targetContainerWidth / sourceContainerWidth : 1;
    const targetWidth = tableSettings.width
      ? Math.min(
        Math.max(Math.round(tableSettings.width * scale), MIN_TABLE_WIDTH),
        targetContainerWidth,
      )
      : null;

    if (tableSettings.width) {
      const width = String(targetWidth);
      const widthValue = `${width}px`;
      if (table.getAttribute('width') !== width) {
        table.setAttribute('width', width);
        didChange = true;
      }
      if (table.dataset.tableWidth !== width) {
        table.dataset.tableWidth = width;
        didChange = true;
      }
      if (
        tableSettings.containerWidth &&
        table.dataset.tableContainerWidth !== String(tableSettings.containerWidth)
      ) {
        table.dataset.tableContainerWidth = String(tableSettings.containerWidth);
        didChange = true;
      }
      if (table.style.width !== widthValue) {
        table.style.width = widthValue;
        didChange = true;
      }
    }

    if (Number.isFinite(tableSettings.offset)) {
      const sourceMaxOffset = Math.max(
        sourceContainerWidth - (tableSettings.width || 0),
        0,
      );
      const targetMaxOffset = Math.max(
        targetContainerWidth - (targetWidth || table.offsetWidth || 0),
        0,
      );
      const scaledOffset =
        sourceMaxOffset > 0
          ? Math.round((tableSettings.offset / sourceMaxOffset) * targetMaxOffset)
          : tableSettings.offset;
      const offset = String(Math.min(Math.max(scaledOffset, 0), targetMaxOffset));
      const offsetValue = `${offset}px`;
      if (table.dataset.tableOffset !== offset) {
        table.dataset.tableOffset = offset;
        didChange = true;
      }
      if (table.style.marginLeft !== offsetValue) {
        table.style.marginLeft = offsetValue;
        didChange = true;
      }
    }
  });

  return didChange;
};
