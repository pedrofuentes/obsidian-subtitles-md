import * as path from 'path';
import { env } from 'process';
import { parseObsidianVersions } from 'wdio-obsidian-service';

// wdio-obsidian-service downloads and caches Obsidian binaries here.
const cacheDir = path.resolve('.obsidian-cache');

// Which Obsidian versions to run the smoke test against. Defaults to a recent
// desktop release; override with OBSIDIAN_VERSIONS (e.g. "earliest/earliest latest/latest").
const versions = await parseObsidianVersions(env.OBSIDIAN_VERSIONS ?? 'latest/latest', {
  cacheDir,
});

export const config: WebdriverIO.Config = {
  runner: 'local',
  framework: 'mocha',

  specs: ['./e2e/**/*.e2e.ts'],

  // How many Obsidian instances to launch in parallel.
  maxInstances: Number(env.WDIO_MAX_INSTANCES || 1),

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
    timeout: 60 * 1000,
  },

  waitforInterval: 250,
  waitforTimeout: 5 * 1000,
  logLevel: 'warn',

  cacheDir,

  // Import describe/it/expect explicitly in specs instead of relying on globals.
  injectGlobals: false,
};
