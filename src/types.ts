export type BlogPost = {
  slug: string;
  title: string;
  postedLabel: string;
  updatedLabel?: string;
  isoPosted: string;
  isoUpdated?: string;
  tags: string[];
  excerpt: string;
  html: string;
};

export type TagSummary = {
  tag: string;
  count: number;
  posts: BlogPost[];
};
