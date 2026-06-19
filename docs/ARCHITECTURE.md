# Architecture

> Extended architectural context for AI agents. Referenced from AGENTS.md.

---

## Project Structure

> Planned layout — this is a greenfield Obsidian plugin following the official
> `obsidian-sample-plugin` conventions. Update this tree as the codebase grows.

```
obsidian-subtitles-md/
├── src/
│   ├── main.ts                 ← Plugin entry (extends Obsidian Plugin)
│   ├── settings.ts             ← Settings tab + defaults
│   ├── model/                  ← Core types (Transcript, Cue)
│   │   └── index.ts
│   ├── parser/                 ← Subtitle parsers (.srt, .vtt → Transcript)
│   │   ├── srt.ts
│   │   ├── vtt.ts
│   │   └── index.ts            ← Format detection
│   ├── transform/              ← Transcript transformations (pure)
│   │   ├── reflow.ts           ← Reflow cues → readable paragraphs
│   │   └── speakers.ts         ← Speaker handling
│   ├── serialize/              ← Output formatters (pure)
│   │   └── markdown.ts         ← Transcript → Markdown note
│   ├── render/                 ← Reading-optimized rendering (Obsidian)
│   │   ├── codeblock.ts        ← ```transcript``` processor
│   │   ├── postprocess.ts      ← Reading-mode styling
│   │   └── view.ts             ← Custom file view
│   └── commands/               ← Command implementations
│       └── convertToNote.ts    ← "Convert subtitle file → note"
├── tests/                      ← Vitest unit/integration tests
├── docs/                       ← Associated agent documentation
│   └── superpowers/specs/      ← Design specs
├── manifest.json               ← Obsidian plugin manifest (id, version, minAppVersion)
├── versions.json               ← minAppVersion compatibility map
├── esbuild.config.mjs          ← Bundler config (format: 'cjs' → main.js)
├── main.js                     ← GENERATED bundle (do NOT hand-edit)
├── styles.css                  ← Optional plugin styles
├── tsconfig.json               ← module: ESNext, target: ES2021, strict
├── AGENTS.md                   ← Agent instructions (MUST rules)
├── ROADMAP.md                  ← Project phases and plan
├── LICENSE
├── README.md
└── package.json
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bundler | esbuild (`format: 'cjs'`) | Obsidian loads plugins via CommonJS `require()`; esbuild is the official sample-plugin standard |
| Module system | ES module source, CJS bundle | Author with `import`/`export` (`tsconfig` `module: ESNext`); bundle to a single `main.js` |
| Package manager | pnpm | Fast, strict, content-addressed store |
| Linting | ESLint + typescript-eslint + eslint-plugin-obsidianmd | Obsidian-specific rules catch API misuse; no separate formatter needed |
| Unit tests | Vitest | Fast TS-native runner; the `obsidian` module is mocked (no runtime outside the app) |
| E2E tests | wdio-obsidian-service | Drives a real Obsidian instance for end-to-end flows |
| Mobile support | `isDesktopOnly: false` | Avoid Node/Electron-only APIs so the plugin runs on Obsidian mobile |

> Record any new significant decision in [`../DECISIONS.md`](../DECISIONS.md) as an ADR — not here.

## Module Boundaries

**Pure core** (no Obsidian API dependency → unit-testable without mocking):
- `src/model/` — Core types: `Transcript`, `Cue`, shared interfaces.
- `src/parser/` — Subtitle text → `Transcript` objects. Includes `srt.ts`, `vtt.ts`, and `index.ts` (format detection).
- `src/transform/` — `Transcript` transformations: `reflow.ts` (cues → readable paragraphs), `speakers.ts` (speaker handling).
- `src/serialize/` — Output formatters: `markdown.ts` (Transcript → Markdown string).

**Obsidian layer** (depends on Obsidian API):
- `src/main.ts` — Plugin lifecycle (`onload`/`onunload`), command registration, rendering processors, wiring.
- `src/settings.ts` — Settings model + `PluginSettingTab`.
- `src/commands/` — Command implementations: `convertToNote.ts` (reads via Vault API → parse → transform → serialize → write note).
- `src/render/` — Reading-optimized rendering: `codeblock.ts` (` ```transcript ` processor), `postprocess.ts` (reading-mode styling), `view.ts` (custom file view).

> The pure core (`model`/`parser`/`transform`/`serialize`) holds the bulk of logic and requires **no Obsidian mocking**. The Obsidian layer gets light mocks for integration tests + real-app e2e.

## Data Flow

**Phase 1 — Convert to note (searchable):**
1. User runs "Convert subtitle file → transcript note" command.
2. `commands/convertToNote.ts` reads the source file via the **Vault API**.
3. `parser/` detects format and parses `.srt`/`.vtt` → `Transcript` object (model).
4. `transform/reflow` transforms fragmented cues → readable paragraphs (per settings).
5. `serialize/markdown` formats `Transcript` → Markdown string (frontmatter + prose).
6. `commands/convertToNote.ts` writes the resulting sibling note via the **Vault API** → searchable/linkable.

**Phase 2 — Render for reading (visualize):**
1. User opens a ` ```transcript ` code-block, transcript note in reading mode, or `.srt`/`.vtt` file.
2. `render/codeblock.ts` (code-block processor), `render/postprocess.ts` (reading-mode post-processor), or `render/view.ts` (custom file view) reads source content.
3. `parser/` parses → `Transcript`.
4. `transform/reflow` transforms → paragraphs.
5. `render/*` outputs reading-optimized HTML/DOM (styled via `styles.css`).

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Plugin entry point; registers commands, reads settings, orchestrates import |
| `manifest.json` | Plugin identity, version, `minAppVersion`, `isDesktopOnly` |
| `esbuild.config.mjs` | Build config — bundles `src/main.ts` → `main.js` (CJS) |
| `tsconfig.json` | TypeScript compiler options (strict, ESNext modules) |

## Code Patterns

> Greenfield: representative idiomatic patterns (no codebase yet). Prefer pure,
> Obsidian-free logic for parsing/transformation/serialization; isolate API calls
> in `main.ts`, `commands/`, `render/`, and `settings.ts`.

✅ **Good** — pure, named export, testable without Obsidian:
```typescript
// src/model/index.ts
export interface Cue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
}

export interface Transcript {
  cues: Cue[];
  meta: { format: 'srt' | 'vtt'; durationMs: number; cueCount: number; source?: string };
}

// src/parser/srt.ts
export function parseSrt(input: string): Transcript {
  const cues = splitBlocks(input).map(toCue);
  return { cues, meta: { format: 'srt', durationMs: lastCue.endMs, cueCount: cues.length } };
}
```

🚫 **Bad** — couples parsing to the Obsidian API and uses a default export:
```typescript
import { Notice } from 'obsidian';

export default function parse(input: string) {
  new Notice('parsing...');      // side effect in pure logic; blocks unit testing
  // ...
}
```
