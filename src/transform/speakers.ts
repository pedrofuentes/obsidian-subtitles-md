import type { Cue, Transcript } from '../model';

/**
 * Returns distinct speaker labels in first-appearance order.
 * Cues without a speaker are ignored.
 *
 * @param transcript - The transcript to extract speakers from
 * @returns Array of unique speaker labels in the order they first appear
 */
export function uniqueSpeakers(transcript: Transcript): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const cue of transcript.cues) {
    if (cue.speaker !== undefined && !seen.has(cue.speaker)) {
      seen.add(cue.speaker);
      result.push(cue.speaker);
    }
  }

  return result;
}

/**
 * Groups consecutive cues that share the same speaker.
 * Starts a new group whenever the speaker changes.
 * Undefined speaker values form their own groups.
 *
 * @param cues - Array of cues to group
 * @returns Array of groups, each containing a speaker and their consecutive cues
 */
export function groupConsecutiveBySpeaker(
  cues: Cue[]
): Array<{ speaker?: string; cues: Cue[] }> {
  if (cues.length === 0) {
    return [];
  }

  const groups: Array<{ speaker?: string; cues: Cue[] }> = [];
  let currentGroup: { speaker?: string; cues: Cue[] } = {
    speaker: cues[0]!.speaker,
    cues: [cues[0]!],
  };

  for (let i = 1; i < cues.length; i++) {
    const cue = cues[i]!;
    if (cue.speaker === currentGroup.speaker) {
      currentGroup.cues.push(cue);
    } else {
      groups.push(currentGroup);
      currentGroup = { speaker: cue.speaker, cues: [cue] };
    }
  }

  groups.push(currentGroup);
  return groups;
}
