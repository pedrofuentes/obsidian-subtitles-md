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
│   ├── parser/                 ← Subtitle parsers (.srt, .vtt → cues)
│   │   ├── srt.ts
│   │   └── vtt.ts
│   └── convert/                ← Cue → Markdown rendering
│       └── markdown.ts
├── tests/                      ← Vitest unit/integration tests
├── docs/                       ← Associated agent documentation
├── manifest.json               ← Obsidian plugin manifest (id, version, minAppVersion)
├── versions.json               ← minAppVersion compatibility map
├── esbuild.config.mjs          ← Bundler config (format: 'cjs' → main.js)
├── main.js                     ← GENERATED bundle (do NOT hand-edit)
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

- `src/main.ts` — Obsidian lifecycle (`onload`/`onunload`), command registration, wiring. Depends on `parser/` and `convert/`.
- `src/parser/` — Pure functions: subtitle text → normalized cue objects. **No Obsidian API dependency** (keeps it unit-testable).
- `src/convert/` — Pure functions: cues → Markdown string. **No Obsidian API dependency.**
- `src/settings.ts` — Settings model + `PluginSettingTab`. Depends on the Obsidian API.

> Keep parsing/conversion logic free of the Obsidian API so it can be tested without mocking the app. `main.ts` and `settings.ts` are the only Obsidian-coupled modules.

## Data Flow

1. User invokes the import command (or drops a subtitle file).
2. `main.ts` reads the source file via the **Vault API**.
3. `parser/` parses `.srt`/`.vtt` → cue objects (timestamps + text).
4. `convert/` renders cues → Markdown.
5. `main.ts` writes the resulting note via the **Vault API**.

## Key Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Plugin entry point; registers commands, reads settings, orchestrates import |
| `manifest.json` | Plugin identity, version, `minAppVersion`, `isDesktopOnly` |
| `esbuild.config.mjs` | Build config — bundles `src/main.ts` → `main.js` (CJS) |
| `tsconfig.json` | TypeScript compiler options (strict, ESNext modules) |

## Code Patterns

> Greenfield: representative idiomatic patterns (no codebase yet). Prefer pure,
> Obsidian-free logic for parsing/conversion; isolate API calls in `main.ts`.

✅ **Good** — pure, named export, testable without Obsidian:
```typescript
export interface Cue { start: number; end: number; text: string; }

export function parseSrt(input: string): Cue[] {
  return splitBlocks(input).map(toCue);
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
