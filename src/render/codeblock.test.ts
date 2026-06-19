import { describe, expect, it, vi } from 'vitest';
import type { App, Plugin } from 'obsidian';
import {
  registerTranscriptCodeBlock,
  renderTranscriptBlock,
} from './codeblock';

/**
 * The shared `tests/mocks/obsidian.mjs` stub only exports `normalizePath`. The
 * code-block renderer additionally needs a `TFile` value (for `instanceof`
 * checks). Mock the module inline for this file only so we don't touch the
 * shared stub or `vitest.config.ts` (owned by parallel tasks).
 */
vi.mock('obsidian', () => {
  class TFile {
    path = '';
    name = '';
    basename = '';
    extension = '';
  }
  class TFolder {
    path = '';
    children: unknown[] = [];
  }
  return {
    TFile,
    TFolder,
    normalizePath: (p: string): string =>
      p
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/(^\/+)|(\/+$)/g, ''),
  };
});

// Imported after vi.mock so we get the mocked class instance.
import { TFile } from 'obsidian';

/**
 * A minimal stand-in for an Obsidian-augmented `HTMLElement`. It records the
 * element tree built via `createEl`/`createDiv`/`createSpan` and exposes only
 * `textContent`, so we can assert structure AND prove untrusted cue text only
 * ever reaches the DOM as a text node. The `innerHTML` setter throws to catch
 * any accidental HTML injection in the renderer.
 */
interface ElInfo {
  cls?: string | string[];
  text?: string;
}

class FakeEl {
  readonly tag: string;
  readonly classList: string[] = [];
  readonly children: FakeEl[] = [];
  private texts: string[] = [];

  constructor(tag = 'div') {
    this.tag = tag;
  }

  private addCls(cls: string | string[]): void {
    const parts = Array.isArray(cls) ? cls : cls.split(/\s+/);
    for (const c of parts) {
      if (c) {
        this.classList.push(c);
      }
    }
  }

  private apply(o?: ElInfo | string): void {
    if (o === undefined) {
      return;
    }
    if (typeof o === 'string') {
      this.addCls(o);
      return;
    }
    if (o.cls !== undefined) {
      this.addCls(o.cls);
    }
    if (o.text !== undefined) {
      this.texts = [o.text];
    }
  }

  empty(): void {
    this.children.length = 0;
    this.texts = [];
  }

  createEl(tag: string, o?: ElInfo | string): FakeEl {
    const child = new FakeEl(tag);
    child.apply(o);
    this.children.push(child);
    return child;
  }

  createDiv(o?: ElInfo | string): FakeEl {
    return this.createEl('div', o);
  }

  createSpan(o?: ElInfo | string): FakeEl {
    return this.createEl('span', o);
  }

  appendText(val: string): void {
    this.texts.push(val);
  }

  get textContent(): string {
    return (
      this.texts.join('') + this.children.map((c) => c.textContent).join('')
    );
  }

  set textContent(val: string) {
    this.texts = [val];
    this.children.length = 0;
  }

  // Adversarial guard: the renderer must never assign HTML.
  set innerHTML(_value: string) {
    throw new Error('innerHTML must not be used by the transcript renderer');
  }

  get innerHTML(): string {
    return '';
  }

  hasClass(cls: string): boolean {
    return this.classList.includes(cls);
  }

  descendants(): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (n: FakeEl): void => {
      out.push(n);
      n.children.forEach(walk);
    };
    this.children.forEach(walk);
    return out;
  }

  findByClass(cls: string): FakeEl[] {
    return this.descendants().filter((n) => n.hasClass(cls));
  }
}

function makeEl(): { el: HTMLElement; fake: FakeEl } {
  const fake = new FakeEl();
  return { el: fake as unknown as HTMLElement, fake };
}

/** App whose vault resolves a single in-memory file at `path`. */
function makeFileApp(path: string, content: string | null): App {
  const file =
    content === null ? null : Object.assign(new TFile(), { path, name: path });
  const vault = {
    getAbstractFileByPath: (p: string): unknown =>
      file !== null && p === path ? file : null,
    read: (f: unknown): Promise<string> =>
      Promise.resolve(f === file && content !== null ? content : ''),
  };
  return { vault } as unknown as App;
}

const NOOP_APP = {} as unknown as App;

const SRT_FIXTURE = [
  '1',
  '00:00:01,000 --> 00:00:02,000',
  'Hello world',
  '',
  '2',
  '00:00:10,000 --> 00:00:11,000',
  'Second cue',
  '',
].join('\n');

const VTT_SPEAKER_FIXTURE = [
  'WEBVTT',
  '',
  '00:00:05.000 --> 00:00:07.000',
  '<v Alice>Good morning everyone',
  '',
].join('\n');

