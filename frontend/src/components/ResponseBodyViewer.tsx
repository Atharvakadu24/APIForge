import React, { useMemo, useEffect, useRef } from 'react';
import { tryParseJson } from '../utils/responseUtils';

interface ResponseBodyViewerProps {
  rawBody: string;
  isPretty: boolean;
  searchQuery: string;
  activeMatchIndex: number;
  onMatchCountChange: (count: number) => void;
}

/**
 * Pure helper to render text with highlighted search matches.
 * Returns the generated React nodes and the number of matches found in this text segment.
 */
function highlightMatchesInText(
  text: string,
  query: string,
  startMatchIndex: number,
  activeMatchIndex: number,
  className?: string
): { nodes: React.ReactNode[]; matchCount: number } {
  if (!query.trim() || !text) {
    return {
      nodes: [<span key="plain" className={className}>{text}</span>],
      matchCount: 0,
    };
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryLen = query.length;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let matchesInChunk = 0;

  while (lastIdx < text.length) {
    const foundIdx = lowerText.indexOf(lowerQuery, lastIdx);
    if (foundIdx === -1) {
      nodes.push(
        <span key={`text-${lastIdx}`} className={className}>
          {text.substring(lastIdx)}
        </span>
      );
      break;
    }

    if (foundIdx > lastIdx) {
      nodes.push(
        <span key={`text-${lastIdx}`} className={className}>
          {text.substring(lastIdx, foundIdx)}
        </span>
      );
    }

    const currentMatchIdx = startMatchIndex + matchesInChunk;
    const isCurrent = currentMatchIdx === activeMatchIndex;

    nodes.push(
      <mark
        key={`match-${currentMatchIdx}`}
        id={`response-match-${currentMatchIdx}`}
        className={`px-0.5 rounded ${
          isCurrent
            ? 'bg-amber-300 text-slate-950 font-bold ring-2 ring-amber-500 z-10'
            : 'bg-amber-500/80 text-slate-950 font-semibold'
        }`}
      >
        {text.substring(foundIdx, foundIdx + queryLen)}
      </mark>
    );

    matchesInChunk++;
    lastIdx = foundIdx + queryLen;
  }

  return { nodes, matchCount: matchesInChunk };
}

export default function ResponseBodyViewer({
  rawBody,
  isPretty,
  searchQuery,
  activeMatchIndex,
  onMatchCountChange,
}: ResponseBodyViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1. Memoized JSON parsing
  const jsonResult = useMemo(() => {
    return tryParseJson(rawBody);
  }, [rawBody]);

  // 2. Select text to display based on isPretty and isJson
  const displayText = useMemo(() => {
    if (!rawBody || !rawBody.trim()) {
      return '(empty response body)';
    }
    if (isPretty && jsonResult.isJson) {
      return jsonResult.formatted;
    }
    return rawBody;
  }, [rawBody, isPretty, jsonResult]);

  // 3. Count total matches and inform parent
  const totalMatches = useMemo(() => {
    if (!searchQuery.trim() || !displayText || displayText === '(empty response body)') {
      return 0;
    }
    const lowerText = displayText.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    const qLen = searchQuery.length;
    let count = 0;
    let idx = 0;
    while (idx < lowerText.length) {
      const found = lowerText.indexOf(lowerQuery, idx);
      if (found === -1) break;
      count++;
      idx = found + qLen;
    }
    return count;
  }, [displayText, searchQuery]);

  useEffect(() => {
    onMatchCountChange(totalMatches);
  }, [totalMatches, onMatchCountChange]);

  // 4. Scroll active match into view when activeMatchIndex or search query changes
  useEffect(() => {
    if (totalMatches > 0 && activeMatchIndex >= 0) {
      const el = document.getElementById(`response-match-${activeMatchIndex}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeMatchIndex, totalMatches]);

  // 5. Render Pretty JSON lines with syntax styling and functional match tracking
  const renderedLines = useMemo(() => {
    if (!displayText) return null;
    const lines = displayText.split('\n');
    let runningMatchCounter = 0;

    return lines.map((line, lineIdx) => {
      // If in pretty JSON mode, highlight JSON keys, strings, numbers, booleans, and nulls
      if (isPretty && jsonResult.isJson) {
        const tokens: React.ReactNode[] = [];
        let tokenKey = 0;

        // Pattern matching: key, string, number, bool, null, or punctuation
        const regex = /("(\u005c["\\]|[^"])*"(?:\s*:)?)|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;
        let lastOffset = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
          const matchStart = match.index;
          if (matchStart > lastOffset) {
            const prefix = line.substring(lastOffset, matchStart);
            const { nodes, matchCount } = highlightMatchesInText(
              prefix,
              searchQuery,
              runningMatchCounter,
              activeMatchIndex,
              'text-slate-400'
            );
            runningMatchCounter += matchCount;
            tokens.push(<React.Fragment key={`tok-${tokenKey++}`}>{nodes}</React.Fragment>);
          }

          const matchedText = match[0];
          let colorClass = 'text-slate-300';

          if (match[1]) {
            // String or Key
            if (matchedText.endsWith(':')) {
              colorClass = 'text-sky-300 font-semibold';
            } else {
              colorClass = 'text-emerald-350';
            }
          } else if (match[3]) {
            // Boolean or Null
            if (matchedText === 'null') {
              colorClass = 'text-slate-500 italic font-semibold';
            } else {
              colorClass = 'text-purple-350 font-semibold';
            }
          } else if (match[4]) {
            // Number
            colorClass = 'text-amber-350 font-medium';
          } else if (match[5]) {
            // Punctuation
            colorClass = 'text-slate-400';
          }

          const { nodes, matchCount } = highlightMatchesInText(
            matchedText,
            searchQuery,
            runningMatchCounter,
            activeMatchIndex,
            colorClass
          );
          runningMatchCounter += matchCount;
          tokens.push(<React.Fragment key={`tok-${tokenKey++}`}>{nodes}</React.Fragment>);

          lastOffset = regex.lastIndex;
        }

        if (lastOffset < line.length) {
          const suffix = line.substring(lastOffset);
          const { nodes, matchCount } = highlightMatchesInText(
            suffix,
            searchQuery,
            runningMatchCounter,
            activeMatchIndex,
            'text-slate-400'
          );
          runningMatchCounter += matchCount;
          tokens.push(<React.Fragment key={`tok-${tokenKey++}`}>{nodes}</React.Fragment>);
        }

        return (
          <div key={`line-${lineIdx}`} className="flex items-start hover:bg-slate-900/40 px-1 py-0.2 rounded font-mono text-xs leading-relaxed">
            <span className="w-9 shrink-0 text-right pr-3 select-none text-slate-650 text-[11px] font-mono">
              {lineIdx + 1}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-all select-text">
              {tokens.length > 0 ? tokens : ' '}
            </span>
          </div>
        );
      }

      // Raw / Plain-Text mode: single highlighted line with line numbers
      const { nodes, matchCount } = highlightMatchesInText(
        line,
        searchQuery,
        runningMatchCounter,
        activeMatchIndex
      );
      runningMatchCounter += matchCount;

      return (
        <div key={`line-${lineIdx}`} className="flex items-start hover:bg-slate-900/40 px-1 py-0.2 rounded font-mono text-xs leading-relaxed">
          <span className="w-9 shrink-0 text-right pr-3 select-none text-slate-650 text-[11px] font-mono">
            {lineIdx + 1}
          </span>
          <span className="flex-1 whitespace-pre-wrap break-all select-text text-slate-300">
            {nodes}
          </span>
        </div>
      );
    });
  }, [displayText, isPretty, jsonResult.isJson, searchQuery, activeMatchIndex]);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-950 rounded-lg border border-slate-850 p-2.5 overflow-auto max-h-[350px] select-text"
    >
      <div className="flex flex-col">{renderedLines}</div>
    </div>
  );
}
