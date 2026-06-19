import * as path from 'path';
import { env } from 'process';
import { parseObsidianVersions } from 'wdio-obsidian-service';

/**
 * Standalone WebdriverIO config for the screenshot **capture** harness.
 *
 * This is deliberately separate from `wdio.conf.mts` (the e2e harness):
 *   - Its `specs` glob (`./e2e/capture/*.capture.ts`) is NOT matched by the e2e
 *     config's `./e2e/**\/*.e2e.ts`, so `pnpm test:e2e` never runs capture.
 *   - It is wired to its own `pnpm capture` script, never to `test`/`test:e2e`
 *     or CI, because capturing real screenshots is slow and display-dependent.
 *
 * It reuses the same `wdio-obsidian-service` setup as the e2e harness: it
 * launches the real Obsidian desktop app, installs this plugin from the repo
 * root (`manifest.json` + the built `main.js`), and opens a throwaway clone of
 * the `e2e/vaults/smoke` sandbox vault. The capture spec drives Obsidian via
 * `browser.executeObsidian(...)` and saves PNGs with `browser.saveScreenshot`.
 */

// wdio-obsidian-service downloads and caches Obsidian binaries here (gitignored).
const cacheDir = path.resolve('.obsidian-cache');

// Pin to a known-good desktop release that launches on this Windows host so the
// captured screenshots are deterministic; override with OBSIDIAN_VERSIONS.
const versions = await parseObsidianVersions(env.OBSIDIAN_VERSIONS ?? '1.12.7/1.12.7', {
  cacheDir,
});

export const config: WebdriverIO.Config = {
  runner: 'local',
  framework: 'mocha',

  // A spec suffix the e2e config's `./e2e/**/*.e2e.ts` glob never matches.
  specs: ['./e2e/capture/*.capture.ts'],

  // Screenshots must come from a single, deterministic Obsidian instance.
  maxInstances: 1,

  capabilities: versions.map<WebdriverIO.Capabilities>(([appVersion, installerVersion]) => ({
    browserName: 'obsidian',
    'wdio:obsidianOptions': {
      appVersion,
      installerVersion,
      // Install this plugin (reads manifest.json + the built main.js) from the repo root.
      plugins: ['.'],
      // A throwaway sandbox vault is cloned per run, so it never touches the host.
      vault: 'e2e/vaults/smoke',
    },
  })),

  services: ['obsidian'],
  // obsidian-reporter wraps spec-reporter but shows the Obsidian version per run.
  reporters: ['obsidian'],

  mochaOpts: {
    ui: 'bdd',
    // Capturing involves rendering + paint settling + disk writes, so give each
    // surface generous head-room over the 60s used by the e2e specs.
    timeout: 120 * 1000,
  },

  waitforInterval: 250,
  waitforTimeout: 10 * 1000,
  logLevel: 'warn',

  cacheDir,

  // Import describe/it/expect explicitly in specs instead of relying on globals.
  injectGlobals: false,
};
