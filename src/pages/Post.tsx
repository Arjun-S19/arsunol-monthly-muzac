import { useEffect, useLayoutEffect, useRef } from 'react';
import { createSearchParams, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getPostBySlug } from '../lib/posts';

export default function PostPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const post = getPostBySlug(slug);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [slug]);

  useLayoutEffect(() => {
    const heading = titleRef.current;
    if (!heading) return;

    const MAX_SIZE = 58;
    const MIN_SIZE = 28;

    const fitTitle = () => {
      heading.style.fontSize = '';
      const computedSize = parseFloat(window.getComputedStyle(heading).fontSize) || MAX_SIZE;
      let size = Math.min(MAX_SIZE, computedSize);
      const availableWidth = heading.clientWidth;
      if (!availableWidth) {
        return;
      }
      while (size > MIN_SIZE && heading.scrollWidth > availableWidth) {
        size -= 1;
        heading.style.fontSize = `${size}px`;
      }
    };

    fitTitle();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      fitTitle();
    });

    observer.observe(heading);

    return () => {
      observer.disconnect();
      heading.style.fontSize = '';
    };
  }, [post?.title]);

  if (!post) {
    return <Navigate to="/" replace />;
  }

  const handleTagClick = (tag: string) => {
    navigate({ pathname: '/', search: createSearchParams({ tags: tag }).toString() });
  };

  return (
    <article className="post-page">
      <button
        type="button"
        className="post-back-button"
        onClick={() => navigate('/')}
      >
        ← back
      </button>
      <header className="post-page-head">
        <p className="post-date">posted {post.postedLabel} {post.updatedLabel ? `| updated ${post.updatedLabel}` : null}</p>
        <h1 ref={titleRef}>{post.title}</h1>
        <div className="tag-row">
          tags: 
          {post.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="chip"
              onClick={() => handleTagClick(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        {post.playlist 
        ? <p>playlist: 
          <button className="playlist-link" type="button" onClick={() => window.open(post.playlist, '_blank', 'noopener')}>
            {post.playlist}</button>
          </p> 
        : null}
      </header>
      <section className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  );
}
