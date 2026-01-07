import { useMemo } from 'react';
import { createSearchParams, useSearchParams } from 'react-router-dom';
import TagFilter from '../components/TagFilter';
import PostCard from '../components/PostCard';
import { getAllPosts, getAllTags } from '../lib/posts';

const posts = getAllPosts();
const tags = getAllTags();

export default function HomePage() {
  const [params, setParams] = useSearchParams();

  const activeTags = useMemo(() => {
    const raw = params.get('tags');
    if (!raw) return [];
    return raw.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  }, [params]);

  const filteredPosts = useMemo(() => {
    const base = !activeTags.length
      ? posts
      : posts.filter((post) => activeTags.every((tag) => post.tags.includes(tag)));

    return [...base].sort((a, b) => (a.isoPosted < b.isoPosted ? 1 : -1));
  }, [activeTags]);

  const dynamicTags = useMemo(() => {
    const tally = new Map<string, number>();
    filteredPosts.forEach((post) => {
      post.tags.forEach((tag) => {
        tally.set(tag, (tally.get(tag) ?? 0) + 1);
      });
    });
    return tags.map((tag) => ({
      tag: tag.tag,
      count: tally.get(tag.tag) ?? 0
    }));
  }, [filteredPosts]);

  const toggleTag = (tag: string) => {
    const next = new Set(activeTags);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    const serialized = Array.from(next);
    if (serialized.length) {
      setParams(createSearchParams({ tags: serialized.join(',') }));
    } else {
      setParams({});
    }
  };

  const clearTags = () => setParams({});

  return (
    <section className="home-stack">
      <header className="home-head">
        <script data-goatcounter="https://arsunolmonthlymuzac.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
        <h1>arsunol's monthly muzac</h1>
        <p className="lede">
            a blog where i record my monthly music genre explorations
        </p>
      </header>

      <TagFilter
        tags={dynamicTags}
        active={activeTags}
        onToggle={toggleTag}
        onClear={clearTags}
      />

      <div className="post-list-head">
        <span>
          {filteredPosts.length} post{filteredPosts.length === 1 ? '' : 's'} in view
          {activeTags.length ? ` · filtered by ${activeTags.join(', ')}` : ''}
        </span>
      </div>

      <div className="post-list">
        {filteredPosts.length === 0 ? (
          <button
            className="post-list-empty"
            type="button"
            onClick={() => window.open('https://open.spotify.com/user/arjun12367', '_blank', 'noopener')}
          >
            <span>null</span>
          </button>
        ) : (
          filteredPosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))
        )}
      </div>
    </section>
  );
}
