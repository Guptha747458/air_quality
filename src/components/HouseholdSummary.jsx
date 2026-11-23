import React, { useMemo } from 'react';
import { calculateDemographics } from '../utils/aqi.js';

function HouseholdSummaryComponent({ profile }) {
  const { size, children, elderly, adults, respiratory } = useMemo(
    () => calculateDemographics(profile),
    [profile]
  );

  return (
    <div className="household-summary" role="status" aria-label="Household Composition Summary">
      <span className="summary-title">Household ({size}):</span>
      <span className="summary-badge">
        👤 {adults} {adults === 1 ? 'Adult' : 'Adults'}
      </span>
      {children > 0 && (
        <span className="summary-badge">
          🧒 {children} {children === 1 ? 'Child' : 'Children'}
        </span>
      )}
      {elderly > 0 && (
        <span className="summary-badge">
          🧓 {elderly} {elderly === 1 ? 'Senior' : 'Seniors'}
        </span>
      )}
      {respiratory > 0 && (
        <span className="summary-badge sensitive">
          🩺 {respiratory} {respiratory === 1 ? 'Sensitive Airway' : 'Sensitive Airways'}
        </span>
      )}
    </div>
  );
}

export const HouseholdSummary = React.memo(HouseholdSummaryComponent);
