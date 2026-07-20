import { describe, expect, it, vi } from 'vitest';

// The shared `tests/mocks/obsidian.mjs` stub only implements `normalizePath`,
// so it lacks the `TextFileView` runtime class this view extends. Provide a
// minimal inline mock with just enough surface for unit testing.
vi.mock('obsidian', () => {
  class TextFileView {
    leaf: unknown;
    data = '';
    file: unknown = null;
    contentEl: unknown;
    constructor(leaf: unknown) {
      this.leaf = leaf;
    }
  }
  return { TextFileView };
});

import {
  TRANSCRIPT_VIEW_TYPE,
  TranscriptView,
  registerTranscriptView,
  type TranscriptViewOptions,
} from './view';

/** A lightweight stand-in for an Obsidian-augmented HTMLElement. */
interface FakeEl {
  tag: string;
  cls: string;
  textContent: string;
  attrs: Record<string, unknown>;
  children: FakeEl[];
  createDiv(o?: FakeInfo | string): FakeEl;
  createSpan(o?: FakeInfo | string): FakeEl;
  createEl(tag: string, o?: FakeInfo | string): FakeEl;
  empty(): void;
}

interface FakeInfo {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, unknown>;
}

function makeEl(tag = 'div'): FakeEl {
  const el = {
    tag,
    cls: '',
    textContent: '',
    attrs: {} as Record<string, unknown>,
    children: [] as FakeEl[],
    createDiv(o?: FakeInfo | string): FakeEl {
      return appendChild(el, 'div', o);
    },
    createSpan(o?: FakeInfo | string): FakeEl {
      return appendChild(el, 'span', o);
    },
    createEl(childTag: string, o?: FakeInfo | string): FakeEl {
      return appendChild(el, childTag, o);
    },
    empty(): void {
      el.children = [];
      el.textContent = '';
    },
  };
  // Using innerHTML to render untrusted content is a bug; trap any such use.
  Object.defineProperty(el, 'innerHTML', {
    set() {
      throw new Error('innerHTML must never be used to render cue content');
    },
  });
  return el;
}

function appendChild(parent: FakeEl, tag: string, o?: FakeInfo | string): FakeEl {
  const child = makeEl(tag);
  if (typeof o === 'string') {
    child.cls = o;
  } else if (o) {
    if (o.cls !== undefined) {
      child.cls = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls;
    }
    if (o.text !== undefined) {
      child.textContent = String(o.text);
    }
    if (o.attr !== undefined) {
      child.attrs = { ...o.attr };
    }
  }
  parent.children.push(child);
  return child;
}

/** Recursively collect every element in the tree (excluding the root). */
function descendants(el: FakeEl): FakeEl[] {
  const out: FakeEl[] = [];
  for (const child of el.children) {
    out.push(child);
    out.push(...descendants(child));
  }
  return out;
}

function makeView(file?: { basename: string; name: string }): {
  view: TranscriptView;
  contentEl: FakeEl;
} {
  const view = new TranscriptView({} as never);
  const contentEl = makeEl();
  (view as unknown as { contentEl: FakeEl }).contentEl = contentEl;
  if (file) {
    (view as unknown as { file: unknown }).file = file;
  }
  return { view, contentEl };
}

const SRT_BASIC = [
  '1',
  '00:00:01,000 --> 00:00:02,000',
  'Hello world',
  '',
].join('\n');

describe('TranscriptView metadata', () => {
  it('reports the transcript view type', () => {
    const { view } = makeView();
    expect(TRANSCRIPT_VIEW_TYPE).toBe('subtitles-md-transcript-view');
    expect(view.getViewType()).toBe(TRANSCRIPT_VIEW_TYPE);
  });

  it('uses the file basename as the display text', () => {
    const { view } = makeView({ basename: 'episode', name: 'episode.srt' });
    expect(view.getDisplayText()).toBe('episode');
  });

  it('returns a non-empty icon name', () => {
    const { view } = makeView();
    const icon = view.getIcon();
    expect(typeof icon).toBe('string');
    expect(icon.length).toBeGreaterThan(0);
  });
});

