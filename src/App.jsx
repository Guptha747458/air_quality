import React, { useMemo, useRef, useState } from 'react';

const Icon = ({ name, size = 20 }) => {
  const paths = {
    wind: <><path d="M3 8h9a3 3 0 1 0-3-3" /><path d="M3 12h13a3 3 0 1 1-3 3" /><path d="M3 16h6" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2" /><path d="M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v2" /></>,
    leaf: <><path d="M20 4C10 4 4 9 4 15c0 3 2 5 5 5 6 0 11-6 11-16Z" /><path d="M4 20c3-6 7-9 12-12" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-5" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 10h8M8 14h5" /></>,
    spark: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

const initialProfile = {
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
};

function ForecastChart({ forecast }) {
  const points = Array.isArray(forecast) ? forecast.slice(0, 24) : [];
  if (!points.length) return <div className="empty-chart">No forecast available yet</div>;
  const width = 640, height = 220, pad = 38;
  const maxValue = Math.max(150, ...points.map((p) => Number(p.pm25 || 0)));
  const x = (i) => pad + i * (width - pad * 2) / Math.max(1, points.length - 1);
  const y = (v) => height - 24 - Number(v) * (height - 62) / maxValue;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.pm25 || 0)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${height - 24} L${x(0)},${height - 24} Z`;
  return (
    <svg className="forecast-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="24-hour PM2.5 forecast">
      <title>24-hour PM2.5 forecast chart</title>
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7e57c2" stopOpacity=".28" /><stop offset="100%" stopColor="#7e57c2" stopOpacity=".02" /></linearGradient></defs>
      <path d={area} fill="url(#area)" />
      {[35, 55, 150].map((v) => <g key={v}><line x1={pad} x2={width-pad} y1={y(v)} y2={y(v)} className="threshold" /><text x={pad} y={y(v)-7}>{v} µg/m³</text></g>)}
      <path d={path} className="forecast-line" />
    </svg>
  );
}

async function postJson(path, payload) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function Field({ id, name, label, children, wide }) {
  const control = React.isValidElement(children)
    ? React.cloneElement(children, { id, name })
    : children;
  return (
    <label className={`field ${wide ? 'wide' : ''}`} htmlFor={id}>
      <span>{label}</span>
      {control}
    </label>
  );
}

export default function App() {
  const [profile, setProfile] = useState(initialProfile);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const requestSequence = useRef(0);

  const set = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const setCount = (key, value, maximum, minimum = 0) => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed))) : minimum;
    setProfile((current) => {
      const next = { ...current, [key]: safeValue };
      if (key === 'householdSize') {
        next.children = Math.min(next.children, safeValue);
        next.elderly = Math.min(next.elderly, safeValue - next.children);
        next.respiratoryConditions = Math.min(next.respiratoryConditions, safeValue - next.children - next.elderly);
      } else if (key === 'children') {
        next.elderly = Math.min(next.elderly, next.householdSize - safeValue);
        next.respiratoryConditions = Math.min(next.respiratoryConditions, next.householdSize - safeValue - next.elderly);
      } else if (key === 'elderly') {
        next.respiratoryConditions = Math.min(next.respiratoryConditions, next.householdSize - next.children - safeValue);
      }
      return next;
    });
  };
  const aq = data?.airQuality;
  const aqiText = aq?.aqi == null ? 'No live reading' : `${aq.aqi}`;

  const generate = async () => {
    const requestId = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      const result = await postJson('/api/plan', { location: profile.location, household: profile });
      if (requestId === requestSequence.current) setData(result);
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause.message);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  const ask = async () => {
    if (!question.trim()) return;
    try {
      const result = await postJson('/api/qa', { location: profile.location, household: profile, question });
      setAnswer(result.answer);
    } catch (cause) { setAnswer(cause.message); }
  };

  const members = data?.plan?.members || [];
  const category = useMemo(() => aq?.aqi == null ? 'unavailable' : aq.aqi > 150 ? 'hazardous' : aq.aqi > 100 ? 'high' : aq.aqi > 50 ? 'moderate' : 'good', [aq]);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Breathe home"><span className="brand-mark"><Icon name="wind" size={25} /></span><span>Breathe</span></a>
        <div className="top-actions"><button className="icon-button" aria-label="Toggle language between English and Hindi" onClick={() => set('language', profile.language === 'en' ? 'hi' : 'en')}>अ</button><span className="status-dot" role="status" aria-label="Location status active" /></div>
      </header>

      <div className="shell">
        <section className="hero">
          <div><span className="eyebrow">DAILY AIR GUIDE</span><h1>Make the day<br />feel a little lighter.</h1></div>
          <div className="air-orb" data-category={category}><Icon name="wind" size={30} /><div><strong>{aqiText}</strong><span>US AQI</span></div></div>
        </section>

        <section className="setup-card card">
          <div className="card-heading"><div className="heading-icon"><Icon name="pin" /></div><div><span>YOUR LOCATION</span><h2>Plan your household</h2></div></div>
          <div className="form-grid">
            <Field id="location" name="location" label="City, town or village" wide><input value={profile.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Raipur" autoComplete="address-level2" /></Field>
            <Field id="household-size" name="householdSize" label="Household size"><input type="number" inputMode="numeric" min="1" max="12" step="1" value={profile.householdSize} onChange={(e) => setCount('householdSize', e.target.value, 12, 1)} onBlur={(e) => setCount('householdSize', e.target.value || 1, 12, 1)} /></Field>
            <Field id="children-count" name="children" label="Children"><input type="number" inputMode="numeric" min="0" max={profile.householdSize} step="1" value={profile.children} onChange={(e) => setCount('children', e.target.value, profile.householdSize)} /></Field>
            <Field id="elderly-count" name="elderly" label="Elderly"><input type="number" inputMode="numeric" min="0" max={Math.max(0, profile.householdSize - profile.children)} step="1" value={profile.elderly} onChange={(e) => setCount('elderly', e.target.value, Math.max(0, profile.householdSize - profile.children))} /></Field>
            <Field id="respiratory-count" name="respiratoryConditions" label="Respiratory conditions"><input type="number" inputMode="numeric" min="0" max={Math.max(0, profile.householdSize - profile.children - profile.elderly)} step="1" value={profile.respiratoryConditions} onChange={(e) => setCount('respiratoryConditions', e.target.value, Math.max(0, profile.householdSize - profile.children - profile.elderly))} /></Field>
            <Field id="commute-mode" name="commuteMode" label="Commute"><select value={profile.commuteMode} onChange={(e) => set('commuteMode', e.target.value)}>{['car','two_wheeler','bus','train','walk','cycle','work_from_home'].map((v) => <option value={v} key={v}>{v.replaceAll('_',' ')}</option>)}</select></Field>
            <Field id="cooking-fuel" name="cookingFuel" label="Cooking fuel"><select value={profile.cookingFuel} onChange={(e) => set('cookingFuel', e.target.value)}>{['lpg','gas','electric','induction','wood','charcoal','biomass','kerosene','none'].map((v) => <option value={v} key={v}>{v}</option>)}</select></Field>
            <Field id="heating-source" name="heatingSource" label="Heating"><select value={profile.heatingSource} onChange={(e) => set('heatingSource', e.target.value)}>{['none','electric','central_electric','gas','wood','charcoal','biomass','kerosene'].map((v) => <option value={v} key={v}>{v.replaceAll('_',' ')}</option>)}</select></Field>
          </div>
          <div className="toggle-row">
            <label className="toggle"><input id="asthma" name="asthma" type="checkbox" checked={profile.asthma} onChange={(e) => set('asthma', e.target.checked)} /><span aria-hidden="true" />Asthma or other respiratory condition</label>
            <label className="toggle"><input id="outdoor-work" name="outdoorWork" type="checkbox" checked={profile.outdoorWork} onChange={(e) => set('outdoorWork', e.target.checked)} /><span aria-hidden="true" />Outdoor work</label>
          </div>
          <button className="primary-button" onClick={generate} disabled={loading || !profile.location.trim()} aria-busy={loading}>{loading ? 'Reading the air…' : <><Icon name="spark" />Create my day</>}</button>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        {data && <>
          {data.note && <p className="data-note">{data.note}</p>}
          <section className="overview-grid">
            <article className="card health-card"><div className="card-heading"><div className="heading-icon peach"><Icon name="shield" /></div><div><span>RIGHT NOW</span><h2>Air quality</h2></div></div><div className="health-reading"><strong>{aqiText}</strong><span>{category === 'good' ? 'Good' : category === 'moderate' ? 'Moderate' : category === 'high' ? 'High' : category === 'hazardous' ? 'Unhealthy' : 'Unavailable'}</span></div><p>{aq?.pm25 == null ? 'Live particle data is unavailable.' : `PM2.5: ${aq.pm25} µg/m³`}</p></article>
            <article className="card forecast-card"><div className="card-heading"><div className="heading-icon lilac"><Icon name="wind" /></div><div><span>24-HOUR OUTLOOK</span><h2>PM2.5 forecast</h2></div></div><ForecastChart forecast={aq?.forecast} /></article>
          </section>

          <section className="members-section">
            <div className="section-title"><div><span>PERSONALISED ROUTINE</span><h2>Everyone’s day</h2></div><span className={`source-pill ${data.fallback ? 'fallback' : ''}`}>{data.fallback ? 'Safety-guided plan' : 'Personalised plan'}</span></div>
            {members.map((member) => (
              <article className="member-card card" key={member.id}>
                <div className="member-name"><div className="avatar"><Icon name="people" /></div><div><h3>{member.label}</h3><p>{member.vulnerable ? 'Extra-sensitive routine' : 'Standard routine'}</p></div></div>
                <div className="period-grid">{['morning','afternoon','evening'].map((period) => {
                  const item = member.periods[period];
                  const humanContributors = (item.whyFactors || []).slice(0, 3).map((factor) => factor.label);
                  return <section className="period" key={period}><span className="period-label">{period}</span><h4>{item.activity}</h4><p className="reason">{item.why}</p><p className="impact"><Icon name="leaf" size={16} />{item.exposureEffect || 'Lower exposure option'}</p>{humanContributors.length > 0 && <details className="xai-details"><summary>Why this suggestion</summary><p>{humanContributors.join(', ')} influenced this advice.</p></details>}</section>;
                })}</div>
              </article>
            ))}
          </section>

          <section className="action-grid">
            <article className="card"><div className="card-heading"><div className="heading-icon mint"><Icon name="leaf" /></div><div><span>HOME</span><h2>Indoor air hacks</h2></div></div><ul className="action-list">{(data.plan.indoorAirHacks || []).map((x) => <li key={x}>{x}</li>)}</ul></article>
            <article className="card"><div className="card-heading"><div className="heading-icon yellow"><Icon name="people" /></div><div><span>LOWER EMISSIONS</span><h2>Cleaner alternatives</h2></div></div><ul className="action-list">{(data.plan.sustainableAlternatives || []).map((x) => <li key={x}>{x}</li>)}</ul></article>
          </section>

          <section className="card qa-card"><div className="card-heading"><div className="heading-icon blue"><Icon name="chat" /></div><div><span>FOLLOW-UP</span><h2>Ask about today</h2></div></div><div className="qa-row"><textarea id="air-question" name="question" rows="2" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Can I walk after lunch?" aria-label="Ask question about air quality" /><button className="ask-button" onClick={ask} aria-label="Ask question">Ask</button></div>{answer && <p className="answer" role="region" aria-live="polite">{answer}</p>}</section>

          {data.overrides?.length > 0 && <details className="card safety-log"><summary>Safety replacements · {data.overrides.length}</summary><div className="table-wrap"><table><thead><tr><th>Time</th><th>Member</th><th>Period</th><th>Replacement</th></tr></thead><tbody>{data.overrides.map((entry, i) => <tr key={i}><td>{new Date(entry.timestamp).toLocaleTimeString()}</td><td>{entry.memberId}</td><td>{entry.period}</td><td>{entry.action}</td></tr>)}</tbody></table></div></details>}
        </>}
      </div>
    </main>
  );
}
