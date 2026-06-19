# Changelog — obsidian-subtitles-md

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Subtitle file parsing for `.srt` (SubRip) and `.vtt` (WebVTT) formats.
- Intelligent reflow of fragmented subtitle cues into readable paragraphs.
- Markdown serialization with configurable frontmatter, timestamps (none/inline/aside), and speaker formatting (bold/heading).
- "Convert subtitle file to transcript note" command to create clean Markdown notes from `.srt`/`.vtt` files.
- ` ```transcript ` code-block processor supporting inline subtitle content or `file:` references to vault subtitle files.
- Read-only transcript file view that opens `.srt`/`.vtt` files directly as readable transcripts.
- Settings tab with controls for paragraph grouping (gap threshold, speaker-change breaks, sentence-end breaks), timestamp display, speaker style, and frontmatter inclusion.

### Changed

### Fixed

### Removed
