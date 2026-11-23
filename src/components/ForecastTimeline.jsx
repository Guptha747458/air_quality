import React, { useMemo, useState } from 'react';
import { Icon } from './Icon.jsx';
import { formatHour } from '../utils/format.js';

function ChartSkeleton() {
  return (
    <div className="chart-skeleton" role="progressbar" aria-label="Loading forecast data">
      <div className="chart-state-box">
        <Icon name="wind" size={32} />
        <h4>Loading 24-Hour Forecast…</h4>
        <p>Retrieving hourly meteorological dispersion and particulate trends.</p>
      </div>
    </div>
  );
}

function ForecastTimelineComponent({ forecast, isLoading, isError, onRetry }) {
  const [activePoint, setActivePoint] = useState(null);

  const points = useMemo(() => {
    return Array.isArray(forecast) ? forecast.slice(0, 24) : [];
  }, [forecast]);

  const chartMetrics = useMemo(() => {
    if (!points.length) return null;
    const width = 640;
    const height = 230;
    const pad = 38;
    const bottomPad = 32;
    const maxValue = Math.max(150, ...points.map((p) => Number(p.pm25 || 0)));

    const x = (i) => pad + (i * (width - pad * 2)) / Math.max(1, points.length - 1);
    const y = (v) => height - bottomPad - (Number(v) * (height - bottomPad - 38)) / maxValue;

    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.pm25 || 0)}`).join(' ');
    const area = `${path} L${x(points.length - 1)},${height - bottomPad} L${x(0)},${height - bottomPad} Z`;
    const timeTicks = [0, 6, 12, 18, 23].filter((idx) => idx < points.length);

    return { width, height, pad, bottomPad, x, y, path, area, timeTicks };
  }, [points]);

  if (isLoading) return <ChartSkeleton />;

  if (isError) {
    return (
      <div className="chart-state-box card" role="alert">
        <Icon name="shield" size={36} />
        <h4>Forecast Unavailable</h4>
        <p>Could not retrieve hourly forecast points from the air quality service.</p>
        {onRetry && (
          <button type="button" className="chart-retry-btn" onClick={onRetry}>
            <Icon name="refresh" size={14} /> Retry Forecast
          </button>
        )}
      </div>
    );
  }

  if (!points.length || !chartMetrics) {
    return (
      <div className="chart-state-box">
        <Icon name="wind" size={36} />
        <h4>No Forecast Available</h4>
        <p>Enter a city or town above and generate your plan to see hourly air trends.</p>
      </div>
    );
  }

  const { width, height, pad, bottomPad, x, y, path, area, timeTicks } = chartMetrics;
  const isPartial = points.length < 18;

  return (
    <div className="chart-container">
      {isPartial && (
        <div className="partial-data-banner" role="status">
          ⚠️ Notice: Showing partial forecast ({points.length} available hours).
        </div>
      )}
      <svg
        className="forecast-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="24-hour PM2.5 hourly forecast graph"
      >
        <title>24-hour PM2.5 forecast chart</title>
        <defs>
          <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7e57c2" stopOpacity=".32" />
            <stop offset="100%" stopColor="#7e57c2" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#chartAreaGrad)" />
        {[35, 55, 150].map((v) => (
          <g key={v}>
            <line x1={pad} x2={width - pad} y1={y(v)} y2={y(v)} className="threshold" />
            <text x={pad} y={y(v) - 6}>{v} µg/m³</text>
          </g>
        ))}
        {timeTicks.map((idx) => (
          <g key={idx}>
            <line
              x1={x(idx)}
              x2={x(idx)}
              y1={height - bottomPad}
              y2={height - bottomPad + 5}
              className="time-grid-line"
            />
            <text x={x(idx)} y={height - 10} className="chart-time-label">
              {formatHour(points[idx]?.time, idx)}
            </text>
          </g>
        ))}
        <path d={path} className="forecast-line" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.pm25 || 0)}
            r={activePoint?.index === i ? 6 : 3.5}
            fill={activePoint?.index === i ? '#4f2d7f' : '#7e57c2'}
            stroke="#fff"
            strokeWidth={1.5}
            className="chart-dot"
            tabIndex={0}
            role="button"
            aria-label={`${formatHour(p.time, i)}: ${p.pm25 ?? 0} µg/m³`}
            onMouseEnter={() => setActivePoint({ index: i, x: x(i), y: y(p.pm25 || 0), point: p })}
            onMouseLeave={() => setActivePoint(null)}
            onFocus={() => setActivePoint({ index: i, x: x(i), y: y(p.pm25 || 0), point: p })}
            onBlur={() => setActivePoint(null)}
          />
        ))}
      </svg>
      {activePoint && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${(activePoint.y / height) * 100}%`,
          }}
        >
          {formatHour(activePoint.point.time, activePoint.index)} · {activePoint.point.pm25 ?? 0} µg/m³ PM2.5
          {activePoint.point.aqi != null ? ` (AQI ${activePoint.point.aqi})` : ''}
        </div>
      )}
    </div>
  );
}

export const ForecastTimeline = React.memo(ForecastTimelineComponent);
