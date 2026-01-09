import { useState } from 'react';
import { projects } from './projects';
import { Project } from './types';
import './App.css';

type Tab = 'projects' | 'news';

function ProjectCard({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<Project['status'], string> = {
    active: 'status-active',
    beta: 'status-beta',
    development: 'status-development',
    archived: 'status-archived',
  };

  return (
    <article className={`project-card ${expanded ? 'expanded' : ''}`}>
      <button
        className="card-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="card-title-row">
          <h3 className="card-title">{project.name}</h3>
          <span className={`status-badge ${statusColors[project.status]}`}>
            {project.status}
          </span>
        </div>
        <p className="card-domain">{project.domain}</p>
        <span className={`expand-icon ${expanded ? 'rotated' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>

      <div className="card-body">
        <p className="card-description">{project.description}</p>

        {project.features && project.features.length > 0 && (
          <div className="card-features">
            <h4>Features</h4>
            <ul>
              {project.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="card-tags">
          {project.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

        <div className="card-meta">
          <div className="meta-item">
            <span className="meta-label">Last Updated</span>
            <span className="meta-value">{formatDate(project.lastUpdated)}</span>
          </div>
        </div>

        <div className="card-actions">
          <a
            href={project.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Visit Site
          </a>
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            GitHub
          </a>
        </div>
      </div>
    </article>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ProjectsPage() {
  const majorProjects = projects.filter((p) => p.category === 'major');
  const minorProjects = projects.filter((p) => p.category === 'minor');

  return (
    <div className="projects-page">
      <section className="project-section">
        <h2 className="section-title">Major Projects</h2>
        <div className="project-grid">
          {majorProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      <section className="project-section">
        <h2 className="section-title">Minor Projects</h2>
        <div className="project-grid">
          {minorProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>
    </div>
  );
}

function NewsPage() {
  return (
    <div className="news-page">
      <div className="empty-state">
        <span className="empty-icon">📰</span>
        <h2>News Coming Soon</h2>
        <p>Check back later for updates on projects and new releases.</p>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('projects');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <h1>ahara.io</h1>
          <span className="header-tagline">projects by tsonu</span>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-tab ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            News
          </button>
          <button
            className={`nav-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'projects' ? <ProjectsPage /> : <NewsPage />}
      </main>

      <footer className="app-footer">
        <span>Copyright © {new Date().getFullYear()}</span>
        <img src="/tsonu-combined.png" alt="tsonu" height="14" />
      </footer>
    </div>
  );
}

export default App;