describe('renderTranscriptBlock', () => {
  it('renders inline subtitle content as a structured, readable transcript', async () => {
    const { el, fake } = makeEl();

    await renderTranscriptBlock(SRT_FIXTURE, el, { app: NOOP_APP });

    const container = fake.children[0];
    expect(container?.hasClass('subtitles-md-transcript')).toBe(true);

    const paragraphs = fake.findByClass('subtitles-md-paragraph');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.textContent).toContain('Hello world');
    expect(paragraphs[1]?.textContent).toContain('Second cue');
  });

  it('renders an inline timestamp by default', async () => {
    const { el, fake } = makeEl();

    await renderTranscriptBlock(SRT_FIXTURE, el, { app: NOOP_APP });

    const stamps = fake.findByClass('subtitles-md-timestamp');
    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps[0]?.textContent).toBe('[00:00:01]');
  });

  it('omits the timestamp span when timestamps is "none"', async () => {
    const { el, fake } = makeEl();

    await renderTranscriptBlock(SRT_FIXTURE, el, {
      app: NOOP_APP,
      timestamps: 'none',
    });

    expect(fake.findByClass('subtitles-md-timestamp')).toHaveLength(0);
  });

  it('marks aside timestamps with a modifier class', async () => {
    const { el, fake } = makeEl();

    await renderTranscriptBlock(SRT_FIXTURE, el, {
      app: NOOP_APP,
      timestamps: 'aside',
    });

    const stamps = fake.findByClass('subtitles-md-timestamp');
    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps[0]?.hasClass('subtitles-md-timestamp--aside')).toBe(true);
  });

  it('renders a speaker label as a span when speaker is enabled', async () => {
    const { el, fake } = makeEl();

    await renderTranscriptBlock(VTT_SPEAKER_FIXTURE, el, {
      app: NOOP_APP,
      speaker: true,
    });

    const speakers = fake.findByClass('subtitles-md-speaker');
    expect(speakers).toHaveLength(1);
    expect(speakers[0]?.textContent).toBe('Alice');
  });

  it('omits the speaker span when speaker is disabled', async () => {
    const { el, fake } = makeEl();

    await renderTranscriptBlock(VTT_SPEAKER_FIXTURE, el, {
      app: NOOP_APP,
      speaker: false,
    });

    expect(fake.findByClass('subtitles-md-speaker')).toHaveLength(0);
    // The speech text itself must still be present.
    expect(fake.findByClass('subtitles-md-transcript')[0]?.textContent).toContain(
      'Good morning everyone',
    );
  });

  it('treats untrusted cue text as literal text, never as HTML (XSS-safe)', async () => {
    const payload = '<img src=x onerror=alert(1)> and <b>bold</b>';
    const malicious = [
      '1',
      '00:00:01,000 --> 00:00:02,000',
      payload,
      '',
    ].join('\n');
    const { el, fake } = makeEl();

    await renderTranscriptBlock(malicious, el, {
      app: NOOP_APP,
      timestamps: 'none',
    });

    // The payload survives verbatim as text content...
    const container = fake.findByClass('subtitles-md-transcript')[0];
    expect(container?.textContent).toContain(payload);

    // ...and NO element was synthesized from the markup it contains.
    const tags = fake.descendants().map((n) => n.tag);
    expect(tags).not.toContain('img');
    expect(tags).not.toContain('b');
  });

  it('renders a friendly message for empty input instead of throwing', async () => {
    const { el, fake } = makeEl();

    await expect(
      renderTranscriptBlock('', el, { app: NOOP_APP }),
    ).resolves.toBeUndefined();

    const messages = fake.findByClass('subtitles-md-message');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.textContent.length).toBeGreaterThan(0);
    expect(fake.findByClass('subtitles-md-paragraph')).toHaveLength(0);
  });

  it('renders a friendly message for unparseable garbage input', async () => {
    const { el, fake } = makeEl();

    await renderTranscriptBlock(
      'just some prose with no subtitle structure at all',
      el,
      { app: NOOP_APP },
    );

    expect(fake.findByClass('subtitles-md-message')).toHaveLength(1);
    expect(fake.findByClass('subtitles-md-paragraph')).toHaveLength(0);
  });

  it('resolves a "file:" reference from the vault and renders it', async () => {
    const app = makeFileApp('Subs/episode.srt', SRT_FIXTURE);
    const { el, fake } = makeEl();

    await renderTranscriptBlock('file: Subs/episode.srt', el, { app });

    const paragraphs = fake.findByClass('subtitles-md-paragraph');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]?.textContent).toContain('Hello world');
  });

  it('supports the "source:" key as a file reference too', async () => {
    const app = makeFileApp('Subs/episode.srt', SRT_FIXTURE);
    const { el, fake } = makeEl();

    await renderTranscriptBlock('source: Subs/episode.srt', el, { app });

    expect(fake.findByClass('subtitles-md-paragraph')).toHaveLength(2);
  });

  it('renders a friendly message when the referenced file is missing', async () => {
    const app = makeFileApp('Subs/episode.srt', null);
    const { el, fake } = makeEl();

    await renderTranscriptBlock('file: Subs/missing.srt', el, { app });

    const messages = fake.findByClass('subtitles-md-message');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.textContent).toContain('Subs/missing.srt');
    expect(fake.findByClass('subtitles-md-paragraph')).toHaveLength(0);
  });
});

describe('registerTranscriptCodeBlock', () => {
  it('registers a "transcript" processor that renders into the element', async () => {
    const calls: Array<{
      lang: string;
      handler: (
        src: string,
        el: HTMLElement,
        ctx: unknown,
      ) => Promise<unknown> | void;
    }> = [];

    const plugin = {
      app: NOOP_APP,
      registerMarkdownCodeBlockProcessor: (
        lang: string,
        handler: (
          src: string,
          el: HTMLElement,
          ctx: unknown,
        ) => Promise<unknown> | void,
      ): void => {
        calls.push({ lang, handler });
      },
    } as unknown as Plugin;

    registerTranscriptCodeBlock(plugin, () => ({ timestamps: 'none' }));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.lang).toBe('transcript');

    const { el, fake } = makeEl();
    await calls[0]?.handler(SRT_FIXTURE, el, {});

    expect(fake.findByClass('subtitles-md-paragraph')).toHaveLength(2);
    // getOptions() was honored: timestamps 'none' => no timestamp spans.
    expect(fake.findByClass('subtitles-md-timestamp')).toHaveLength(0);
  });
});
