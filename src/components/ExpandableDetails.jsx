import React, { useState } from 'react';
import { Icon } from './Icon.jsx';

function ExpandableDetailsComponent({
  title,
  subtitle,
  icon = 'leaf',
  iconColor = 'mint',
  defaultExpanded = false,
  children,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article className="card expandable-card">
      <button
        type="button"
        className="expandable-header-btn"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="card-heading-compact">
          <div className={`heading-icon ${iconColor}`}>
            <Icon name={icon} size={20} />
          </div>
          <div className="heading-text">
            {subtitle && <span className="eyebrow-compact">{subtitle}</span>}
            <h3 className="expandable-title">{title}</h3>
          </div>
        </div>
        <div className={`expand-icon-wrap ${expanded ? 'open' : ''}`}>
          <Icon name="chevronDown" size={18} />
        </div>
      </button>

      {expanded && <div className="expandable-body">{children}</div>}
    </article>
  );
}

export const ExpandableDetails = React.memo(ExpandableDetailsComponent);
