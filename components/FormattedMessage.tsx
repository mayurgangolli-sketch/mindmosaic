'use client';

import React from 'react';

interface FormattedMessageProps {
  content: string;
  className?: string;
}

/**
 * Normalizes common LLM Markdown escaping artifacts:
 * - Escaped asterisks like \* or \*\* into standard asterisks
 * - Extra consecutive asterisks around words into standard bold: ****word**** -> **word**
 * - Hyphens glued to bold endings: **word**- or **word***- -> **word** – 
 */
function normalizeMarkdown(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Replace escaped asterisks (e.g. \* -> *)
  cleaned = cleaned.replace(/\\\*/g, '*');

  // Normalize 3 or more consecutive asterisks wrapping text into standard **bold**
  cleaned = cleaned.replace(/\*{3,}([^*]+)\*{3,}/g, '**$1**');

  // Fix glued dashes or hyphens right after bold markers
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*[-–—](?!\s)/g, '**$1** – ');
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*[-–—]\s*/g, '**$1** – ');

  return cleaned;
}

interface InlineSpan {
  type: 'text' | 'bold' | 'italic';
  content: string;
}

/**
 * Parses inline formatting (bold: **text**, italic: *text*) without dangerouslySetInnerHTML.
 * Safe from XSS injection.
 */
function parseInline(text: string): InlineSpan[] {
  const parts: InlineSpan[] = [];
  // Match **bold** or *italic*
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // Bold
      parts.push({ type: 'bold', content: match[2] });
    } else if (match[3]) {
      // Italic
      parts.push({ type: 'italic', content: match[3] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

function renderInlineSpans(spans: InlineSpan[], keyPrefix: string): React.ReactNode[] {
  return spans.map((span, idx) => {
    const key = `${keyPrefix}_${idx}`;
    if (span.type === 'bold') {
      return (
        <strong key={key} className="font-semibold text-aqua-950 dark:text-aqua-200">
          {span.content}
        </strong>
      );
    }
    if (span.type === 'italic') {
      return (
        <em key={key} className="italic text-slate-700 dark:text-night-text">
          {span.content}
        </em>
      );
    }
    return <span key={key}>{span.content}</span>;
  });
}

type Block =
  | { type: 'p'; text: string }
  | { type: 'ol'; items: string[] }
  | { type: 'ul'; items: string[] };

/**
 * Splits normalized message into structured paragraphs and list blocks.
 */
function parseBlocks(rawText: string): Block[] {
  const normalized = normalizeMarkdown(rawText);
  const lines = normalized.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentList: { type: 'ol' | 'ul'; items: string[] } | null = null;
  let currentParagraph: string[] = [];

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'p', text: currentParagraph.join(' ') });
      currentParagraph = [];
    }
  }

  function flushList() {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    // Numbered list item: e.g. "1. ", "2. "
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[2]);
      continue;
    }

    // Bullet list item: e.g. "- ", "* ", "• "
    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Regular text line
    if (currentList) {
      flushList();
    }
    currentParagraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

/**
 * FormattedMessage safely parses and renders assistant reflections:
 * - Normalizes escaped Markdown artifacts (\*\***text\***-)
 * - Renders paragraphs with comfortable spacing
 * - Formats numbered and bulleted suggestion lists
 * - Highlights bold headings cleanly in teal/night tones
 * - Uses 100% native React elements without dangerouslySetInnerHTML (immune to XSS)
 */
export function FormattedMessage({ content, className = '' }: FormattedMessageProps) {
  if (!content) return null;

  const blocks = parseBlocks(content);

  // If there are no complex blocks (just single line), render inline spans directly
  if (blocks.length === 1 && blocks[0].type === 'p' && !content.includes('\n')) {
    return (
      <span className={className}>
        {renderInlineSpans(parseInline(blocks[0].text), 'single')}
      </span>
    );
  }

  return (
    <div className={`space-y-3 font-sans leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'p') {
          return (
            <p key={`p_${bIdx}`} className="leading-relaxed">
              {renderInlineSpans(parseInline(block.text), `p_${bIdx}`)}
            </p>
          );
        }

        if (block.type === 'ol') {
          return (
            <ol key={`ol_${bIdx}`} className="space-y-2.5 my-2 pl-1">
              {block.items.map((item, iIdx) => (
                <li key={`ol_${bIdx}_${iIdx}`} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-aqua-100 dark:bg-night-card text-aqua-800 dark:text-aqua-300 text-xs font-semibold mt-0.5">
                    {iIdx + 1}
                  </span>
                  <div className="flex-1 leading-relaxed">
                    {renderInlineSpans(parseInline(item), `ol_${bIdx}_${iIdx}`)}
                  </div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'ul') {
          return (
            <ul key={`ul_${bIdx}`} className="space-y-2 my-2 pl-1">
              {block.items.map((item, iIdx) => (
                <li key={`ul_${bIdx}_${iIdx}`} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-aqua-600 dark:bg-aqua-400 mt-2" />
                  <div className="flex-1 leading-relaxed">
                    {renderInlineSpans(parseInline(item), `ul_${bIdx}_${iIdx}`)}
                  </div>
                </li>
              ))}
            </ul>
          );
        }

        return null;
      })}
    </div>
  );
}

