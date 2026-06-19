# Test Fixtures

This directory contains test fixtures for the Subtitles MD plugin's parser and edge-case tests.

## SRT Fixtures (`srt/`)

### `simple.srt`
Basic SRT file with 4 sequential cues using standard `HH:MM:SS,mmm` timestamp format. Tests normal parsing flow.

### `multiline.srt`
Cues containing 2-3 lines of text each. Tests multi-line text handling within individual cues.

### `crlf.srt`
Uses Windows-style CRLF (`\r\n`) line endings. Tests that the parser handles both Unix (LF) and Windows (CRLF) line endings correctly.

### `bom.srt`
Begins with a UTF-8 BOM (byte order mark: `EF BB BF`). Tests that the parser strips the BOM before processing.

### `gaps-and-overlaps.srt`
Contains:
- Non-contiguous timing (gaps between cues)
- One overlapping pair of cues (cue 3 starts before cue 2 ends)

Tests that the parser handles non-ideal timing scenarios gracefully.

### `malformed.srt`
Deliberately broken file with multiple error cases:
- Invalid timestamp arrow (`->` instead of `-->`)
- Missing sequence number
- Malformed timestamp format
- Empty cue text

Tests error handling and recovery paths.

## VTT Fixtures (`vtt/`)

### `simple.vtt`
Basic WebVTT file with proper `WEBVTT` header and simple cues using `HH:MM:SS.mmm` timestamp format. Tests normal VTT parsing.

### `voices.vtt`
Uses `<v Speaker>...</v>` voice tags to identify multiple speakers. Tests extraction of speaker information.

### `cue-settings.vtt`
Contains cues with:
- Optional cue identifiers (e.g., `cue-1`)
- Positioning and alignment settings (`align:start`, `position:10%`, `line:90%`, `size:80%`)

Tests that the parser handles cue settings without breaking text extraction.

### `notes.vtt`
Includes `NOTE` comment blocks between cues. Tests that comments are properly skipped during parsing.

### `bom.vtt`
Begins with a UTF-8 BOM before the `WEBVTT` header. Tests BOM stripping in VTT files.

### `malformed.vtt`
Deliberately broken file with:
- Missing or invalid `WEBVTT` header
- Bad timestamp arrow
- Malformed timestamps
- Empty cue text

Tests VTT error handling and recovery.

## Usage

These fixtures are consumed by parser tests (not included in this commit). Each file exercises specific edge cases to ensure robust subtitle parsing across different formats and error conditions.
