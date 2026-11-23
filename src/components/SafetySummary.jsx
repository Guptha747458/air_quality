import React, { useMemo } from 'react';
import { Icon } from './Icon.jsx';
import { capitalize } from '../utils/format.js';

function SafetySummaryComponent({ overrides = [], members = [], t }) {
  const groupedProtections = useMemo(() => {
    if (!overrides.length) return [];
    const map = new Map();
    for (const entry of overrides) {
      const id = entry.memberId || 'family';
      if (!map.has(id)) {
        const member = members.find((m) => m.id === id);
        map.set(id, {
          memberId: id,
          memberName: member ? member.label : id,
          role: member?.role || 'adult',
          vulnerable: member?.vulnerable ?? true,
          periods: [entry.period],
        });
      } else {
        const existing = map.get(id);
        if (!existing.periods.includes(entry.period)) {
          existing.periods.push(entry.period);
        }
      }
    }
    return Array.from(map.values());
  }, [overrides, members]);

  if (!groupedProtections.length) return null;

  return (
    <section className="card safety-log" aria-labelledby="safety-summary-heading">
      <div className="card-heading">
        <div className="heading-icon peach">
          <Icon name="shield" size={24} />
        </div>
        <div>
          <span>ACTIVE HEALTH SAFEGUARDS</span>
          <h2 id="safety-summary-heading">{t.safety_shield_title}</h2>
        </div>
      </div>
      <p className="reason">{t.safety_shield_sub}</p>
      <div className="safety-notices">
        {groupedProtections.map((item) => {
          const formattedPeriods = item.periods.map(capitalize).join(', ');
          return (
            <div className="safety-notice-card" key={item.memberId}>
              <div className="safety-notice-icon" aria-hidden="true">🛡️</div>
              <div className="safety-notice-content">
                <h4>
                  {item.memberName} · {formattedPeriods} {item.periods.length > 1 ? 'Routines' : 'Routine'} Protected
                </h4>
                <p>
                  Elevated outdoor air pollution exceeded the healthy threshold. Outdoor exertion was safely replaced with guided indoor activities to protect lung function and reduce particulate inhalation.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const SafetySummary = React.memo(SafetySummaryComponent);
