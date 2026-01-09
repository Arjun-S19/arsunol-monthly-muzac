import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from 'd3-force';
import { getAllPosts, getAllTags } from '../lib/posts';
import type { BlogPost, TagSummary } from '../types';

type TagNode = SimulationNodeDatum & TagSummary & {
  id: string;
  radius: number;
  color: string;
};

type TagLink = SimulationLinkDatum<TagNode> & {
  weight: number;
};

type GraphData = {
  nodes: TagNode[];
  links: TagLink[];
  neighbors: Map<string, { tag: string; weight: number }[]>;
  tagMap: Map<string, TagSummary>;
  maxWeight: number;
};

const posts = getAllPosts();
const tags = getAllTags();

function buildGraph(): GraphData {
  const tagMap = new Map(tags.map((tag) => [tag.tag, tag]));

  const nodes: TagNode[] = tags.map((tag) => ({
    ...tag,
    id: tag.tag,
    radius: 14 + Math.sqrt(tag.count) * 6,
    color: 'rgba(255,255,255,0.92)'
  }));

  const pairCounts = new Map<string, number>();
  posts.forEach((post) => {
    const unique = Array.from(new Set(post.tags));
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const a = unique[i];
        const b = unique[j];
        if (!a || !b) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  });

  const sortedPairs = Array.from(pairCounts.entries()).sort((a, b) => b[1] - a[1]);
  const maxLinks = Math.max(40, Math.floor(tags.length * 2.6));
  const links: TagLink[] = sortedPairs.slice(0, maxLinks).map(([key, weight]) => {
    const [source, target] = key.split('|');
    return { source, target, weight } satisfies TagLink;
  });

  const neighbors = new Map<string, { tag: string; weight: number }[]>();
  links.forEach((link) => {
    const sourceTag = typeof link.source === 'string' ? link.source : (link.source as TagNode).id;
    const targetTag = typeof link.target === 'string' ? link.target : (link.target as TagNode).id;
    neighbors.set(sourceTag, [...(neighbors.get(sourceTag) ?? []), { tag: targetTag, weight: link.weight }]);
    neighbors.set(targetTag, [...(neighbors.get(targetTag) ?? []), { tag: sourceTag, weight: link.weight }]);
  });
  neighbors.forEach((list, key) => {
    const deduped = new Map<string, number>();
    list.forEach((item) => {
      deduped.set(item.tag, Math.max(deduped.get(item.tag) ?? 0, item.weight));
    });
    const clean = Array.from(deduped.entries()).map(([tag, weight]) => ({ tag, weight }));
    clean.sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
    neighbors.set(key, clean);
  });

  const maxWeight = links.reduce((acc, link) => Math.max(acc, link.weight), 1);

  return { nodes, links, neighbors, tagMap, maxWeight };
}

function postDisplayDate(post: BlogPost): string {
  if (post.updatedLabel) return `updated ${post.updatedLabel}`;
  return `posted ${post.postedLabel}`;
}

function truncateTitle(title: string): string {
  if (title.length <= 30) return title;
  return `${title.slice(0, 27)}...`;
}

