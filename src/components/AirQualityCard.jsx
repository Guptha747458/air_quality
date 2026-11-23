import React, { useMemo } from 'react';
import { Icon } from './Icon.jsx';
import { getAqiDetails, getBestOutdoorWindow } from '../utils/aqi.js';

function AirQualityCardComponent({ airQuality, language = 'en', t }) {
  const aq = airQuality;
  const aqi = aq?.aqi;
  const aqiDetails = useMemo(() => getAqiDetails(aqi, language), [aqi, language]);
  const bestOutdoorTime = useMemo(
    () => getBestOutdoorWindow(aq?.forecast, language),
    [aq?.forecast, language]
  );

  return (
    <article className="card health-card" aria-labelledby="air-quality-heading">
      <div className="card-heading">
        <div className="heading-icon peach">
          <Icon name="shield" size={24} />
        </div>
        <div>
          <span>{t.right_now}</span>
          <h2 id="air-quality-heading">{t.air_quality}</h2>
        </div>
      </div>

      <div className="health-reading">
        <strong>{aqi != null ? aqi : '—'}</strong>
        <span className={`risk-tag ${aqiDetails.category}`}>{aqiDetails.label}</span>
      </div>

      <p className="health-desc">{aqiDetails.desc}</p>

      {/* 5-Second Executive Health Matrix */}
      <div className="insights-matrix" role="region" aria-label="Quick Air Quality Insights">
        <div className="insight-item">
          <span className="insight-label">⚡ {t.risk_label || 'Risk Level'}</span>
          <strong className="insight-value">{aqiDetails.riskLevel}</strong>
        </div>
        <div className="insight-item">
          <span className="insight-label">🕒 {t.best_time_label || 'Best Outdoor Window'}</span>
          <strong className="insight-value highlight">{bestOutdoorTime}</strong>
        </div>
        <div className="insight-item full-width">
          <span className="insight-label">🎯 Action for Today</span>
          <span className="insight-action">{aqiDetails.actionPrompt}</span>
        </div>
      </div>

      {/* Pollutant Metrics */}
      <div className="pollutant-row">
        <div>
          <span>PM2.5:</span> <strong>{aq?.pm25 != null ? `${aq.pm25} µg/m³` : 'N/A'}</strong>
        </div>
        <div>
          <span>PM10:</span> <strong>{aq?.pm10 != null ? `${aq.pm10} µg/m³` : 'N/A'}</strong>
        </div>
        <div>
          <span>Wind:</span> <strong>{aq?.windSpeed != null ? `${aq.windSpeed} km/h` : 'Calm'}</strong>
        </div>
      </div>
    </article>
  );
}

export const AirQualityCard = React.memo(AirQualityCardComponent);
