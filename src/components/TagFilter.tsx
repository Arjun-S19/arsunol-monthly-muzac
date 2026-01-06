type TagFilterProps = {
  tags: { tag: string; count: number }[];
  active: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
};

export default function TagFilter({ tags, active, onToggle, onClear }: TagFilterProps) {
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
        {tags.map((tag) => {
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
    </section>
  );
}
