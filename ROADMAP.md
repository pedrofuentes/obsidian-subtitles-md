# Roadmap — obsidian-subtitles-md

> Project phases, milestones, and implementation plan.
> Aligned to the **Subtitles MD** design spec (2026-06-18) — a reading-first transcript plugin.

## Current Phase

**Phase 0 — Project setup.** Repository initialized, agents-template configured, design spec approved.
No source code yet; next up is scaffolding the plugin and the Phase 1 MVP.

## Phases

### Phase 1: Parser core + convert-to-Markdown (MVP)
Parse `.srt`/`.vtt` → normalized `Transcript` model → reflow fragmented cues into readable paragraphs → serialize to a clean Markdown note (frontmatter metadata + prose; timestamps as subtle markers). Command: **"Convert subtitle file → transcript note."** Output note is native → searchable/linkable vault content.

**Deliverables:**
- Scaffold: `manifest.json`, `esbuild.config.mjs`, `tsconfig.json`, `package.json`, `src/main.ts`
- Pure core: `model/` (Transcript, Cue), `parser/` (srt.ts, vtt.ts, detect), `transform/` (reflow.ts), `serialize/` (markdown.ts)
- Obsidian layer: `commands/convertToNote.ts`, wiring in `main.ts`
- Unit + integration tests (Vitest); ≥80% coverage on pure core

### Phase 2: Reading-optimized rendering
Visualize transcripts without forcing conversion. A ` ```transcript ` code-block processor (reference a file or inline content) renders reading-optimized transcripts in Live Preview/reading mode; a reading-mode post-processor styles transcript notes; an optional **custom file view** opens `.srt`/`.vtt` directly as readable text.

**Deliverables:**
- `render/codeblock.ts` — ` ```transcript ` processor
- `render/postprocess.ts` — reading-mode styling for transcript notes
- `render/view.ts` — optional custom file view for `.srt`/`.vtt`
- `styles.css` — reading-optimized layout (timestamps, paragraphs)
- E2E tests (wdio-obsidian-service) for rendering flows

### Phase 3: Polish + distribution
Settings, batch/folder import, edge-case hardening, community submission.

**Deliverables:**
- Settings tab: timestamp display (none/inline/aside), paragraph grouping, target folder, filename template, speaker handling
- Batch/folder import UI
- Edge-case hardening (BOM, CRLF, malformed cues, large files)
- README with screenshots + usage guide
- Community plugin submission artifacts: `manifest.json`, `versions.json`, release workflow
- Mobile verification (`isDesktopOnly: false`)

## Key Milestones

| Milestone | Phase | Status |
|-----------|-------|--------|
| Convert a `.srt` into a readable, searchable note | Phase 1 | pending |
| Live transcript rendering (code-blocks + file views) | Phase 2 | pending |
| Community plugin release | Phase 3 | pending |
