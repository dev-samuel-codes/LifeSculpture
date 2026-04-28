export const CONTENT_STYLE_VERSION = 1;

export const CONTENT_STYLE_DEFINITIONS = [
  { key: 'normal', label: '본문', elementLabel: '본문' },
  { key: 'h1', label: '제목 1', elementLabel: '제목 1' },
  { key: 'h2', label: '제목 2', elementLabel: '제목 2' },
  { key: 'h3', label: '제목 3', elementLabel: '제목 3' },
  { key: 'h4', label: '제목 4', elementLabel: '제목 4' },
  { key: 'h5', label: '제목 5', elementLabel: '제목 5' },
  { key: 'h6', label: '제목 6', elementLabel: '제목 6' },
];

export const FONT_OPTIONS = [
  { value: 'inherit', label: '기본 글꼴', family: 'inherit' },
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'times', label: 'Times New Roman', family: '"Times New Roman", serif' },
  { value: 'courier', label: 'Courier New', family: '"Courier New", monospace' },
  { value: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
  { value: 'verdana', label: 'Verdana', family: 'Verdana, sans-serif' },
  { value: 'malgun', label: '맑은 고딕', family: '"Malgun Gothic", "맑은 고딕", sans-serif' },
  { value: 'nanum', label: '나눔고딕', family: '"Nanum Gothic", "나눔고딕", sans-serif' },
  {
    value: 'nanumbarun',
    label: '나눔바른고딕',
    family: '"NanumBarunGothic", "나눔바른고딕", sans-serif',
  },
  { value: 'dongle', label: 'Dongle', family: '"Dongle", sans-serif' },
];

export const SIZE_OPTIONS = [
  '8',
  '9',
  '10',
  '11',
  '12',
  '14',
  '16',
  '17',
  '18',
  '20',
  '22',
  '24',
  '26',
  '28',
  '32',
  '36',
  '48',
  '72',
];

export const WEIGHT_OPTIONS = [
  { value: '400', label: '기본' },
  { value: '700', label: '볼드' },
];

export const LINE_HEIGHT_OPTIONS = [
  { value: '1.2', label: '좁게' },
  { value: '1.4', label: '기본' },
  { value: '1.6', label: '넓게' },
  { value: '1.75', label: '본문' },
  { value: '2', label: '아주 넓게' },
];

export const SPACING_OPTIONS = ['0', '4', '8', '12', '16', '20', '24', '32', '40'];

export const ALIGN_OPTIONS = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
  { value: 'justify', label: '양쪽' },
];

const OPTION_SETS = {
  font: new Set(FONT_OPTIONS.map((option) => option.value)),
  size: new Set(SIZE_OPTIONS),
  weight: new Set(WEIGHT_OPTIONS.map((option) => option.value)),
  lineHeight: new Set(LINE_HEIGHT_OPTIONS.map((option) => option.value)),
  spacing: new Set(SPACING_OPTIONS),
  align: new Set(ALIGN_OPTIONS.map((option) => option.value)),
};

