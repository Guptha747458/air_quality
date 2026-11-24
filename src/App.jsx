import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Icon } from './components/Icon.jsx';
import { AirQualityCard } from './components/AirQualityCard.jsx';
import { HouseholdSummary } from './components/HouseholdSummary.jsx';
import { RiskGroups } from './components/RiskGroups.jsx';
import { RecommendationGroups } from './components/RecommendationGroups.jsx';
import { SafetySummary } from './components/SafetySummary.jsx';
import { ForecastTimeline } from './components/ForecastTimeline.jsx';
import { QuickAnswers } from './components/QuickAnswers.jsx';
import { ExpandableDetails } from './components/ExpandableDetails.jsx';

import { getAqiDetails } from './utils/aqi.js';
import { sanitizeInputNumber } from './utils/format.js';
import { DICT, POPULAR_CITIES } from './utils/translations.js';

const initialProfile = Object.freeze({
  location: '',
  householdSize: 2,
  children: 0,
  elderly: 0,
  respiratoryConditions: 0,
  asthma: false,
  outdoorWork: false,
  commuteMode: 'bus',
  cookingFuel: 'lpg',
  heatingSource: 'electric',
  language: 'en',
});

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const Field = React.memo(function Field({ id, name, label, children, wide }) {
  const control = React.isValidElement(children)
    ? React.cloneElement(children, { id, name })
    : children;
  return (
    <label className={`field ${wide ? 'wide' : ''}`} htmlFor={id}>
      <span>{label}</span>
      {control}
    </label>
  );
});

