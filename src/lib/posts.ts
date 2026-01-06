import matter from 'gray-matter';
import { marked } from 'marked';
import { Buffer } from 'buffer';
import type { BlogPost, TagSummary } from '../types';

if (typeof globalThis !== 'undefined' && (globalThis as any).Buffer === undefined) {
  (globalThis as any).Buffer = Buffer;
}

const modules = import.meta.glob('../content/posts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const posts: BlogPost[] = Object.entries(modules).reduce<BlogPost[]>((acc, [path, raw]) => {
  const file = typeof raw === 'string' ? raw : String(raw);
  const { data, content } = matter(file);
  if (!isFrontmatterPublic(data)) {
    return acc;
  }
  const slug = path.split('/').pop()?.replace(/\.md$/, '') ?? `post-${Math.random().toString(36).slice(2)}`;
  const parsedPosted = parseFrontmatterDate(data.posted) ?? new Date();
  const parsedUpdated = parseFrontmatterDate(data.updated);
  const isoPosted = parsedPosted.toISOString();
  const isoUpdated = parsedUpdated ? parsedUpdated.toISOString() : undefined;
  const title = (data.title ?? slug).toString().trim().toLowerCase();
  const tags = normalizeTags(data.tags);
  const rawHtml = marked.parse(content.trim()) as string;
  const html = applyLinkTargets(enhanceEmbeds(rawHtml));
  const excerpt = stripMarkup(html).slice(0, 220).toLowerCase();

  acc.push({
    slug,
    title,
    isoPosted,
    isoUpdated,
    postedLabel: formatDate(parsedPosted),
    updatedLabel: parsedUpdated ? formatDate(parsedUpdated) : undefined,
    tags,
    excerpt,
    html
  } satisfies BlogPost);

  return acc;
}, []).sort((a, b) => (a.isoPosted < b.isoPosted ? 1 : -1));

const tagIndex = new Map<string, TagSummary>();
posts.forEach((post) => {
  post.tags.forEach((tag) => {
    const entry = tagIndex.get(tag) ?? { tag, count: 0, posts: [] };
    entry.count += 1;
    entry.posts = [...entry.posts, post];
    tagIndex.set(tag, entry);
  });
});

const tagList: TagSummary[] = Array.from(tagIndex.values()).sort((a, b) => {
  if (b.count === a.count) return a.tag.localeCompare(b.tag);
  return b.count - a.count;
});

export function getAllPosts(): BlogPost[] {
  return posts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug);
}

export function getAllTags(): TagSummary[] {
  return tagList;
}

export function getTagSummary(tag: string): TagSummary | undefined {
  return tagIndex.get(tag);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(date).toLowerCase();
}

function parseFrontmatterDate(value: unknown): Date | null {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString() : String(value).trim();
  if (!raw) return null;
  const hasTime = /t/i.test(raw);
  const candidate = new Date(hasTime ? raw : `${raw}T00:00:00`);
  return Number.isNaN(candidate.valueOf()) ? null : candidate;
}

function normalizeTags(value: unknown): string[] {
  if (!value) return [];
  const fromArray = (arr: unknown[]) => arr.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
  if (Array.isArray(value)) return fromArray(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    const unwrapped = trimmed.replace(/^\[/, '').replace(/\]$/, '');
    const parts = unwrapped
      .split(/[,\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
    return fromArray(parts);
  }
  return [];
}

function isFrontmatterPublic(data: Record<string, unknown>): boolean {
  if (Object.prototype.hasOwnProperty.call(data, 'visibility')) {
    return parseVisibilityValue((data as Record<string, unknown>).visibility);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'public')) {
    return parseVisibilityValue((data as Record<string, unknown>).public);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'private')) {
    return !parseVisibilityValue((data as Record<string, unknown>).private);
  }
  return true;
}

function parseVisibilityValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['public', 'true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['private', 'false', 'no', 'n', '0'].includes(normalized)) return false;
  return true;
}


