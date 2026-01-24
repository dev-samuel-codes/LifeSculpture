const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDate = (value, options = {}) => {
  const date = toDate(value);
  if (!date) return '';

  const { locale, ...formatOptions } = options;
  const hasCustomFormat = locale || Object.keys(formatOptions).length > 0;

  if (hasCustomFormat) {
    return new Intl.DateTimeFormat(locale || undefined, formatOptions).format(date);
  }

  return date.toLocaleDateString();
};

export const formatDateOnly = (
  value,
  {
    locale = 'ko-KR',
    timeZone = 'Asia/Seoul',
    year = 'numeric',
    month = '2-digit',
    day = '2-digit',
    separator = '. ',
  } = {},
) => {
  const date = toDate(value);
  if (!date) return '';

  const formatted = new Intl.DateTimeFormat(locale, { year, month, day, timeZone }).format(date);

  if (separator === null) {
    return formatted;
  }

  return formatted.replace(/\.\s?/g, separator).trim();
};
