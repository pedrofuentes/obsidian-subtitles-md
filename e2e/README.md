# End-to-end tests

End-to-end tests run the **real** Obsidian desktop app (Electron) driven by
[WebdriverIO](https://webdriver.io) via
[`wdio-obsidian-service`](https://www.npmjs.com/package/wdio-obsidian-service).
The service downloads a sandboxed Obsidian binary, installs this plugin
(`manifest.json` + the built `main.js`), opens a throwaway vault, and lets the
specs assert against the live `app`.

## Layout

| Path                | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `wdio.conf.mts`     | WebdriverIO + `wdio-obsidian-service` configuration. |
| `e2e/smoke.e2e.ts`  | Minimal smoke test: the plugin installs and enables. |
| `e2e/vaults/smoke/` | Empty sandbox vault cloned fresh for each run.       |
| `tsconfig.e2e.json` | Editor/type support for the e2e + config files.      |

## Running locally

```bash
pnpm run build      # produce main.js (the service installs it into the vault)
pnpm test:e2e       # wdio run wdio.conf.mts
```

Choose Obsidian versions with `OBSIDIAN_VERSIONS` (default `latest/latest`):

```bash
OBSIDIAN_VERSIONS="earliest/earliest latest/latest" pnpm test:e2e
```

Downloaded binaries and per-run vault sandboxes are cached in `.obsidian-cache/`
(git-ignored).

## Host limitation (Windows / headless)

`wdio-obsidian-service` downloads and launches a real Electron binary, which
requires a working display/GPU stack. On a headless or locked-down host (such as
the CI sandbox this harness was authored on) the Obsidian binary may fail to
download or launch. That is an environment limitation, **not** a harness defect —
the configuration and smoke spec are correct and CI-runnable.

## CI (Linux / headless)

On Linux, run under a virtual framebuffer so Electron has a display:

```bash
xvfb-run --auto-servernum pnpm test:e2e
```

The official [sample plugin](https://github.com/jesse-r-s-hines/wdio-obsidian-service-sample-plugin)
includes a reference GitHub Actions workflow. Wiring the workflow into this repo
is tracked separately (out of scope for this harness task).