describe('TranscriptView.setViewData rendering', () => {
  it('renders a paragraph with a timestamp and text', () => {
    const { view, contentEl } = makeView({
      basename: 'episode',
      name: 'episode.srt',
    });

    view.setViewData(SRT_BASIC, true);

    const container = contentEl.children[0];
    expect(container).toBeDefined();
    const paragraphs = container!.children;
    expect(paragraphs).toHaveLength(1);

    const all = descendants(contentEl);
    const text = all.find((e) => e.textContent === 'Hello world');
    expect(text).toBeDefined();
    const timestamp = all.find((e) => e.textContent === '00:00:01');
    expect(timestamp).toBeDefined();
  });

  it('renders an untrusted speaker as text, never as markup', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '<v <img src=x onerror=alert(1)>Hello there',
      '',
    ].join('\n');

    const { view, contentEl } = makeView({
      basename: 'clip',
      name: 'clip.vtt',
    });

    view.setViewData(vtt, true);

    const all = descendants(contentEl);
    const speaker = all.find((e) =>
      e.textContent.includes('<img src=x onerror=alert(1)'),
    );
    expect(speaker).toBeDefined();
    // The untrusted speaker must be a leaf text node, never parsed into DOM.
    expect(speaker!.children).toHaveLength(0);

    const text = all.find((e) => e.textContent === 'Hello there');
    expect(text).toBeDefined();
  });

  it('renders adversarial cue text as literal text with no injected elements', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const srt = [
      '1',
      '00:00:03,000 --> 00:00:04,000',
      payload,
      '',
    ].join('\n');

    const { view, contentEl } = makeView({ basename: 'x', name: 'x.srt' });

    view.setViewData(srt, true);

    const all = descendants(contentEl);
    const node = all.find((e) => e.textContent === payload);
    expect(node).toBeDefined();
    // No element may be created from the payload — it stays literal text.
    expect(node!.children).toHaveLength(0);
    expect(all.some((e) => e.tag === 'img')).toBe(false);
  });

  it('clears prior content before each render', () => {
    const { view, contentEl } = makeView({ basename: 'x', name: 'x.srt' });

    view.setViewData(SRT_BASIC, true);
    view.setViewData(SRT_BASIC, true);

    // A second render must not stack two transcript containers.
    expect(contentEl.children).toHaveLength(1);
  });

  it('shows a friendly message for unrecognizable input without throwing', () => {
    const { view, contentEl } = makeView();

    expect(() => view.setViewData('not a subtitle file at all', true)).not.toThrow();
    const all = descendants(contentEl);
    const hasText = all.some((e) => e.textContent.trim().length > 0);
    expect(hasText).toBe(true);
  });

  it('shows a friendly message for an empty file without throwing', () => {
    const { view, contentEl } = makeView({ basename: 'empty', name: 'empty.srt' });

    expect(() => view.setViewData('', true)).not.toThrow();
    const all = descendants(contentEl);
    const hasText = all.some((e) => e.textContent.trim().length > 0);
    expect(hasText).toBe(true);
  });
});

function makeViewWithOptions(options: TranscriptViewOptions): {
  view: TranscriptView;
  contentEl: FakeEl;
} {
  const view = new TranscriptView({} as never, () => options);
  const contentEl = makeEl();
  (view as unknown as { contentEl: FakeEl }).contentEl = contentEl;
  return { view, contentEl };
}

describe('TranscriptView timestamp options', () => {
  it('omits the timestamp span when timestamps is "none"', () => {
    const { view, contentEl } = makeViewWithOptions({ timestamps: 'none' });

    view.setViewData(SRT_BASIC, true);

    const all = descendants(contentEl);
    expect(all.some((e) => e.textContent === '00:00:01')).toBe(false);
  });

  it('marks aside timestamps with a modifier class', () => {
    const { view, contentEl } = makeViewWithOptions({ timestamps: 'aside' });

    view.setViewData(SRT_BASIC, true);

    const all = descendants(contentEl);
    const timestamp = all.find((e) => e.textContent === '00:00:01');
    expect(timestamp).toBeDefined();
    expect(timestamp!.cls.split(' ')).toContain('subtitles-md-timestamp--aside');
  });
});

const VTT_SPEAKER = [
  'WEBVTT',
  '',
  '00:00:01.000 --> 00:00:02.000',
  '<v Alice>Good morning everyone',
  '',
].join('\n');

describe('TranscriptView speaker style options', () => {
  it('renders the speaker as an inline bold span by default', () => {
    const { view, contentEl } = makeViewWithOptions({});

    view.setViewData(VTT_SPEAKER, true);

    const all = descendants(contentEl);
    const speaker = all.find(
      (e) => e.textContent === 'Alice' && e.tag === 'span',
    );
    expect(speaker).toBeDefined();
    expect(speaker!.cls.split(' ')).toContain('subtitles-md-speaker');
  });

  it('renders the speaker as a heading above the paragraph when speakerStyle is heading', () => {
    const { view, contentEl } = makeViewWithOptions({ speakerStyle: 'heading' });

    view.setViewData(VTT_SPEAKER, true);

    const container = contentEl.children[0];
    expect(container).toBeDefined();

    const heading = container!.children.find((e) => e.tag === 'h4');
    expect(heading).toBeDefined();
    expect(heading!.cls.split(' ')).toContain('subtitles-md-speaker--heading');
    expect(heading!.textContent).toBe('Alice');

    const paragraph = container!.children.find((e) =>
      e.cls.split(' ').includes('subtitles-md-paragraph'),
    );
    expect(paragraph).toBeDefined();
    const inlineSpeaker = paragraph!.children.find((c) => c.tag === 'span'
      && c.cls.split(' ').includes('subtitles-md-speaker'));
    expect(inlineSpeaker).toBeUndefined();
  });
});