const DEFAULT_STYLE_MAP = {
  normal: {
    font: 'inherit',
    size: '17',
    weight: '400',
    color: '#2f3640',
    lineHeight: '1.5',
    marginTop: '8',
    marginBottom: '8',
    align: 'justify',
  },
  h1: {
    font: 'inherit',
    size: '32',
    weight: '700',
    color: '#243043',
    lineHeight: '1.4',
    marginTop: '32',
    marginBottom: '16',
    align: 'left',
  },
  h2: {
    font: 'inherit',
    size: '28',
    weight: '700',
    color: '#243043',
    lineHeight: '1.4',
    marginTop: '32',
    marginBottom: '16',
    align: 'left',
  },
  h3: {
    font: 'inherit',
    size: '24',
    weight: '700',
    color: '#243043',
    lineHeight: '1.4',
    marginTop: '32',
    marginBottom: '16',
    align: 'left',
  },
  h4: {
    font: 'inherit',
    size: '20',
    weight: '700',
    color: '#243043',
    lineHeight: '1.4',
    marginTop: '32',
    marginBottom: '16',
    align: 'left',
  },
  h5: {
    font: 'inherit',
    size: '18',
    weight: '700',
    color: '#243043',
    lineHeight: '1.4',
    marginTop: '32',
    marginBottom: '16',
    align: 'left',
  },
  h6: {
    font: 'inherit',
    size: '16',
    weight: '700',
    color: '#243043',
    lineHeight: '1.4',
    marginTop: '32',
    marginBottom: '16',
    align: 'left',
  },
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const cloneStyle = (style) => ({ ...style });

export const getContentStyleLabel = (styleKey) =>
  CONTENT_STYLE_DEFINITIONS.find((definition) => definition.key === styleKey)?.label || '본문';

export const getFontOption = (fontValue) =>
  FONT_OPTIONS.find((option) => option.value === fontValue) || FONT_OPTIONS[0];

export const getAlignLabel = (alignValue) =>
  ALIGN_OPTIONS.find((option) => option.value === alignValue)?.label || '왼쪽';

export const createDefaultContentStyleSettings = () => ({
  version: CONTENT_STYLE_VERSION,
  styles: CONTENT_STYLE_DEFINITIONS.reduce((styles, definition) => {
    styles[definition.key] = cloneStyle(DEFAULT_STYLE_MAP[definition.key]);
    return styles;
  }, {}),
});

export const normalizeContentStyle = (styleKey, style = {}) => {
  const fallback = DEFAULT_STYLE_MAP[styleKey] || DEFAULT_STYLE_MAP.normal;
  return {
    font: OPTION_SETS.font.has(String(style.font || '')) ? String(style.font) : fallback.font,
    size: OPTION_SETS.size.has(String(style.size || '')) ? String(style.size) : fallback.size,
    weight: OPTION_SETS.weight.has(String(style.weight || ''))
      ? String(style.weight)
      : fallback.weight,
    color: HEX_COLOR_PATTERN.test(String(style.color || '')) ? String(style.color) : fallback.color,
    lineHeight: OPTION_SETS.lineHeight.has(String(style.lineHeight || ''))
      ? String(style.lineHeight)
      : fallback.lineHeight,
    marginTop: OPTION_SETS.spacing.has(String(style.marginTop || ''))
      ? String(style.marginTop)
      : fallback.marginTop,
    marginBottom: OPTION_SETS.spacing.has(String(style.marginBottom || ''))
      ? String(style.marginBottom)
      : fallback.marginBottom,
    align: OPTION_SETS.align.has(String(style.align || '')) ? String(style.align) : fallback.align,
  };
};

export const normalizeContentStyleSettings = (settings) => {
  const sourceStyles =
    settings && typeof settings === 'object' && !Array.isArray(settings) ? settings.styles : null;

  return {
    version: CONTENT_STYLE_VERSION,
    styles: CONTENT_STYLE_DEFINITIONS.reduce((styles, definition) => {
      styles[definition.key] = normalizeContentStyle(
        definition.key,
        sourceStyles?.[definition.key],
      );
      return styles;
    }, {}),
  };
};

export const hasContentStyleSettings = (settings) =>
  Boolean(settings && typeof settings === 'object' && !Array.isArray(settings));

const toPx = (value) => `${Number(value)}px`;

export const getContentStyleCssVariables = (settings) => {
  if (!hasContentStyleSettings(settings)) {
    return {};
  }

  const normalized = normalizeContentStyleSettings(settings);

  return CONTENT_STYLE_DEFINITIONS.reduce((variables, definition) => {
    const style = normalized.styles[definition.key];
    const prefix = `--rich-text-${definition.key}`;
    variables[`${prefix}-font-family`] = getFontOption(style.font).family;
    variables[`${prefix}-font-size`] = toPx(style.size);
    variables[`${prefix}-font-weight`] = style.weight;
    variables[`${prefix}-color`] = style.color;
    variables[`${prefix}-line-height`] = style.lineHeight;
    variables[`${prefix}-margin-top`] = toPx(style.marginTop);
    variables[`${prefix}-margin-bottom`] = toPx(style.marginBottom);
    variables[`${prefix}-align`] = style.align;
    return variables;
  }, {});
};

export const describeContentStyle = (style) => {
  const fontLabel = getFontOption(style.font).label;
  const weightLabel =
    WEIGHT_OPTIONS.find((option) => option.value === style.weight)?.label || `${style.weight}`;

  return `글꼴: ${fontLabel}, 크기: ${style.size}px, 굵기: ${weightLabel}, ${getAlignLabel(style.align)}`;
};
