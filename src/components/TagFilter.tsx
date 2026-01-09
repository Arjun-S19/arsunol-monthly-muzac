import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type TagFilterProps = {
  tags: { tag: string; count: number }[];
  active: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
};

export default function TagFilter({ tags, active, onToggle, onClear }: TagFilterProps) {
  const [collapsed, setCollapsed] = useState(tags.length > 15);

  const visibleTags = useMemo(
    () => (collapsed ? tags.slice(0, 15) : tags),
    [collapsed, tags]
  );

  return (
    <section className="tag-filter">
      <div className="tag-filter-head">
        <span>filter by tag</span>
        {active.length > 0 && (
          <button type="button" onClick={onClear} className="ghost-link">
            clear
          </button>
        )}
      </div>
      <div className="tag-filter-grid">
        {visibleTags.map((tag) => {
          const isActive = active.includes(tag.tag);
          return (
            <button
              type="button"
              key={tag.tag}
              className={`chip${isActive ? ' active' : ''}`}
              onClick={() => onToggle(tag.tag)}
            >
              <span>{tag.tag}</span>
              <span className="chip-count">{tag.count}</span>
            </button>
          );
        })}
      </div>
      <div className="tag-map-row">
        {tags.length > 15 && (
          <button
            type="button"
            className="ghost-link tag-expand-link"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? 'expand' : 'collapse'}
          </button>
        )}
        <Link to="/tags" className="ghost-link tag-map-link">tags visualizer</Link>
      </div>
    </section>
  );
}
