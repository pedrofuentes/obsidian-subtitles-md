/**
 * Command action: convert the active subtitle file into a transcript note.
 *
 * This is the thin, testable wrapper around {@link convertSubtitleFileToNote}
 * that bridges Obsidian's workspace to the pure conversion pipeline. It is total
 * — every outcome (success, wrong/no active file, or a conversion failure) is
 * surfaced to the user through a `Notice` rather than thrown — so it can be used
 * directly as an Obsidian command callback.
 */

import { Notice, type App, type TFile } from 'obsidian';
import {
  convertSubtitleFileToNote,
  type ConvertOptions,
} from './convertToNote';

/** Subtitle file extensions this command can convert. */
const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt']);

/** Narrow to a present `TFile` whose extension is a supported subtitle format. */
function isSubtitleFile(file: TFile | null): file is TFile {
  return file !== null && SUBTITLE_EXTENSIONS.has(file.extension.toLowerCase());
}

/**
 * Convert the workspace's active `.srt` / `.vtt` file into a transcript note,
 * open the new note, and report the outcome via a `Notice`.
 *
 * - No active subtitle file → a guidance `Notice`, no other effect.
 * - Conversion failure (e.g. {@link UnsupportedFormatError} or a vault error) →
 *   an error `Notice`; the error is swallowed, never rethrown.
 *
 * @param app The Obsidian app providing workspace and vault access.
 * @param options Optional reflow/serialize tuning forwarded to the pipeline.
 */
export async function runConvertActiveFile(
  app: App,
  options?: ConvertOptions,
): Promise<void> {
  const file = app.workspace.getActiveFile();

  if (!isSubtitleFile(file)) {
    new Notice('Open a .srt or .vtt file first');
    return;
  }

  try {
    const note = await convertSubtitleFileToNote(app, file, options);
    await app.workspace.getLeaf(false).openFile(note);
    new Notice(`Created transcript note: ${note.basename}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Could not convert: ${message}`);
  }
}
