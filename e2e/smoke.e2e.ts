import { browser, expect } from '@wdio/globals';
import { describe, it } from 'mocha';

describe('Subtitles MD smoke test', function () {
  it('installs, enables, and loads the plugin', async function () {
    const status = await browser.executeObsidian(({ app }) => {
      // `app.plugins` is an internal Obsidian API used only here in e2e tests,
      // never in the shipped plugin source. The function body is serialized and
      // run inside Obsidian, so the plugin id must be inlined as a literal.
      const plugins = (app as unknown as {
        plugins: {
          enabledPlugins: Set<string>;
          plugins: Record<string, unknown>;
        };
      }).plugins;

      return {
        enabled: plugins.enabledPlugins.has('subtitles-md'),
        loaded: Object.prototype.hasOwnProperty.call(plugins.plugins, 'subtitles-md'),
      };
    });

    expect(status.enabled).toBe(true);
    expect(status.loaded).toBe(true);
  });
});