export default function App() {
  const [profile, setProfile] = useState(initialProfile);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [theme, setTheme] = useState('light');
  const requestSequence = useRef(0);

  const t = useMemo(() => DICT[profile.language] || DICT.en, [profile.language]);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((curr) => (curr === 'light' ? 'dark' : 'light'));
  }, []);

  const setField = useCallback((key, value) => {
    setProfile((current) => ({ ...current, [key]: value }));
  }, []);

  const setCount = useCallback((key, rawValue, maximum, minimum = 0) => {
    const safeValue = sanitizeInputNumber(rawValue, maximum, minimum);
    setProfile((current) => {
      const next = { ...current, [key]: safeValue };
      if (key === 'householdSize') {
        next.children = Math.min(next.children, safeValue);
        next.elderly = Math.min(next.elderly, safeValue - next.children);
        next.respiratoryConditions = Math.min(
          next.respiratoryConditions,
          safeValue - next.children - next.elderly
        );
      } else if (key === 'children') {
        next.elderly = Math.min(next.elderly, next.householdSize - safeValue);
        next.respiratoryConditions = Math.min(
          next.respiratoryConditions,
          next.householdSize - safeValue - next.elderly
        );
      } else if (key === 'elderly') {
        next.respiratoryConditions = Math.min(
          next.respiratoryConditions,
          next.householdSize - next.children - safeValue
        );
      }
      return next;
    });
  }, []);

  const aq = data?.airQuality;
  const aqiDetails = useMemo(() => getAqiDetails(aq?.aqi, profile.language), [aq?.aqi, profile.language]);
  const aqiDisplay = aq?.aqi == null ? (loading ? '…' : t.no_reading) : `${aq.aqi}`;

  const generate = useCallback(async () => {
    if (!profile.location.trim()) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await postJson('/api/plan', {
        location: profile.location,
        household: profile,
      });
      if (requestId === requestSequence.current) {
        setData(result);
      }
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause.message);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [profile]);

  const ask = useCallback(async (queryText) => {
    const query = (queryText || '').trim();
    if (!query || qaLoading) return;
    setQaLoading(true);
    setAnswer('');
    try {
      const result = await postJson('/api/qa', {
        location: profile.location,
        household: profile,
        question: query,
      });
      setAnswer(result.answer);
    } catch (cause) {
      setAnswer(cause.message);
    } finally {
      setQaLoading(false);
    }
  }, [profile, qaLoading]);

  const handleGeoLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude.toFixed(4);
          const lon = pos.coords.longitude.toFixed(4);
          const locStr = `${lat}, ${lon}`;
          setField('location', locStr);
          const requestId = ++requestSequence.current;
          const result = await postJson('/api/plan', {
            location: locStr,
            household: { ...profile, location: locStr },
          });
          if (requestId === requestSequence.current) {
            setData(result);
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError('Location access was denied. Please select or type your city.');
      },
      { timeout: 8000 }
    );
  }, [profile, setField]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Breathe home">
          <span className="brand-mark">
            <Icon name="wind" size={25} />
          </span>
          <span>{t.brand}</span>
        </a>
        <div className="top-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={toggleTheme}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Toggle language between English and Hindi"
            onClick={() => setField('language', profile.language === 'en' ? 'hi' : 'en')}
          >
            {profile.language === 'en' ? 'अ' : 'EN'}
          </button>
          <span className="status-dot" role="status" aria-label="Location status active" />
        </div>
      </header>

      <div className="shell">
        <section className="hero">
          <div>
            <span className="eyebrow">{t.hero_eyebrow}</span>
            <h1>{t.hero_title}</h1>
          </div>
          <div className="air-orb" data-category={aqiDetails.category}>
            <Icon name="wind" size={30} />
            <div>
              <strong>{aqiDisplay}</strong>
              <span>{t.hero_reading}</span>
            </div>
          </div>
        </section>

        {/* Location & Household Configuration */}
        <section className="setup-card card" aria-labelledby="setup-heading">
          <div className="card-heading">
            <div className="heading-icon">
              <Icon name="pin" size={24} />
            </div>
            <div>
              <span>{t.your_location}</span>
              <h2 id="setup-heading">{t.plan_heading}</h2>
            </div>
          </div>

          <div className="form-grid">
            <Field id="location" name="location" label={t.city_label} wide>
              <input
                value={profile.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder={t.city_placeholder}
                autoComplete="address-level2"
              />
            </Field>

            <Field id="household-size" name="householdSize" label={t.household_size}>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="50"
                step="1"
                value={profile.householdSize}
                onChange={(e) => setCount('householdSize', e.target.value, 50, 1)}
                onBlur={(e) => setCount('householdSize', e.target.value || 1, 50, 1)}
              />
            </Field>

            <Field id="children-count" name="children" label={t.children}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max={profile.householdSize}
                step="1"
                value={profile.children}
                onChange={(e) => setCount('children', e.target.value, profile.householdSize)}
              />
            </Field>

            <Field id="elderly-count" name="elderly" label={t.elderly}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max={Math.max(0, profile.householdSize - profile.children)}
                step="1"
                value={profile.elderly}
                onChange={(e) =>
                  setCount('elderly', e.target.value, Math.max(0, profile.householdSize - profile.children))
                }
              />
            </Field>

            <Field id="respiratory-count" name="respiratoryConditions" label={t.respiratory}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max={Math.max(0, profile.householdSize - profile.children - profile.elderly)}
                step="1"
                value={profile.respiratoryConditions}
                onChange={(e) =>
                  setCount(
                    'respiratoryConditions',
                    e.target.value,
                    Math.max(0, profile.householdSize - profile.children - profile.elderly)
                  )
                }
              />
            </Field>

            <Field id="commute-mode" name="commuteMode" label={t.commute}>
              <select
                value={profile.commuteMode}
                onChange={(e) => setField('commuteMode', e.target.value)}
              >
                {['bus', 'train', 'car', 'two_wheeler', 'walk', 'cycle', 'work_from_home'].map((v) => (
                  <option value={v} key={v}>
                    {v.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="cooking-fuel" name="cookingFuel" label={t.cooking}>
              <select
                value={profile.cookingFuel}
                onChange={(e) => setField('cookingFuel', e.target.value)}
              >
                {['lpg', 'gas', 'electric', 'induction', 'wood', 'charcoal', 'biomass', 'kerosene', 'none'].map((v) => (
                  <option value={v} key={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="heating-source" name="heatingSource" label={t.heating}>
              <select
                value={profile.heatingSource}
                onChange={(e) => setField('heatingSource', e.target.value)}
              >
                {['none', 'electric', 'central_electric', 'gas', 'wood', 'charcoal', 'biomass', 'kerosene'].map((v) => (
                  <option value={v} key={v}>
                    {v.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="chip-row">
            <span className="chip-label">Quick cities:</span>
            {POPULAR_CITIES.map((city) => (
              <button
                type="button"
                className="chip"
                key={city}
                onClick={() => setField('location', city)}
              >
                {city}
              </button>
            ))}
            <button
              type="button"
              className="chip geo-btn"
              onClick={handleGeoLocation}
              title="Detect current location coordinates"
            >
              <Icon name="crosshair" size={14} />
              {t.use_location}
            </button>
          </div>

          <HouseholdSummary profile={profile} />

          <div className="toggle-row">
            <label className="toggle">
              <input
                id="asthma"
                name="asthma"
                type="checkbox"
                checked={profile.asthma}
                onChange={(e) => setField('asthma', e.target.checked)}
              />
              <span aria-hidden="true" />
              {t.asthma}
            </label>
            <label className="toggle">
              <input
                id="outdoor-work"
                name="outdoorWork"
                type="checkbox"
                checked={profile.outdoorWork}
                onChange={(e) => setField('outdoorWork', e.target.checked)}
              />
              <span aria-hidden="true" />
              {t.outdoor_work}
            </label>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={generate}
            disabled={loading || !profile.location.trim()}
            aria-busy={loading}
          >
            {loading ? t.reading_btn : <><Icon name="spark" />{t.create_btn}</>}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        {/* Generated Health Plan & Analytical Visualizations */}
        {data && (
          <>
            {data.note && <p className="data-note">{data.note}</p>}

            {/* Phase 4 & 5: Executive Air Quality & 24h Trend */}
            <section className="overview-grid">
              <AirQualityCard
                airQuality={data.airQuality}
                language={profile.language}
                t={t}
              />

              <article className="card forecast-card" aria-labelledby="forecast-heading">
                <div className="card-heading">
                  <div className="heading-icon lilac">
                    <Icon name="wind" size={24} />
                  </div>
                  <div>
                    <span>{t.forecast_eyebrow}</span>
                    <h2 id="forecast-heading">{t.forecast_title}</h2>
                  </div>
                </div>
                <ForecastTimeline
                  forecast={aq?.forecast}
                  timezone={aq?.timezone}
                  isLoading={loading}
                  isError={!aq?.forecast && !!error}
                  onRetry={generate}
                />
              </article>
            </section>

            {/* Phase 4 & 5: RiskGroups (Who is affected in 2 seconds) */}
            <RiskGroups
              aqi={aq?.aqi}
              profile={profile}
              language={profile.language}
              t={t}
            />

            {/* Phase 4 & 7: RecommendationGroups (Supports 50+ members) */}
            <RecommendationGroups
              members={data?.plan?.members || []}
              fallback={data.fallback}
              t={t}
            />

            {/* Phase 4 & 5: Progressive Disclosure - Expandable Home & Community Actions */}
            <div className="action-grid">
              <ExpandableDetails
                title={t.hacks_title}
                subtitle={t.hacks_eyebrow}
                icon="leaf"
                iconColor="mint"
                defaultExpanded={false}
              >
                <ul className="action-list">
                  {(data.plan?.indoorAirHacks || []).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </ExpandableDetails>

              <ExpandableDetails
                title={t.alternatives_title}
                subtitle={t.alternatives_eyebrow}
                icon="people"
                iconColor="yellow"
                defaultExpanded={false}
              >
                <ul className="action-list">
                  {(data.plan?.sustainableAlternatives || []).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </ExpandableDetails>
            </div>

            {/* Phase 4: QuickAnswers (Deduplicated FAQs & Consultation) */}
            <QuickAnswers
              onAsk={ask}
              loading={qaLoading}
              answer={answer}
              language={profile.language}
              t={t}
            />

            {/* Phase 4 & 6: SafetySummary (Grouped Interventions, Friendly Language) */}
            <SafetySummary
              overrides={data.overrides}
              members={data?.plan?.members || []}
              t={t}
            />
          </>
        )}
      </div>
    </main>
  );
}
