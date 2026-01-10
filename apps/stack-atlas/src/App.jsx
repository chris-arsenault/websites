import { useMemo, useState } from 'react'
import { categories, items, types } from './data/stackData'
import './App.css'

const itemsById = new Map(items.map((item) => [item.id, item]))
const categoryById = new Map(categories.map((category) => [category.id, category]))

const technologyTypes = new Set([
  'Capability',
  'Technique',
  'Pattern',
  'Practice',
  'Methodology',
  'Test Type',
  'Standard'
])

const toolTypes = new Set([
  'Tool',
  'Service',
  'Platform',
  'Framework',
  'Library',
  'Language',
  'Runtime',
  'DataStore'
])

const categoryCounts = items.reduce((acc, item) => {
  acc[item.category] = (acc[item.category] || 0) + 1
  return acc
}, {})

const tagCounts = items.reduce((acc, item) => {
  ;(item.tags || []).forEach((tag) => {
    acc[tag] = (acc[tag] || 0) + 1
  })
  return acc
}, {})

const tagList = Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 10)
  .map(([tag]) => tag)

const toggleInList = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

const buildSearchText = (item) => {
  const parts = [
    item.name,
    item.type,
    item.description,
    ...(item.synonyms || []),
    ...(item.tags || []),
    categoryById.get(item.category)?.name || ''
  ]
  return parts.join(' ').toLowerCase()
}

