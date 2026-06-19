# Test Vault for Subtitles MD

This is a demo Obsidian vault for testing the **Subtitles MD** plugin.

## Quick Start

1. From the repository root, run:
   ```bash
   pnpm install:vault
   ```
   This builds the plugin and installs it into this vault (defaults to `test-vault/`).

2. Open this folder (`test-vault/`) as an Obsidian vault.

3. Reload Obsidian with `Ctrl+R` or restart the app.

4. Enable **Subtitles MD** in Settings → Community plugins.

## What to Try

- **Click on subtitle files**: Open `Recordings/talk.srt` or `Recordings/lecture.vtt` to see them rendered as readable Markdown
- **Convert subtitle files**: Run the command "Convert subtitle file to transcript note" from the command palette
- **View transcript blocks**: Open `Demo.md` in reading view to see the embedded transcript blocks render
- **Tweak settings**: Go to Settings → Subtitles MD to customize timestamp format, speaker display, and paragraph breaks

## Sample Content

- `Recordings/talk.srt` — Multi-speaker conversation with speaker labels
- `Recordings/lecture.vtt` — WebVTT format with `<v Speaker>` voice tags
- `Demo.md` — Example note with both file-based and inline transcript blocks
