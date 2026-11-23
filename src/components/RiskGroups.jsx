import React, { useMemo } from 'react';
import { Icon } from './Icon.jsx';
import { getAqiDetails, calculateDemographics } from '../utils/aqi.js';

function RiskGroupsComponent({ aqi, profile, language = 'en', t }) {
  const aqiDetails = useMemo(() => getAqiDetails(aqi, language), [aqi, language]);
  const { children, elderly, respiratory } = useMemo(
    () => calculateDemographics(profile),
    [profile]
  );

  const aqiVal = Number(aqi) || 0;
  const isVulnerableActive = aqiVal > 100;
  const isGeneralActive = aqiVal > 150;

  const groups = [
    {
      role: 'Children',
      icon: 'spark',
      count: children,
      active: children > 0,
      impact: isVulnerableActive ? 'High Risk' : 'Safe',
      rule: isVulnerableActive
        ? 'Lungs still developing; avoid outdoor sports and stay indoors during peak traffic.'
        : 'Outdoor recreation and playtime are healthy and encouraged.',
    },
    {
      role: 'Seniors (65+)',
      icon: 'shield',
      count: elderly,
      active: elderly > 0,
      impact: isVulnerableActive ? 'High Risk' : 'Safe',
      rule: isVulnerableActive
        ? 'Cardiovascular and respiratory vulnerability; avoid strenuous morning walks.'
        : 'Regular gentle walking and garden time are safe.',
    },
    {
      role: 'Sensitive Airways / Asthma',
      icon: 'people',
      count: respiratory,
      active: respiratory > 0,
      impact: isVulnerableActive ? 'High Alert' : 'Normal',
      rule: isVulnerableActive
        ? 'Keep quick-relief inhalers accessible; keep windows closed and run air filters.'
        : 'Standard medication schedule; normal indoor ventilation permitted.',
    },
    {
      role: 'General Adults',
      icon: 'people',
      count: Math.max(1, profile.householdSize - children - elderly),
      active: true,
      impact: isGeneralActive ? 'Moderate Exertion Limit' : 'Safe',
      rule: isGeneralActive
        ? 'Avoid heavy outdoor cardio workouts; wear a well-fitted mask during long commutes.'
        : 'All outdoor exercise, runs, and commutes are safe.',
    },
  ];

  return (
    <article className="card risk-groups-card" aria-labelledby="risk-groups-heading">
      <div className="card-heading">
        <div className="heading-icon yellow">
          <Icon name="people" size={24} />
        </div>
        <div>
          <span>WHO & EPA HEALTH TIERS</span>
          <h2 id="risk-groups-heading">Affected Vulnerability Groups</h2>
        </div>
      </div>

      <p className="risk-summary-text">
        <strong>Status:</strong> {aqiDetails.whoAffected}
      </p>

      <div className="risk-grid">
        {groups.map((g) => (
          <div
            key={g.role}
            className={`risk-card ${g.active ? 'in-household' : 'not-present'} ${
              g.impact.includes('High') || g.impact.includes('Alert') ? 'alert' : ''
            }`}
          >
            <div className="risk-card-header">
              <Icon name={g.icon} size={18} />
              <h4>{g.role}</h4>
              {g.count > 0 && <span className="member-count-pill">{g.count} present</span>}
            </div>
            <p className="risk-card-rule">{g.rule}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export const RiskGroups = React.memo(RiskGroupsComponent);
