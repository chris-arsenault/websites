export interface Project {
  id: string;
  name: string;
  domain: string;
  description: string;
  status: 'active' | 'beta' | 'development' | 'archived';
  category: 'major' | 'minor';
  tags: string[];
  productUrl: string;
  repoUrl: string;
  lastUpdated: string;
  features?: string[];
}

export interface NewsArticle {
  id: string;
  projectId: string;
  title: string;
  date: string;
  content: string;
  tags: string[];
}
