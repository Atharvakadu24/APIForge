export interface JsonParseResult {
  isJson: boolean;
  data: unknown;
  formatted: string;
  error?: string;
}

/**
 * Safely checks and parses raw response text into JSON.
 * Returns formatted 2-space pretty-printed text if valid JSON, otherwise returns the original raw string.
 */
export function tryParseJson(raw: string): JsonParseResult {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return {
      isJson: false,
      data: null,
      formatted: raw || '',
    };
  }

  const trimmed = raw.trim();
  // Quick heuristic check: valid JSON root must start with '{', '[', '"', boolean, number, or 'null'
  if (
    !trimmed.startsWith('{') &&
    !trimmed.startsWith('[') &&
    !trimmed.startsWith('"') &&
    trimmed !== 'true' &&
    trimmed !== 'false' &&
    trimmed !== 'null' &&
    !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)
  ) {
    return {
      isJson: false,
      data: null,
      formatted: raw,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      isJson: true,
      data: parsed,
      formatted: JSON.stringify(parsed, null, 2),
    };
  } catch (err: unknown) {
    return {
      isJson: false,
      data: null,
      formatted: raw,
      error: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
}

/**
 * Formats byte sizes into readable human-friendly representations (B, KB, MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);

  if (index === 0) {
    return `${bytes} B`;
  }

  const value = bytes / Math.pow(k, index);
  return `${value.toFixed(value < 10 ? 2 : 1)} ${sizes[index]}`;
}

export interface StatusStyle {
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
}

/**
 * Returns consistent semantic styling classes for HTTP status codes.
 */
export function getStatusStyle(status: number): StatusStyle {
  if (status >= 200 && status < 300) {
    return {
      textClass: 'text-emerald-400',
      bgClass: 'bg-emerald-950/50',
      borderClass: 'border-emerald-800/40',
      dotClass: 'bg-emerald-400',
    };
  }
  if (status >= 300 && status < 400) {
    return {
      textClass: 'text-sky-400',
      bgClass: 'bg-sky-950/50',
      borderClass: 'border-sky-800/40',
      dotClass: 'bg-sky-400',
    };
  }
  if (status >= 400 && status < 500) {
    return {
      textClass: 'text-amber-400',
      bgClass: 'bg-amber-950/50',
      borderClass: 'border-amber-800/40',
      dotClass: 'bg-amber-400',
    };
  }
  if (status >= 500) {
    return {
      textClass: 'text-rose-450',
      bgClass: 'bg-rose-950/50',
      borderClass: 'border-rose-800/40',
      dotClass: 'bg-rose-500',
    };
  }
  // Default / Network Failure / 0
  return {
    textClass: 'text-rose-400',
    bgClass: 'bg-slate-950',
    borderClass: 'border-slate-800',
    dotClass: 'bg-slate-500',
  };
}

export interface SearchMatch {
  index: number;
  start: number;
  end: number;
}

/**
 * Finds all case-insensitive match start/end indices of a search query in a text string.
 */
export function findSearchMatches(text: string, query: string): SearchMatch[] {
  if (!text || !query || !query.trim()) {
    return [];
  }

  const matches: SearchMatch[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryLen = query.length;
  let startIndex = 0;
  let matchIndex = 0;

  while (startIndex < lowerText.length) {
    const foundIndex = lowerText.indexOf(lowerQuery, startIndex);
    if (foundIndex === -1) break;

    matches.push({
      index: matchIndex++,
      start: foundIndex,
      end: foundIndex + queryLen,
    });

    startIndex = foundIndex + queryLen;
  }

  return matches;
}
