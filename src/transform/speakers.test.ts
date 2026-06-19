import { describe, expect, test } from 'vitest';
import type { Cue, Transcript } from '../model';
import { uniqueSpeakers, groupConsecutiveBySpeaker } from './speakers';

describe('uniqueSpeakers', () => {
  test('returns empty array for transcript with no cues', () => {
    const transcript: Transcript = {
      cues: [],
      meta: { format: 'srt', durationMs: 0, cueCount: 0 },
    };
    expect(uniqueSpeakers(transcript)).toEqual([]);
  });

  test('returns empty array for transcript with no speakers', () => {
    const transcript: Transcript = {
      cues: [
        { index: 1, startMs: 0, endMs: 1000, text: 'Hello' },
        { index: 2, startMs: 1000, endMs: 2000, text: 'World' },
      ],
      meta: { format: 'srt', durationMs: 2000, cueCount: 2 },
    };
    expect(uniqueSpeakers(transcript)).toEqual([]);
  });

  test('returns single speaker', () => {
    const transcript: Transcript = {
      cues: [
        { index: 1, startMs: 0, endMs: 1000, text: 'Hello', speaker: 'Alice' },
        { index: 2, startMs: 1000, endMs: 2000, text: 'World', speaker: 'Alice' },
      ],
      meta: { format: 'vtt', durationMs: 2000, cueCount: 2 },
    };
    expect(uniqueSpeakers(transcript)).toEqual(['Alice']);
  });

  test('returns distinct speakers in first-appearance order', () => {
    const transcript: Transcript = {
      cues: [
        { index: 1, startMs: 0, endMs: 1000, text: 'Hi', speaker: 'Alice' },
        { index: 2, startMs: 1000, endMs: 2000, text: 'Hello', speaker: 'Bob' },
        { index: 3, startMs: 2000, endMs: 3000, text: 'Hey', speaker: 'Alice' },
        { index: 4, startMs: 3000, endMs: 4000, text: 'Yo', speaker: 'Charlie' },
      ],
      meta: { format: 'vtt', durationMs: 4000, cueCount: 4 },
    };
    expect(uniqueSpeakers(transcript)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('ignores cues without speakers', () => {
    const transcript: Transcript = {
      cues: [
        { index: 1, startMs: 0, endMs: 1000, text: 'Narration' },
        { index: 2, startMs: 1000, endMs: 2000, text: 'Hi', speaker: 'Alice' },
        { index: 3, startMs: 2000, endMs: 3000, text: 'More narration' },
        { index: 4, startMs: 3000, endMs: 4000, text: 'Hello', speaker: 'Bob' },
      ],
      meta: { format: 'vtt', durationMs: 4000, cueCount: 4 },
    };
    expect(uniqueSpeakers(transcript)).toEqual(['Alice', 'Bob']);
  });
});

describe('groupConsecutiveBySpeaker', () => {
  test('returns empty array for no cues', () => {
    expect(groupConsecutiveBySpeaker([])).toEqual([]);
  });

  test('groups single cue', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 1000, text: 'Hello', speaker: 'Alice' },
    ];
    expect(groupConsecutiveBySpeaker(cues)).toEqual([
      { speaker: 'Alice', cues },
    ]);
  });

  test('groups consecutive cues with same speaker', () => {
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 1000, text: 'Hello', speaker: 'Alice' },
      { index: 2, startMs: 1000, endMs: 2000, text: 'World', speaker: 'Alice' },
      { index: 3, startMs: 2000, endMs: 3000, text: 'There', speaker: 'Alice' },
    ];
    expect(groupConsecutiveBySpeaker(cues)).toEqual([
      { speaker: 'Alice', cues },
    ]);
  });

  test('starts new group when speaker changes', () => {
    const cue1 = { index: 1, startMs: 0, endMs: 1000, text: 'Hi', speaker: 'Alice' };
    const cue2 = { index: 2, startMs: 1000, endMs: 2000, text: 'Hello', speaker: 'Bob' };
    const cue3 = { index: 3, startMs: 2000, endMs: 3000, text: 'Hey', speaker: 'Alice' };
    
    expect(groupConsecutiveBySpeaker([cue1, cue2, cue3])).toEqual([
      { speaker: 'Alice', cues: [cue1] },
      { speaker: 'Bob', cues: [cue2] },
      { speaker: 'Alice', cues: [cue3] },
    ]);
  });

  test('treats undefined speaker as its own value', () => {
    const cue1 = { index: 1, startMs: 0, endMs: 1000, text: 'Narration' };
    const cue2 = { index: 2, startMs: 1000, endMs: 2000, text: 'More narration' };
    const cue3 = { index: 3, startMs: 2000, endMs: 3000, text: 'Hi', speaker: 'Alice' };
    
    expect(groupConsecutiveBySpeaker([cue1, cue2, cue3])).toEqual([
      { speaker: undefined, cues: [cue1, cue2] },
      { speaker: 'Alice', cues: [cue3] },
    ]);
  });

  test('handles alternating speakers with undefined', () => {
    const cue1 = { index: 1, startMs: 0, endMs: 1000, text: 'Hi', speaker: 'Alice' };
    const cue2 = { index: 2, startMs: 1000, endMs: 2000, text: 'Narration' };
    const cue3 = { index: 3, startMs: 2000, endMs: 3000, text: 'Hello', speaker: 'Bob' };
    const cue4 = { index: 4, startMs: 3000, endMs: 4000, text: 'More narration' };
    
    expect(groupConsecutiveBySpeaker([cue1, cue2, cue3, cue4])).toEqual([
      { speaker: 'Alice', cues: [cue1] },
      { speaker: undefined, cues: [cue2] },
      { speaker: 'Bob', cues: [cue3] },
      { speaker: undefined, cues: [cue4] },
    ]);
  });

  test('handles complex pattern with mixed defined and undefined speakers', () => {
    const cue1 = { index: 1, startMs: 0, endMs: 1000, text: 'Start' };
    const cue2 = { index: 2, startMs: 1000, endMs: 2000, text: 'Hi', speaker: 'Alice' };
    const cue3 = { index: 3, startMs: 2000, endMs: 3000, text: 'Hello', speaker: 'Alice' };
    const cue4 = { index: 4, startMs: 3000, endMs: 4000, text: 'Middle' };
    const cue5 = { index: 5, startMs: 4000, endMs: 5000, text: 'Hey', speaker: 'Bob' };
    const cue6 = { index: 6, startMs: 5000, endMs: 6000, text: 'End' };
    
    expect(groupConsecutiveBySpeaker([cue1, cue2, cue3, cue4, cue5, cue6])).toEqual([
      { speaker: undefined, cues: [cue1] },
      { speaker: 'Alice', cues: [cue2, cue3] },
      { speaker: undefined, cues: [cue4] },
      { speaker: 'Bob', cues: [cue5] },
      { speaker: undefined, cues: [cue6] },
    ]);
  });
});