const buildTree = (categoryItems) => {
  const nodes = new Map(
    categoryItems.map((item) => [item.id, { item, children: [] }])
  )

  const roots = []

  nodes.forEach((node) => {
    const parentId = (node.item.parents || []).find((id) => nodes.has(id))
    if (parentId) {
      nodes.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodeList) => {
    nodeList.sort((a, b) => a.item.name.localeCompare(b.item.name))
    nodeList.forEach((node) => sortNodes(node.children))
  }

  sortNodes(roots)
  return roots
}

const flattenTree = (nodes, depth = 0) =>
  nodes.flatMap((node) => [
    { item: node.item, depth },
    ...flattenTree(node.children, depth + 1)
  ])

const buildExportData = (selectedIds) => {
  const selectedItems = selectedIds
    .map((id) => itemsById.get(id))
    .filter(Boolean)

  const categoriesPayload = categories
    .map((category) => {
      const categoryItems = selectedItems.filter(
        (item) => item.category === category.id
      )

      if (!categoryItems.length) return null

      const technologies = categoryItems
        .filter((item) => technologyTypes.has(item.type))
        .map((item) => ({ name: item.name, type: item.type }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const tools = categoryItems
        .filter((item) => toolTypes.has(item.type))
        .map((item) => ({ name: item.name, type: item.type }))
        .sort((a, b) => a.name.localeCompare(b.name))

      return {
        name: category.name,
        technologies,
        tools
      }
    })
    .filter(Boolean)

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    categories: categoriesPayload
  }
}

const formatExport = (data, format) => {
  if (!data.categories.length) {
    return 'No items selected yet. Use the list to build a standardized stack.'
  }

  if (format === 'json') {
    return JSON.stringify(data, null, 2)
  }

  const lines = [`# Standardized Stack`, `Generated: ${data.generatedAt}`, '']
  data.categories.forEach((category) => {
    lines.push(`## ${category.name}`)
    if (category.technologies.length) {
      lines.push(
        `- Technologies: ${category.technologies
          .map((item) => item.name)
          .join('; ')}`
      )
    }
    if (category.tools.length) {
      lines.push(
        `- Tools: ${category.tools.map((item) => item.name).join('; ')}`
      )
    }
    lines.push('')
  })
  return lines.join('\n')
}

const getParentName = (item) => {
  const parentId = item.parents?.[0]
  if (!parentId) return null
  return itemsById.get(parentId)?.name
}

function App() {
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [isTypesOpen, setIsTypesOpen] = useState(true)
  const [isTagsOpen, setIsTagsOpen] = useState(false)
  const [viewMode, setViewMode] = useState('hierarchy')
  const [density, setDensity] = useState('compact')
  const [collapsedCategories, setCollapsedCategories] = useState(new Set())
  const [exportFormat, setExportFormat] = useState('markdown')

  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const selectedSet = useMemo(
    () => new Set(selectedItems),
    [selectedItems]
  )

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()

    const baseMatches = items.filter((item) => {
      if (selectedCategories.length && !selectedCategories.includes(item.category)) {
        return false
      }
      if (selectedTypes.length && !selectedTypes.includes(item.type)) {
        return false
      }
      if (
        selectedTags.length &&
        !selectedTags.every((tag) => item.tags?.includes(tag))
      ) {
        return false
      }
      if (!q) return true
      return buildSearchText(item).includes(q)
    })

    const ids = new Set(baseMatches.map((item) => item.id))
    if (viewMode === 'hierarchy') {
      baseMatches.forEach((item) => {
        ;(item.parents || []).forEach((parentId) => {
          if (itemsById.has(parentId)) {
            ids.add(parentId)
          }
        })
      })
    }

    return items.filter((item) => ids.has(item.id))
  }, [query, selectedCategories, selectedTypes, selectedTags, viewMode])

  const sections = useMemo(() => {
    return categories
      .map((category) => {
        const categoryItems = filteredItems.filter(
          (item) => item.category === category.id
        )
        if (!categoryItems.length) return null

        const displayItems =
          viewMode === 'flat'
            ? [...categoryItems]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => ({ item, depth: 0 }))
            : flattenTree(buildTree(categoryItems))

        return {
          ...category,
          items: displayItems
        }
      })
      .filter(Boolean)
  }, [filteredItems, viewMode])

  const selectedByCategory = useMemo(() => {
    return categories
      .map((category) => {
        const categoryItems = selectedItems
          .map((id) => itemsById.get(id))
          .filter(Boolean)
          .filter((item) => item.category === category.id)
          .sort((a, b) => a.name.localeCompare(b.name))

        if (!categoryItems.length) return null

        return { category, items: categoryItems }
      })
      .filter(Boolean)
  }, [selectedItems])

  const exportData = useMemo(
    () => buildExportData(selectedItems),
    [selectedItems]
  )

  const exportText = useMemo(
    () => formatExport(exportData, exportFormat),
    [exportData, exportFormat]
  )

  const toggleItem = (id) => {
    setSelectedItems((prev) => toggleInList(prev, id))
  }

  const addItems = (ids) => {
    setSelectedItems((prev) => Array.from(new Set([...prev, ...ids])))
  }

  const removeItem = (id) => {
    setSelectedItems((prev) => prev.filter((item) => item !== id))
  }

  const clearSelection = () => setSelectedItems([])

  const resetFilters = () => {
    setQuery('')
    setSelectedCategories([])
    setSelectedTypes([])
    setSelectedTags([])
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText)
    } catch (error) {
      console.error('Failed to copy output', error)
    }
  }

  return (
    <div className={`app ${density}`}>
      <header className="hero">
        <div>
          <p className="eyebrow">Stack Atlas</p>
          <h1>Unify how teams describe their technology stacks.</h1>
          <p className="hero-subtitle">
            Start with a canonical list derived from your current inventory. Filter,
            select, and export a standard format that everyone can compare across
            programs.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary" onClick={resetFilters}>
              Reset filters
            </button>
            <div className="hero-stat">
              <span>{items.length} items</span>
              <span>{selectedItems.length} selected</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <h2>Workflow</h2>
          <ol>
            <li>Filter by category, type, or search.</li>
            <li>Select the capabilities and tools you actually use.</li>
            <li>Export the standardized stack for side-by-side comparisons.</li>
          </ol>
          <div className="toggle-row">
            <div className="view-toggle">
              <span>View</span>
              <button
                type="button"
                className={viewMode === 'hierarchy' ? 'active' : ''}
                onClick={() => setViewMode('hierarchy')}
              >
                Hierarchy
              </button>
              <button
                type="button"
                className={viewMode === 'flat' ? 'active' : ''}
                onClick={() => setViewMode('flat')}
              >
                Flat
              </button>
            </div>
            <div className="view-toggle">
              <span>Density</span>
              <button
                type="button"
                className={density === 'compact' ? 'active' : ''}
                onClick={() => setDensity('compact')}
              >
                Compact
              </button>
              <button
                type="button"
                className={density === 'comfortable' ? 'active' : ''}
                onClick={() => setDensity('comfortable')}
              >
                Comfortable
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main-grid">
        <aside className="filters-panel">
          <div className="panel-header">
            <h3>Filters</h3>
            <button type="button" className="ghost" onClick={resetFilters}>
              Clear
            </button>
          </div>

          <label className="field">
            <span>Search</span>
            <input
              type="search"
              placeholder="Search by name, description, or tag"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="filter-block">
            <div className="filter-heading">
              <div className="filter-title">Categories</div>
              <button
                type="button"
                className="filter-toggle"
                aria-expanded={isCategoriesOpen}
                onClick={() => setIsCategoriesOpen((prev) => !prev)}
              >
                {isCategoriesOpen ? '−' : '+'}
              </button>
            </div>
            {isCategoriesOpen && (
              <div className="chip-grid">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={
                      selectedCategories.includes(category.id)
                        ? 'chip active'
                        : 'chip'
                    }
                    style={{ '--chip': category.color }}
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        toggleInList(prev, category.id)
                      )
                    }
                  >
                    {category.name}
                    <span className="chip-count">{categoryCounts[category.id]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="filter-block">
            <div className="filter-heading">
              <div className="filter-title">Types</div>
              <button
                type="button"
                className="filter-toggle"
                aria-expanded={isTypesOpen}
                onClick={() => setIsTypesOpen((prev) => !prev)}
              >
                {isTypesOpen ? '−' : '+'}
              </button>
            </div>
            {isTypesOpen && (
              <div className="chip-grid">
                {types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={selectedTypes.includes(type) ? 'chip active' : 'chip'}
                    onClick={() =>
                      setSelectedTypes((prev) => toggleInList(prev, type))
                    }
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="filter-block">
            <div className="filter-heading">
              <div className="filter-title">Tags (match all)</div>
              <button
                type="button"
                className="filter-toggle"
                aria-expanded={isTagsOpen}
                onClick={() => setIsTagsOpen((prev) => !prev)}
              >
                {isTagsOpen ? '−' : '+'}
              </button>
            </div>
            {isTagsOpen && (
              <div className="chip-grid">
                {tagList.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={selectedTags.includes(tag) ? 'chip active' : 'chip'}
                    onClick={() =>
                      setSelectedTags((prev) => toggleInList(prev, tag))
                    }
                  >
                    {tag}
                    <span className="chip-count">{tagCounts[tag]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="list-panel">
          {sections.map((section) => {
            const isCollapsed = collapsedCategories.has(section.id)
            return (
            <div key={section.id} className={`category-section ${isCollapsed ? 'collapsed' : ''}`}>
              <button
                type="button"
                className="section-header"
                onClick={() => toggleCategoryCollapse(section.id)}
              >
                <span className="section-toggle">{isCollapsed ? '+' : '−'}</span>
                <div className="section-title">
                  <h2>{section.name}</h2>
                  <p>{section.description}</p>
                </div>
                <span className="section-count">
                  {section.items.length} visible
                </span>
              </button>
              {!isCollapsed && (
              <div className="item-list">
                {section.items.map(({ item, depth }, index) => {
                  const isSelected = selectedSet.has(item.id)
                  const parentName = getParentName(item)
                  const commonItems = (item.commonWith || [])
                    .map((id) => itemsById.get(id))
                    .filter(Boolean)

                  const hasMetadata = !!(
                    item.description ||
                    parentName ||
                    item.synonyms?.length > 0 ||
                    item.tags?.length > 0 ||
                    commonItems.length > 0
                  )

                  return (
                    <article
                      key={item.id}
                      className={isSelected ? 'item-card is-selected' : 'item-card'}
                      style={{
                        '--accent': section.color,
                        '--depth': depth,
                        '--delay': `${Math.min(index, 10) * 45}ms`
                      }}
                      onClick={() => toggleItem(item.id)}
                    >
                      <div className="item-main">
                        {hasMetadata && (
                          <button
                            type="button"
                            className="item-info-btn"
                            onClick={(e) => e.stopPropagation()}
                            title="More info"
                          >
                            ?
                          </button>
                        )}
                        <div className="item-title">
                          <h3>{item.name}</h3>
                          <span className="item-type">{item.type}</span>
                        </div>
                        <div className="item-checkbox" />
                      </div>

                      {hasMetadata && (
                        <div
                          className="item-meta-overlay"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {item.description && (
                            <div className="item-description">{item.description}</div>
                          )}
                          {parentName && (
                            <div className="item-parent">Parent: {parentName}</div>
                          )}
                          {item.synonyms?.length > 0 && (
                            <div className="item-synonyms">
                              Also known as: {item.synonyms.join(', ')}
                            </div>
                          )}
                          {item.tags?.length > 0 && (
                            <div className="item-tags">
                              {item.tags.map((tag) => (
                                <span key={tag} className="tag">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {commonItems.length > 0 && (
                            <div className="item-common">
                              <span>Common together:</span>
                              <div className="common-list">
                                {commonItems.map((common) => (
                                  <button
                                    key={common.id}
                                    type="button"
                                    className="chip"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      addItems([common.id])
                                    }}
                                  >
                                    + {common.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
              )}
            </div>
          )})}
        </section>

        <aside className="selected-panel">
          <div className="panel-header">
            <h3>Selected Stack</h3>
            <button type="button" className="ghost" onClick={clearSelection}>
              Clear all
            </button>
          </div>

          {selectedItems.length ? (
            <div className="selected-groups">
              {selectedByCategory.map((group) => (
                <div key={group.category.id} className="selected-group">
                  <div className="selected-group-title">
                    <span
                      className="dot"
                      style={{ '--dot': group.category.color }}
                    />
                    {group.category.name}
                  </div>
                  <div className="selected-chips">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="selected-chip"
                        onClick={() => removeItem(item.id)}
                      >
                        {item.name}
                        <span className="remove">x</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              Select items to build a standardized stack output.
            </div>
          )}

          <div className="export-panel">
            <div className="export-header">
              <h4>Standard Output</h4>
              <div className="export-actions">
                <button
                  type="button"
                  className={exportFormat === 'markdown' ? 'chip active' : 'chip'}
                  onClick={() => setExportFormat('markdown')}
                >
                  Markdown
                </button>
                <button
                  type="button"
                  className={exportFormat === 'json' ? 'chip active' : 'chip'}
                  onClick={() => setExportFormat('json')}
                >
                  JSON
                </button>
                <button type="button" className="ghost" onClick={handleCopy}>
                  Copy
                </button>
              </div>
            </div>
            <pre className="export-body">{exportText}</pre>
          </div>
        </aside>
      </main>
      <footer className="app-footer">
        <span>Copyright © {new Date().getFullYear()}</span>
        <a href="https://ahara.io" target="_blank" rel="noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
    </div>
  )
}

export default App
