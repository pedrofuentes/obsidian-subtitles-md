/**
 * Pure cue reflow / paragraphing.
 *
 * Subtitle cues are typically short, time-sliced fragments that read poorly as
 * prose. {@link reflow} merges consecutive cues into readable {@link Paragraph}
 * units using simple, deterministic heuristics (speaker changes, timing gaps,
 * and optionally sentence boundaries).
 *
 * This module is intentionally pure: it has no Obsidian, I/O, or runtime
 * dependency and never mutates its input. The {@link Paragraph} shape is the
 * shared contract consumed by the Markdown serializer.
 */

import type { Transcript } from '../model';

/** A merged, readable block of transcript text spanning one or more cues. */
export interface Paragraph {
  /** Speaker label, present only when uniform and known across the paragraph. */
  speaker?: string;
  /** Normalized paragraph text (cue texts joined by single spaces). */
  text: string;
  /** Start offset of the first cue in the paragraph, in milliseconds. */
  startMs: number;
  /** End offset of the last cue in the paragraph, in milliseconds. */
  endMs: number;
}

/** Options controlling how cues are grouped into {@link Paragraph}s. */
export interface ReflowOptions {
  /**
   * Start a new paragraph when the gap between consecutive cues
   * (`cue.startMs - prevCue.endMs`) exceeds this many milliseconds.
   * @defaultValue 2000
   */
  gapThresholdMs?: number;
  /**
   * Start a new paragraph when the speaker label changes.
   * @defaultValue true
   */
  breakOnSpeakerChange?: boolean;
  /**
   * When true, also start a new paragraph after a cue whose accumulated text
   * ends a sentence (`.`, `!`, or `?`, optionally followed by closing quotes
   * or brackets).
   * @defaultValue false
   */
  breakOnSentenceEnd?: boolean;
}

const DEFAULT_GAP_THRESHOLD_MS = 2000;

/** Matches sentence-ending punctuation, allowing trailing quotes/brackets. */
const SENTENCE_END = /[.!?]["'”’)\]]*$/;

/** Collapse all whitespace (including newlines) to single spaces and trim. */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

interface PendingParagraph {
  parts: string[];
  startMs: number;
  endMs: number;
  speaker: string | undefined;
  speakerUniform: boolean;
}

function finalize(pending: PendingParagraph): Paragraph {
  const paragraph: Paragraph = {
    text: pending.parts.join(' '),
    startMs: pending.startMs,
    endMs: pending.endMs,
  };
  if (pending.speakerUniform && pending.speaker !== undefined) {
    paragraph.speaker = pending.speaker;
  }
  return paragraph;
}

/**
 * Group a transcript's cues into readable paragraphs.
 *
 * Pure and total: an empty transcript yields `[]`, and omitted options fall
 * back to sensible defaults.
 */
export function reflow(transcript: Transcript, options: ReflowOptions = {}): Paragraph[] {
  const gapThresholdMs = options.gapThresholdMs ?? DEFAULT_GAP_THRESHOLD_MS;
  const breakOnSpeakerChange = options.breakOnSpeakerChange ?? true;
  const breakOnSentenceEnd = options.breakOnSentenceEnd ?? false;

  const paragraphs: Paragraph[] = [];
  let pending: PendingParagraph | undefined;
  let prevEndMs = 0;
  let prevText = '';

  for (const cue of transcript.cues) {
    const text = normalizeText(cue.text);

    const speakerChanged =
      breakOnSpeakerChange && pending !== undefined && cue.speaker !== pending.speaker;
    const gapExceeded =
      pending !== undefined && cue.startMs - prevEndMs > gapThresholdMs;
    const sentenceEnded =
      breakOnSentenceEnd && pending !== undefined && SENTENCE_END.test(prevText);

    if (pending !== undefined && (speakerChanged || gapExceeded || sentenceEnded)) {
      paragraphs.push(finalize(pending));
      pending = undefined;
    }

    if (pending === undefined) {
      pending = {
        parts: [text],
        startMs: cue.startMs,
        endMs: cue.endMs,
        speaker: cue.speaker,
        speakerUniform: true,
      };
    } else {
      pending.parts.push(text);
      pending.endMs = cue.endMs;
      if (cue.speaker !== pending.speaker) {
        pending.speakerUniform = false;
      }
    }

    prevEndMs = cue.endMs;
    prevText = text;
  }

  if (pending !== undefined) {
    paragraphs.push(finalize(pending));
  }

  return paragraphs;
}
