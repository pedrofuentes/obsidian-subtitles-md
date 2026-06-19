# Roadmap — obsidian-subtitles-md

> Project phases, milestones, and implementation plan.
> **Draft** — a starting point inferred from the project goal; refine as priorities firm up.

## Current Phase

**Phase 0 — Project setup.** Repository initialized and agents-template configured.
No source code yet; next up is scaffolding the plugin and the Phase 1 MVP.

## Phases

### Phase 1: Core import (MVP)
- Scaffold the plugin: `manifest.json`, `esbuild.config.mjs`, `tsconfig.json`, `src/main.ts` skeleton
- `.srt` parser → normalized cue objects
- Cue → Markdown converter
- "Import subtitle file" command: pick a file, write a Markdown note via the Vault API

### Phase 2: Formats & options
- `.vtt` parser (including basic cue settings/positioning handled gracefully)
- Settings tab: timestamp format, target folder, note naming, output style (callouts vs. plain text)
- Robust handling of malformed/edge-case subtitle files

### Phase 3: UX & distribution
- Drag-and-drop / ribbon-icon import entry points
- Mobile verification (`isDesktopOnly: false`)
- End-to-end tests with `wdio-obsidian-service`
- Submit to the Obsidian community plugin registry

## Key Milestones

| Milestone | Phase | Status |
|-----------|-------|--------|
| Import a `.srt` file as a Markdown note | Phase 1 | pending |
| `.vtt` support + configurable output | Phase 2 | pending |
| Community-plugin release | Phase 3 | pending |
