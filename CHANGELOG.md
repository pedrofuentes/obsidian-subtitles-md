# Changelog — obsidian-subtitles-md

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

## [0.1.2] - 2026-07-08

### Added

- The "Speaker style: Heading" setting now also applies to the read-only transcript view and the ` ```transcript ` code block (previously it only affected the converted Markdown note): each speaker turn renders as a heading above the paragraph instead of an inline bold label.

### Fixed

- Paragraph reflow now splits on sentence-ending punctuation by default, so continuous dialogue no longer collapses into a single unbroken paragraph in the transcript view and converted notes.
- The read-only transcript file view now honors the "Timestamps" setting's Inline/Aside style (and hides timestamps for "None"), matching the ` ```transcript ` code block. Previously it only supported showing or hiding timestamps and ignored the Aside style entirely.

## [0.1.1] - 2026-06-19

### Added

- Build provenance attestations for release assets (`main.js`, `styles.css`, `manifest.json`), verifiable with `gh attestation verify`.

### Changed

- Plugin description rewritten as an action statement for the community directory listing.

## [0.1.0] - 2026-06-19

### Added

- Subtitle file parsing for `.srt` (SubRip) and `.vtt` (WebVTT) formats.
- Intelligent reflow of fragmented subtitle cues into readable paragraphs.
- Markdown serialization with configurable frontmatter, timestamps (none/inline/aside), and speaker formatting (bold/heading).
- "Convert subtitle file to transcript note" command to create clean Markdown notes from `.srt`/`.vtt` files.
- ` ```transcript ` code-block processor supporting inline subtitle content or `file:` references to vault subtitle files.
- Read-only transcript file view that opens `.srt`/`.vtt` files directly as readable transcripts.
- Settings tab with controls for paragraph grouping (gap threshold, speaker-change breaks, sentence-end breaks), timestamp display, speaker style, and frontmatter inclusion.
