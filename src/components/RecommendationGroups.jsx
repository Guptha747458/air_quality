import React, { useState, useMemo } from 'react';
import { Icon } from './Icon.jsx';

function RecommendationGroupsComponent({
  members = [],
  fallback = false,
  t,
}) {
  const [selectedRole, setSelectedRole] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  // Filter members by role and search
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchRole =
        selectedRole === 'all' ||
        (selectedRole === 'children' && m.role === 'child') ||
        (selectedRole === 'elderly' && m.role === 'elder') ||
        (selectedRole === 'vulnerable' && m.vulnerable) ||
        (selectedRole === 'adults' && m.role === 'adult');

      const matchSearch =
        !searchQuery.trim() ||
        m.label.toLowerCase().includes(searchQuery.toLowerCase());

      return matchRole && matchSearch;
    });
  }, [members, selectedRole, searchQuery]);

  // Pagination for 50+ members
  const totalPages = Math.ceil(filteredMembers.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, page, pageSize]);

  // Aggregate stats
  const counts = useMemo(() => {
    let children = 0, elderly = 0, vulnerable = 0, adults = 0;
    for (const m of members) {
      if (m.role === 'child') children++;
      else if (m.role === 'elder') elderly++;
      else adults++;
      if (m.vulnerable) vulnerable++;
    }
    return { children, elderly, vulnerable, adults };
  }, [members]);

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setPage(1);
  };

  if (!members.length) return null;

  return (
    <section className="members-section" aria-labelledby="routines-heading">
      <div className="section-title">
        <div>
          <span>{t.routine_eyebrow}</span>
          <h2 id="routines-heading">{t.routine_title}</h2>
        </div>
        <span className={`source-pill ${fallback ? 'fallback' : ''}`}>
          {fallback ? t.pill_fallback : t.pill_custom}
        </span>
      </div>

      {/* Role Segmentation Filters (Scalable for 50+ members) */}
      <nav className="member-nav" aria-label="Household Member View Filter">
        <button
          type="button"
          className={`member-pill ${selectedRole === 'all' ? 'active' : ''}`}
          onClick={() => handleRoleChange('all')}
        >
          👥 {t.all_family} ({members.length})
        </button>
        {counts.children > 0 && (
          <button
            type="button"
            className={`member-pill ${selectedRole === 'children' ? 'active' : ''}`}
            onClick={() => handleRoleChange('children')}
          >
            🧒 Children ({counts.children})
          </button>
        )}
        {counts.elderly > 0 && (
          <button
            type="button"
            className={`member-pill ${selectedRole === 'elderly' ? 'active' : ''}`}
            onClick={() => handleRoleChange('elderly')}
          >
            🧓 Seniors ({counts.elderly})
          </button>
        )}
        {counts.vulnerable > 0 && (
          <button
            type="button"
            className={`member-pill ${selectedRole === 'vulnerable' ? 'active' : ''}`}
            onClick={() => handleRoleChange('vulnerable')}
          >
            🩺 Sensitive Airways ({counts.vulnerable})
          </button>
        )}
        {counts.adults > 0 && (
          <button
            type="button"
            className={`member-pill ${selectedRole === 'adults' ? 'active' : ''}`}
            onClick={() => handleRoleChange('adults')}
          >
            👤 Adults ({counts.adults})
          </button>
        )}
      </nav>

      {/* Large Household Search Bar (if > 6 members) */}
      {members.length > 6 && (
        <div className="member-search-bar">
          <input
            type="search"
            placeholder="Search family member by name…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            aria-label="Filter household members"
          />
        </div>
      )}

      {/* Render Paginated Members */}
      {paginatedMembers.map((member) => (
        <article className="member-card card" key={member.id}>
          <div className="member-name">
            <div className="avatar">
              <Icon
                name={
                  member.role === 'child'
                    ? 'spark'
                    : member.role === 'elder'
                    ? 'shield'
                    : 'people'
                }
              />
            </div>
            <div>
              <h3>{member.label}</h3>
              <p>
                {member.vulnerable
                  ? 'Health Protected · Extra-sensitive routine'
                  : 'Standard healthy routine'}
              </p>
            </div>
          </div>
          <div className="period-grid">
            {['morning', 'afternoon', 'evening'].map((period) => {
              const item = member.periods[period];
              if (!item) return null;
              const humanContributors = (item.whyFactors || [])
                .slice(0, 3)
                .map((factor) => factor.label);
              return (
                <section className="period" key={period}>
                  <span className="period-label">{period}</span>
                  <h4>{item.activity}</h4>
                  <p className="reason">{item.why}</p>
                  <p className="impact">
                    <Icon name="leaf" size={16} />
                    {item.exposureEffect || 'Lower exposure option'}
                  </p>
                  {item.commute && (
                    <p className="commute-tip">
                      🚗 <strong>Commute:</strong> {item.commute}
                    </p>
                  )}
                  {humanContributors.length > 0 && (
                    <details className="xai-details">
                      <summary>{t.why_suggestion}</summary>
                      <p>
                        {humanContributors.join(', ')} {t.influenced}
                      </p>
                    </details>
                  )}
                </section>
              );
            })}
          </div>
        </article>
      ))}

      {/* Pagination Controls for Large Households */}
      {totalPages > 1 && (
        <div className="pagination-bar" role="navigation" aria-label="Member pagination">
          <button
            type="button"
            className="pagination-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <span>
            Page {page} of {totalPages} ({filteredMembers.length} members)
          </span>
          <button
            type="button"
            className="pagination-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}

export const RecommendationGroups = React.memo(RecommendationGroupsComponent);
