/**
 * Client behaviour for a blog post page: Mermaid diagrams, reading progress,
 * table of contents with scroll spy, code-block toolbars and link copying.
 * Safe to call on every `astro:page-load`; it is a no-op off post pages.
 */

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
}

const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
const COPY_RESET_MS = 1600;
const FONT_STACK = "'IBM Plex Sans KR', sans-serif";

let mermaidModule: Promise<MermaidApi> | undefined;
let pageController: AbortController | undefined;
let themeObserver: MutationObserver | undefined;

function isDark(): boolean {
  return document.documentElement.dataset.theme === 'dark';
}

function configureMermaid(mermaid: MermaidApi): void {
  const dark = isDark();
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    fontFamily: FONT_STACK,
    themeVariables: {
      darkMode: dark,
      fontFamily: FONT_STACK,
      fontSize: '15px',
      background: dark ? '#111418' : '#f8f9fb',
      primaryColor: dark ? '#1b2333' : '#e9eef8',
      primaryBorderColor: dark ? '#8ea7e9' : '#26468f',
      primaryTextColor: dark ? '#e7e9ed' : '#15181e',
      secondaryColor: dark ? '#171b21' : '#ffffff',
      tertiaryColor: dark ? '#171b21' : '#ffffff',
      lineColor: dark ? '#737b88' : '#8a909c',
    },
    flowchart: { curve: 'basis', padding: 16 },
  });
}

function renderMermaidError(target: Element, error: unknown, source: string): void {
  const box = document.createElement('div');
  box.className = 'diagram-error';
  const title = document.createElement('strong');
  title.textContent = '다이어그램을 그리지 못했습니다';
  const detail = document.createElement('p');
  detail.textContent = error instanceof Error ? error.message : String(error);
  const code = document.createElement('pre');
  code.textContent = source;
  box.append(title, detail, code);
  target.replaceChildren(box);
}

/** Mermaid is ~1MB, so it is only fetched for posts that actually contain a diagram. */
function loadMermaid(): Promise<MermaidApi> {
  mermaidModule ??= import(/* @vite-ignore */ MERMAID_URL).then((module) => module.default as MermaidApi);
  return mermaidModule;
}

async function renderDiagrams(diagrams: Element[]): Promise<void> {
  if (diagrams.length === 0) return;

  let mermaid: MermaidApi;
  try {
    mermaid = await loadMermaid();
  } catch (error: unknown) {
    mermaidModule = undefined;
    diagrams.forEach((diagram) => renderMermaidError(diagram, error, diagram.getAttribute('data-mermaid-code') ?? ''));
    return;
  }
  configureMermaid(mermaid);

  await Promise.all(
    diagrams.map(async (diagram, index) => {
      const source = diagram.getAttribute('data-mermaid-code') ?? '';
      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}-${index}`, source);
        diagram.innerHTML = svg;
      } catch (error: unknown) {
        renderMermaidError(diagram, error, source);
      }
    }),
  );
}

/** Notion exports diagrams as ```mermaid code blocks; swap them for render targets. */
function collectDiagrams(prose: Element): Element[] {
  prose.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const target = document.createElement('div');
    target.className = 'mermaid';
    target.setAttribute('data-mermaid-code', code.textContent?.trim() ?? '');
    code.parentElement?.replaceWith(target);
  });
  return Array.from(prose.querySelectorAll('.mermaid[data-mermaid-code]'));
}

function setupProgress(signal: AbortSignal): void {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;

  let queued = false;
  const update = () => {
    queued = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    bar.style.transform = `scaleX(${progress})`;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true, signal },
  );
  update();
}

function setupToc(prose: Element, signal: AbortSignal): void {
  const toc = document.getElementById('toc');
  const sidebar = document.getElementById('toc-sidebar');
  if (!toc || !sidebar) return;

  const headings = Array.from(prose.querySelectorAll<HTMLHeadingElement>('h2, h3'));
  if (headings.length < 2) {
    sidebar.hidden = true;
    return;
  }

  toc.replaceChildren(
    ...headings.map((heading, index) => {
      if (!heading.id) heading.id = `section-${index}`;
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      link.className = heading.tagName === 'H3' ? 'toc-link toc-link-sub' : 'toc-link';
      return link;
    }),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        toc.querySelectorAll('.toc-link').forEach((link) => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    },
    { rootMargin: '-80px 0px -70% 0px' },
  );
  headings.forEach((heading) => observer.observe(heading));
  signal.addEventListener('abort', () => observer.disconnect());
}

async function copyText(button: HTMLButtonElement, text: string, idleLabel: string): Promise<void> {
  const label = button.querySelector('span') ?? button;
  try {
    await navigator.clipboard.writeText(text);
    label.textContent = '복사됨';
  } catch {
    label.textContent = '복사 실패';
  }
  setTimeout(() => {
    label.textContent = idleLabel;
  }, COPY_RESET_MS);
}

function setupCodeBlocks(prose: Element): void {
  prose.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-block')) return;

    const language = pre.querySelector('code')?.className.match(/language-(\S+)/)?.[1] ?? 'text';
    const wrapper = document.createElement('figure');
    wrapper.className = 'code-block';

    const toolbar = document.createElement('figcaption');
    toolbar.className = 'code-toolbar';
    const languageLabel = document.createElement('span');
    languageLabel.textContent = language;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy pressable';
    button.setAttribute('aria-label', '코드 복사');
    const buttonLabel = document.createElement('span');
    buttonLabel.textContent = '복사';
    button.append(buttonLabel);
    button.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
      void copyText(button, code, '복사');
    });
    toolbar.append(languageLabel, button);

    pre.replaceWith(wrapper);
    wrapper.append(toolbar, pre);
  });
}

function setupCopyLink(signal: AbortSignal): void {
  const button = document.getElementById('copy-link-btn') as HTMLButtonElement | null;
  button?.addEventListener('click', () => void copyText(button, window.location.href, '링크 복사'), { signal });
}

/** "목록으로" returns to the exact list page and scroll position the reader came from. */
function setupBackLinks(signal: AbortSignal): void {
  document.querySelectorAll('.back-link').forEach((link) => {
    link.addEventListener(
      'click',
      (event) => {
        const listUrl = sessionStorage.getItem('blogListUrl');
        if (!listUrl) return;
        event.preventDefault();
        sessionStorage.setItem('blogListRestore', '1');
        window.location.href = listUrl;
      },
      { signal },
    );
  });
}

export function initBlogPost(): void {
  pageController?.abort();
  themeObserver?.disconnect();

  const prose = document.querySelector('.prose');
  if (!prose) return;

  pageController = new AbortController();
  const { signal } = pageController;

  const diagrams = collectDiagrams(prose);
  void renderDiagrams(diagrams);
  themeObserver = new MutationObserver(() => void renderDiagrams(diagrams));
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  setupProgress(signal);
  setupToc(prose, signal);
  setupCodeBlocks(prose);
  setupCopyLink(signal);
  setupBackLinks(signal);
}