describe('TranscriptView.getViewData', () => {
  it('returns the exact raw input unchanged (read-only round-trip)', () => {
    const { view } = makeView({ basename: 'episode', name: 'episode.srt' });

    view.setViewData(SRT_BASIC, true);

    expect(view.getViewData()).toBe(SRT_BASIC);
  });

  it('empties stored data and content on clear()', () => {
    const { view, contentEl } = makeView({ basename: 'x', name: 'x.srt' });

    view.setViewData(SRT_BASIC, true);
    view.clear();

    expect(view.getViewData()).toBe('');
    expect(contentEl.children).toHaveLength(0);
  });
});

function makeViewWithConvert(
  onConvert: (file: unknown) => void,
  file: { basename: string; name: string } | null = {
    basename: 'episode',
    name: 'episode.srt',
  },
): { view: TranscriptView; contentEl: FakeEl } {
  const view = new TranscriptView(
    {} as never,
    () => ({}),
    onConvert,
  );
  const contentEl = makeEl();
  (view as unknown as { contentEl: FakeEl }).contentEl = contentEl;
  if (file) {
    (view as unknown as { file: unknown }).file = file;
  }
  return { view, contentEl };
}

/** Find the banner's convert button anywhere under `contentEl`. */
function findConvertButton(contentEl: FakeEl): FakeEl | undefined {
  return descendants(contentEl).find((e) => e.tag === 'button');
}

describe('TranscriptView convert banner', () => {
  it('renders a banner with a convert button when a convert handler is provided', () => {
    const { view, contentEl } = makeViewWithConvert(vi.fn());

    view.setViewData(SRT_BASIC, true);

    const button = findConvertButton(contentEl);
    expect(button).toBeDefined();
    expect(button!.cls.split(' ')).toContain('subtitles-md-convert-button');
    expect(button!.textContent.length).toBeGreaterThan(0);

    // The banner also explains why the view is read-only.
    const all = descendants(contentEl);
    const message = all.find(
      (e) => e.tag === 'span' && /read-only/i.test(e.textContent),
    );
    expect(message).toBeDefined();
  });

  it('invokes the convert handler with the open file when the button is clicked', () => {
    const onConvert = vi.fn();
    const file = { basename: 'episode', name: 'episode.srt' };
    const { view, contentEl } = makeViewWithConvert(onConvert, file);

    view.setViewData(SRT_BASIC, true);

    const button = findConvertButton(contentEl) as unknown as {
      onclick?: () => void;
    };
    expect(button?.onclick).toBeTypeOf('function');
    button.onclick!();

    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onConvert).toHaveBeenCalledWith(file);
  });

  it('renders no banner or button when no convert handler is provided', () => {
    const { view, contentEl } = makeView({ basename: 'e', name: 'e.srt' });

    view.setViewData(SRT_BASIC, true);

    expect(findConvertButton(contentEl)).toBeUndefined();
  });

  it('renders no banner when no file is open', () => {
    const { view, contentEl } = makeViewWithConvert(vi.fn(), null);

    view.setViewData(SRT_BASIC, true);

    expect(findConvertButton(contentEl)).toBeUndefined();
  });

  it('does not stack banners across re-renders', () => {
    const { view, contentEl } = makeViewWithConvert(vi.fn());

    view.setViewData(SRT_BASIC, true);
    view.setViewData(SRT_BASIC, true);

    const buttons = descendants(contentEl).filter((e) => e.tag === 'button');
    expect(buttons).toHaveLength(1);
  });

  it('still shows the banner for unparseable content', () => {
    const { view, contentEl } = makeViewWithConvert(vi.fn());

    view.setViewData('not a subtitle file at all', true);

    expect(findConvertButton(contentEl)).toBeDefined();
  });
});

describe('registerTranscriptView', () => {
  it('registers the view and the .srt/.vtt extensions', () => {
    const registerView = vi.fn();
    const registerExtensions = vi.fn();
    const plugin = { registerView, registerExtensions } as never;

    registerTranscriptView(plugin);

    expect(registerView).toHaveBeenCalledWith(
      TRANSCRIPT_VIEW_TYPE,
      expect.any(Function),
    );
    expect(registerExtensions).toHaveBeenCalledWith(
      ['srt', 'vtt'],
      TRANSCRIPT_VIEW_TYPE,
    );

    const firstCall = registerView.mock.calls[0];
    expect(firstCall).toBeDefined();
    const creator = firstCall![1] as (leaf: unknown) => TranscriptView;
    const view = creator({});
    expect(view).toBeInstanceOf(TranscriptView);
    expect(view.getViewType()).toBe(TRANSCRIPT_VIEW_TYPE);
  });
});
