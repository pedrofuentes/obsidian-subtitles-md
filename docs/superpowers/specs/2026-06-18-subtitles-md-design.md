# Subtitles MD — Design Spec

- **Status:** Approved (design) — ready for implementation planning
- **Date:** 2026-06-18
- **Authors:** Pedro Fuentes & Copilot (co-founders)
- **Plugin id:** `obsidian-subtitles-md` · **Display name:** Subtitles MD
- **License:** MIT · **Stack:** TypeScript, pnpm, esbuild (CJS bundle), ESLint + eslint-plugin-obsidianmd, Vitest, wdio-obsidian-service

## 1. Summary

An Obsidian plugin to **read `.srt`/`.vtt` transcripts comfortably** inside Obsidian and make
their text **first-class, searchable/linkable vault content**. It targets the case where you
already have a transcript of some audio/talk and simply want to *read* it — **no media playback**.

## 2. Problem & competitive gap

Surveyed the 4,904-plugin community directory + web. Findings:
- **Dozens** of plugins *generate* transcripts from audio (Whisper/AI, YouTube fetchers, meeting sync) — different problem.
- Plugins that *display* existing subtitle files are either a **bolt-on cue-list viewer** (File Viewer's transcript mode — timestamped lines, searchable only inside its own view) or **sync-playback** tools (Recording Transcript Player, media-subtitle) that require paired media.
- **Gap:** no focused, *reading-first* plugin that renders a transcript as clean **prose** AND makes its text **native, searchable vault content**. That is this plugin.

## 3. Goals / non-goals

**Goals**
- Parse `.srt` and `.vtt` reliably (incl. adversarial inputs).
- Turn fragmented cues into readable paragraphs.
- Make transcript text searchable/linkable (native Markdown).
- Provide a reading-optimized rendering (visualize) without forcing conversion.
- Ship as an open-source community plugin; desktop + mobile (`isDesktopOnly: false`).

**Non-goals**
- No audio/video playback or subtitle↔media synchronization (covered by other plugins).
- No transcript *generation* (no ASR/Whisper/AI).
- No editing of the source `.srt`/`.vtt` files.

## 4. Users & use cases

- Researcher/student with lecture or interview transcripts wanting to read + annotate + link them.
- Podcast/talk note-taker with exported captions wanting searchable text in their vault.
- Anyone handed a `.srt`/`.vtt` who wants a clean read, not raw timecodes.

## 5. Product scope (phased)

**Phase 1 — Parser core + convert-to-Markdown (MVP).**
Parse → normalized `Transcript` → reflow cues into readable paragraphs → serialize to a clean
Markdown note (frontmatter metadata + prose; timestamps as subtle markers). Command:
**"Convert subtitle file → transcript note."** Output note is native → searchable/linkable.

**Phase 2 — Reading-optimized rendering (visualize).**
A ` ```transcript ` code-block processor (reference a file or inline content) renders a
reading-optimized transcript in Live Preview/reading mode; a reading-mode post-processor styles
transcript notes; an optional **custom file view** opens `.srt`/`.vtt` directly as readable text.

**Phase 3 — Polish + distribution.**
Settings (timestamp display none/inline/aside, paragraph grouping, target folder, filename
template, speaker handling), batch/folder import, edge-case hardening, README + community
plugin submission (manifest/versions, screenshots, release workflow).

## 6. Architecture

Keep Obsidian-free logic **pure and unit-testable**; isolate the Obsidian API in a thin layer.

```
src/model/      Transcript, Cue, types                 (pure)
src/parser/     srt.ts, vtt.ts, index.ts (detect)      (pure)
src/transform/  reflow.ts, speakers.ts                 (pure)
src/serialize/  markdown.ts                            (pure)
src/render/     codeblock.ts, postprocess.ts, view.ts  (Obsidian)
src/commands/   convertToNote.ts                       (Obsidian)
src/settings.ts                                        (Obsidian)
src/main.ts     plugin entry / registration            (Obsidian)
```

The pure core (`model`/`parser`/`transform`/`serialize`) holds the bulk of logic and requires
**no Obsidian mocking**. The Obsidian layer (`render`/`commands`/`settings`/`main`) gets light
mocks for integration tests + real-app e2e.

## 7. Data model

```ts
interface Cue {
  index: number;      // 1-based source order
  startMs: number;    // ms from start
  endMs: number;      // ms from start
  text: string;       // cleaned cue text (tags stripped/normalized)
  speaker?: string;   // from VTT <v Speaker> when present
}

interface Transcript {
  cues: Cue[];
  meta: { format: 'srt' | 'vtt'; durationMs: number; cueCount: number; source?: string };
}
```

## 8. Data flow

```
run command / open block/view
  → read source text (Vault API / block content)
  → parser.detect+parse → Transcript
  → transform.reflow (per settings) → paragraphs
  → (a) serialize.markdown → write sibling .md note (searchable)   [P1]
  or (b) render → reading-optimized view/code-block               [P2]
```

## 9. Error handling

- Parsers return **typed results**; never throw into the Obsidian UI.
- Malformed cues are skipped and reported (parse what's valid); surface a clear `Notice`.
- Handle BOM / UTF-8 / CRLF; detect unknown/empty input explicitly.
- Conversion is **non-destructive** (sibling note; never overwrite silently — suffix or prompt).
- Large files: iterate; virtualize rendering in Phase 3 if needed.

## 10. Testing strategy (TDD — Sentinel-enforced)

- **Unit (Vitest):** parser (srt/vtt incl. multi-line, voice tags, cue settings, BOM, malformed),
  transform (reflow strategies), serialize (golden-file Markdown). Pure core targets ≥ 80% (gate).
- **Integration:** convert command writes the correct note (mock Vault); code-block processor
  output (mock `MarkdownPostProcessorContext`).
- **E2E (wdio-obsidian-service):** load the plugin in real Obsidian; run convert on a fixture and
  assert the note; open a transcript block/view and assert the DOM.
- **Fixtures:** `tests/fixtures/` — representative + adversarial `.srt`/`.vtt`.
- Every behavior: **failing test first (RED) → minimal impl (GREEN)**; Sentinel verifies ordering.

## 11. Build & distribution

- esbuild bundles `src/main.ts` → CJS `main.js` (Obsidian's loader requires CommonJS).
- GitHub Actions: install → lint → typecheck → test+coverage(80) → build. Release workflow on tag
  builds and uploads `main.js`/`manifest.json`/`styles.css` to the GitHub release.
- Submit to `obsidianmd/obsidian-releases` once stable (manifest, versions.json, screenshots).

## 12. The sub-agent "company" (mapped to agents-template)

Every implementer works in an isolated **git worktree**, opens a **PR**, then **stops**; an
**independent** agent (never the author) invokes **Sentinel** before merge (TDD ordering, tests
green, coverage ratchet, security/quality dimensions). All enforced by branch protection on `main`.

- **Coordinator/CEO (this session):** decompose → `todos`+`todo_deps`, spawn managers, run parallel
  worktrees, invoke Sentinel per PR as the independent reviewer, verify merges, escalate
  HUMAN-REQUIRED items to Pedro. Driven via the `sentinel-project-coordinator` skill.
- **Managers (own a vertical slice; may spawn their own workers):**
  - **M1 Parsing & Model** (foundation): `model`, `parser/srt`, `parser/vtt`, `detect`.
  - **M2 Transform & Serialize + convert command**: `reflow`, `speakers`, `serialize`, convert cmd, P1 wiring.
  - **M3 Rendering & View**: code-block processor, post-processor, file view, styles, P2 wiring.
  - **M4 Settings, Build, CI/Release, Docs**: settings, scaffold, CI/release, README/submission.
  - **M5 QA & E2E**: fixtures, e2e harness + flows, edge-case hunting, cross-cutting audits.
- **Workers:** focused TDD implementers (one test→impl unit), research workers (docs.obsidian.md), doc writers.
- **Sentinel:** spawned per-PR, independent of the author.

**Parallelism:** `t-scaffold` first; then M1 `t-model`; after the model lands, parsers/transform/
fixtures/e2e-harness run in parallel; M4 infra (CI/release) runs alongside from the start.
Sequencing is encoded in `todo_deps`.

## 13. Task graph

24 PR-sized tasks tracked in the session DB (`todos`/`todo_deps`), grouped P1→P3 across M1–M5.
Entry points: `t-scaffold`, `t-spec-roadmap`. See the live task graph for current ready/blocked state.

## 14. Definition of done

All phases merged via Sentinel-approved PRs · ≥ 80% coverage on the pure core · unit+integration+e2e
green · lint clean · `pnpm build` → loadable `main.js` · verified in a real Obsidian vault · README +
community-submission artifacts ready.

## 15. Defaults & open decisions

- Display name **"Subtitles MD"**; timestamps shown as **subtle inline markers** (toggleable in P3).
- Convert writes a **sibling `.md`** note (non-destructive).
- Formats: `.srt` + `.vtt` to start; `.ass`/`.sbv` deferred unless requested.
- The agreed stack (above) is pre-approved; **new** dependencies beyond it follow AGENTS.md ASK-FIRST.
