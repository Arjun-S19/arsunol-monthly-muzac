import { Link } from 'react-router-dom';
import type { BlogPost } from '../types';

type PostCardProps = {
  post: BlogPost;
};

export default function PostCard({ post }: PostCardProps) {
  const preview = post.excerpt.trim().endsWith('...')
    ? post.excerpt.trim()
    : `${post.excerpt.trim()}...`;
  const titleText = post.title.length > 30
    ? `${post.title.slice(0, 27)}...`
    : post.title;

  return (
    <article className="post-card">
      <header className="post-card-head">
        {post.updatedLabel ? <p className="post-date">updated {post.updatedLabel}</p> : <p className="post-date">posted {post.postedLabel}</p>}
        <h2>
          <Link to={`/blog/${post.slug}`} title={post.title}>
            {titleText}
          </Link>
        </h2>
      </header>
      <p className="post-excerpt">{preview}</p>
    </article>
  );
}