function stripMarkup(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function enhanceEmbeds(html: string): string {
  const blockRegex = /<(p|li)>([\s\S]*?)<\/\1>/gi;
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>\s*([^<]+?)\s*<\/a>/gi;

  return html.replace(blockRegex, (match, tag, inner) => {
    const trimmedInner = inner.trim();
    if (!trimmedInner) return match;

    const anchorRegex = new RegExp(anchorPattern.source, 'gi');
    const anchorMatches = Array.from(trimmedInner.matchAll(anchorRegex)) as RegExpMatchArray[];
    if (!anchorMatches.length) return match;

    let leftover = trimmedInner;
    anchorMatches.forEach((anchor) => {
      leftover = leftover.replace(anchor[0], ' ');
    });
    leftover = leftover.replace(/<br\s*\/?\>/gi, ' ').replace(/&nbsp;/gi, ' ').trim();
    if (leftover) return match;

    const embeds: string[] = [];
    for (const anchor of anchorMatches) {
      const [, hrefRaw, textRaw] = anchor;
      const href = decodeEntities(hrefRaw.trim());
      const text = decodeEntities(textRaw.trim());
      if (href !== text) return match;
      const embed = buildEmbed(href);
      if (!embed) return match;
      embeds.push(embed);
    }

    if (!embeds.length) return match;

    if (tag === 'li') {
      return `<li>${embeds.join('')}</li>`;
    }

    return embeds.join('\n');
  });
}

function buildEmbed(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (/(?:^|\.)open\.spotify\.com$/i.test(url.hostname)) {
    return buildSpotifyEmbed(url);
  }

  if (/(?:^|\.)youtube\.com$/i.test(url.hostname) || /youtu\.be$/i.test(url.hostname)) {
    return buildYouTubeEmbed(url);
  }

  return null;
}

function buildSpotifyEmbed(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const supportedTypes = ['track', 'album', 'playlist', 'episode', 'show'];
  const typeIndex = segments.findIndex((segment) => supportedTypes.includes(segment));
  if (typeIndex === -1) return null;
  const resourceType = segments[typeIndex];
  const resourceId = segments[typeIndex + 1];
  if (!resourceType || !resourceId) return null;
  const embedUrl = new URL(`https://open.spotify.com/embed/${resourceType}/${resourceId}`);
  const theme = url.searchParams.get('theme');
  if (theme) embedUrl.searchParams.set('theme', theme);
  return `<div class="post-embed spotify-embed"><iframe data-testid="embed-iframe" style="border-radius:12px" src="${embedUrl.toString()}" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
}

function buildYouTubeEmbed(url: URL): string | null {
  let videoId = '';
  if (/youtu\.be$/i.test(url.hostname)) {
    const parts = url.pathname.split('/').filter(Boolean);
    videoId = parts[0] ?? '';
  } else if (/youtube\.com$/i.test(url.hostname)) {
    if (url.pathname.startsWith('/watch')) {
      videoId = url.searchParams.get('v') ?? '';
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    }
  }

  videoId = videoId.trim();
  if (!videoId) return null;

  const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
  const start = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (start) embedUrl.searchParams.set('start', parseYouTubeStart(start));
  embedUrl.searchParams.set('rel', '0');

  return `\n<div class="post-embed youtube-embed">\n  <iframe src="${embedUrl.toString()}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>youtube embed</iframe>\n</div>\n`;
}

function parseYouTubeStart(value: string): string {
  const numeric = Number(value.replace(/[^0-9]/g, ''));
  if (Number.isFinite(numeric) && numeric > 0) return String(numeric);
  return '0';
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function applyLinkTargets(html: string): string {
  return html.replace(/<a\b[^>]*>/gi, (anchor) => {
    const match = anchor.match(/^<a\b([^>]*)>/i);
    if (!match) return anchor;
    let attrs = match[1] ?? '';

    if (/target\s*=/.test(attrs)) {
      attrs = attrs.replace(/target\s*=\s*(["']).*?\1/i, ' target="_blank"');
    } else {
      attrs = `${attrs} target="_blank"`;
    }

    if (/rel\s*=/.test(attrs)) {
      attrs = attrs.replace(/rel\s*=\s*(["'])(.*?)\1/i, (_m, quote, value) => {
        const tokens = new Set(value.split(/\s+/).filter(Boolean));
        tokens.add('noopener');
        tokens.add('noreferrer');
        return ` rel=${quote}${Array.from(tokens).join(' ')}${quote}`;
      });
    } else {
      attrs = `${attrs} rel="noopener noreferrer"`;
    }

    return `<a${attrs}>`;
  });
}