export default function TagsPage() {
  const graph = useMemo(buildGraph, []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [pinnedTag, setPinnedTag] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const pinnedRef = useRef<string | null>(null);
  const [size, setSize] = useState({ width: 960, height: 640 });

  useEffect(() => {
    hoveredRef.current = hoveredTag;
  }, [hoveredTag]);

  useEffect(() => {
    pinnedRef.current = pinnedTag;
  }, [pinnedTag]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    const updateSize = () => {
      const rect = shell.getBoundingClientRect();
      const nextWidth = Math.max(rect.width, 640);
      const nextHeight = Math.max(rect.height, 520);
      setSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) return current;
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return undefined;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return undefined;
    const context = ctx;

    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = size.width * dpr;
    canvasEl.height = size.height * dpr;
    canvasEl.style.width = `${size.width}px`;
    canvasEl.style.height = `${size.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nodes: TagNode[] = graph.nodes.map((node) => ({ ...node }));
    const links: TagLink[] = graph.links.map((link) => ({ ...link }));
    const boundsPadding = 28;
    let animationFrame = 0;

    const linkForce = forceLink<TagNode, TagLink>(links)
      .id((node: TagNode) => node.id)
      .distance((link: TagLink) => {
        const normalized = link.weight / graph.maxWeight;
        const base = 240;
        return Math.max(80, base - normalized * 130);
      })
      .strength((link: TagLink) => 0.06 + (link.weight / graph.maxWeight) * 0.32);

    const simulation = forceSimulation(nodes)
      .alpha(0.8)
      .velocityDecay(0.35)
      .force('charge', forceManyBody().strength(-90))
      .force('link', linkForce)
      .force('center', forceCenter(size.width / 2, size.height / 2))
      .force('collide', forceCollide<TagNode>().radius((node: TagNode) => node.radius + 8))
      .on('tick', scheduleRender);

    function scheduleRender() {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(render);
    }

    function render() {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, size.width, size.height);

      clampNodes();

      const focus = pinnedRef.current;
      const neighborFocus = new Set<string>();
      if (focus) {
        neighborFocus.add(focus);
        (graph.neighbors.get(focus) ?? []).forEach((neighbor) => neighborFocus.add(neighbor.tag));
      }

      links.forEach((link) => {
        const source = link.source as TagNode | undefined;
        const target = link.target as TagNode | undefined;
        if (!source || !target || source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;
        const isActive = focus && (source.id === focus || target.id === focus);
        const baseWidth = 0.6 + (link.weight / graph.maxWeight) * 1.1;
        const width = isActive ? baseWidth * 2.2 : baseWidth;
        const stroke = isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.14)';
        context.beginPath();
        context.strokeStyle = stroke;
        context.lineWidth = width;
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.stroke();
      });

      nodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;
        const isFocus = focus === node.id;
        const inNeighborhood = neighborFocus.has(node.id);
        const baseRadius = node.radius;
        const radius = isFocus ? baseRadius + 8 : baseRadius;
        const fill = isFocus
          ? 'rgba(255,255,255,0.95)'
          : inNeighborhood
            ? 'rgba(255,255,255,0.78)'
            : 'rgba(255,255,255,0.52)';
        context.beginPath();
        context.fillStyle = fill;
        context.shadowColor = 'rgba(255,255,255,0.22)';
        context.shadowBlur = isFocus ? 28 : 12;
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;

        context.fillStyle = isFocus ? '#000' : '#0a0a0a';
        context.font = `${isFocus ? 16 : 13}px var(--mono)`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(node.id, node.x, node.y);
      });
    }

    function clampNodes() {
      nodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;
        const radius = node.radius + 4;
        const minX = boundsPadding + radius;
        const maxX = size.width - boundsPadding - radius;
        const minY = boundsPadding + radius;
        const maxY = size.height - boundsPadding - radius;
        const clampedX = Math.min(Math.max(node.x, minX), maxX);
        const clampedY = Math.min(Math.max(node.y, minY), maxY);
        if (clampedX !== node.x) {
          node.x = clampedX;
          node.vx = 0;
        }
        if (clampedY !== node.y) {
          node.y = clampedY;
          node.vy = 0;
        }
      });
    }

    function pointerPosition(event: PointerEvent): { x: number; y: number } {
      const rect = canvasEl!.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvasEl!.width / rect.width) / dpr;
      const y = (event.clientY - rect.top) * (canvasEl!.height / rect.height) / dpr;
      return { x, y };
    }

    function findNodeAt(event: PointerEvent): TagNode | null {
      const { x, y } = pointerPosition(event);
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const node = nodes[i];
        if (node.x === undefined || node.y === undefined) continue;
        const dx = node.x - x;
        const dy = node.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= node.radius + 6) return node;
      }
      return null;
    }

    function handlePointerMove(event: PointerEvent) {
      const node = findNodeAt(event);
      const tag = node?.id ?? null;
      hoveredRef.current = tag;
      setHoveredTag(tag);

      const { x, y } = pointerPosition(event);
      const influence = 140;
      const push = 0.08;
      nodes.forEach((candidate) => {
        if (candidate.x === undefined || candidate.y === undefined) return;
        const dx = candidate.x - x;
        const dy = candidate.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > influence) return;
        const strength = (1 - dist / influence) * push;
        candidate.vx = (candidate.vx ?? 0) + (dx / dist) * strength;
        candidate.vy = (candidate.vy ?? 0) + (dy / dist) * strength;
      });
      simulation.alphaTarget(0.06).restart();
      scheduleRender();
    }

    function handlePointerLeave() {
      hoveredRef.current = null;
      setHoveredTag((current) => (pinnedRef.current === current ? current : null));
      simulation.alphaTarget(0);
      scheduleRender();
    }

    function handlePointerUp(event: PointerEvent) {
      const node = findNodeAt(event);
      const clickedTag = node?.id ?? null;
      if (clickedTag) {
        setPinnedTag(clickedTag);
        hoveredRef.current = clickedTag;
        setHoveredTag(clickedTag);
      } else {
        setPinnedTag(null);
        hoveredRef.current = null;
        setHoveredTag(null);
      }
      simulation.alphaTarget(0.04).restart();
      scheduleRender();
    }

    canvasEl.addEventListener('pointermove', handlePointerMove);
    canvasEl.addEventListener('pointerleave', handlePointerLeave);
    canvasEl.addEventListener('pointerup', handlePointerUp);

    scheduleRender();

    renderRef.current = scheduleRender;

    return () => {
      simulation.stop();
      cancelAnimationFrame(animationFrame);
      canvasEl.removeEventListener('pointermove', handlePointerMove);
      canvasEl.removeEventListener('pointerleave', handlePointerLeave);
      canvasEl.removeEventListener('pointerup', handlePointerUp);
    };
  }, [graph, size]);

  useEffect(() => {
    renderRef.current?.();
  }, [hoveredTag, pinnedTag]);

  const activeTag = pinnedTag;
  const activeSummary = activeTag ? graph.tagMap.get(activeTag) ?? null : null;
  const neighborList = activeTag ? graph.neighbors.get(activeTag) ?? [] : [];
  const neighborDisplay = neighborList;
  const visiblePosts = activeSummary?.posts ?? [];

  const statsTagCount = pinnedTag ? 1 : tags.length;
  const statsPostCount = pinnedTag ? visiblePosts.length : posts.length;
  const statsConnectionCount = pinnedTag ? neighborList.length : graph.links.length;

  return (
    <section className="tags-page">
      <div className="tag-visualizer">
        <div className="tag-graph-shell" ref={shellRef}>
          <canvas ref={canvasRef} className="tag-graph-canvas" />
          <div className="tag-graph-overlay">
            <div className="tag-graph-top">
              <Link to="/" className="post-back-button">
                ← back
              </Link>
              <div className="tag-graph-stats">
                <span>{statsTagCount} tag{statsTagCount === 1 ? '' : 's'}</span>
                <span>·</span>
                <span>{statsPostCount} post{statsPostCount === 1 ? '' : 's'}</span>
                <span>·</span>
                <span>{statsConnectionCount} connection{statsConnectionCount === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="tag-info-panel">
          <div className="tag-info-head">
            <p className="eyebrow">tag details</p>
            <h2>{activeSummary ? activeSummary.tag : 'click a node'}</h2>
          </div>

          <div className="tag-info-block">
            <div className="tag-info-block-head">
              <span>related tags</span>
              <span className="muted">{neighborList.length}</span>
            </div>
            <div className="tag-neighbor-grid">
              {neighborList.length === 0 && <span className="muted">null</span>}
              {neighborDisplay.map((entry) => (
                <span key={`${activeTag ?? 'none'}-${entry.tag}`} className="chip alt">
                  <span>{entry.tag}</span>
                  <span className="chip-count">{entry.weight}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="tag-info-block grow">
            <div className="tag-info-block-head">
              <span>posts</span>
              <span className="muted">{visiblePosts.length}</span>
            </div>
            <div className="tag-post-list" role="list">
              {visiblePosts.length === 0 && <span className="muted">null</span>}
              {visiblePosts.map((post) => (
                <div key={post.slug} className="tag-post-card" role="listitem">
                  <div className="tag-post-meta">
                    <span className="muted">{postDisplayDate(post)}</span>
                    <span className="chip-count">{post.tags.length} tags</span>
                  </div>
                  <p className="tag-post-title">
                    <Link to={`/blog/${post.slug}`}>{truncateTitle(post.title)}</Link>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
