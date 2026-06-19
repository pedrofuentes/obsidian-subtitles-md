/**
 * Plugin settings model and defaults.
 *
 * These fields mirror the tuning knobs of the pure conversion pipeline
 * ({@link ReflowOptions} + {@link SerializeOptions}) so the plugin can persist
 * user preferences and translate them into a {@link ConvertOptions} for each
 * conversion. The settings tab UI is implemented separately; this module only
 * defines the shape and its sensible defaults.
 */

import type {
  SerializeOptions,
  SpeakerStyle,
  TimestampStyle,
} from './serialize/markdown';
import type { ReflowOptions } from './transform/reflow';

/** Persisted user preferences for subtitle-to-note conversion. */
export interface SubtitlesMdSettings {
  /** {@link ReflowOptions.gapThresholdMs}. */
  gapThresholdMs: number;
  /** {@link ReflowOptions.breakOnSpeakerChange}. */
  breakOnSpeakerChange: boolean;
  /** {@link ReflowOptions.breakOnSentenceEnd}. */
  breakOnSentenceEnd: boolean;
  /** {@link SerializeOptions.timestamps}. */
  timestamps: TimestampStyle;
  /** {@link SerializeOptions.includeFrontmatter}. */
  includeFrontmatter: boolean;
  /** {@link SerializeOptions.speakerStyle}. */
  speakerStyle: SpeakerStyle;
}

/**
 * Default settings, matching the pipeline's own defaults so an unconfigured
 * install behaves identically to calling the pipeline with no options.
 */
export const DEFAULT_SETTINGS: SubtitlesMdSettings = {
  gapThresholdMs: 2000,
  breakOnSpeakerChange: true,
  breakOnSentenceEnd: false,
  timestamps: 'inline',
  includeFrontmatter: true,
  speakerStyle: 'bold',
};

/** Project the persisted settings into pipeline reflow options. */
export function settingsToReflowOptions(
  settings: SubtitlesMdSettings,
): ReflowOptions {
  return {
    gapThresholdMs: settings.gapThresholdMs,
    breakOnSpeakerChange: settings.breakOnSpeakerChange,
    breakOnSentenceEnd: settings.breakOnSentenceEnd,
  };
}

/** Project the persisted settings into pipeline serialize options. */
export function settingsToSerializeOptions(
  settings: SubtitlesMdSettings,
): SerializeOptions {
  return {
    timestamps: settings.timestamps,
    includeFrontmatter: settings.includeFrontmatter,
    speakerStyle: settings.speakerStyle,
  };
}
