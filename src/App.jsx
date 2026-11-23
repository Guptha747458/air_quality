import React, { useMemo, useRef, useState, useEffect } from 'react';

const Icon = ({ name, size = 20 }) => {
  const paths = {
    wind: <><path d="M3 8h9a3 3 0 1 0-3-3" /><path d="M3 12h13a3 3 0 1 1-3 3" /><path d="M3 16h6" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2" /><path d="M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v2" /></>,
    leaf: <><path d="M20 4C10 4 4 9 4 15c0 3 2 5 5 5 6 0 11-6 11-16Z" /><path d="M4 20c3-6 7-9 12-12" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-5" /></>,
    chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 10h8M8 14h5" /></>,
    spark: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    crosshair: <><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>,
    moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
    refresh: <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

const DICT = {
  en: {
    brand: 'Breathe',
    hero_eyebrow: 'DAILY AIR HEALTH GUIDE',
    hero_title: 'Personalised routines for cleaner, safer air.',
    hero_reading: 'US AQI',
    no_reading: 'Ready',
    your_location: 'LOCATION & HOUSEHOLD',
    plan_heading: 'Personalise your protection',
    city_label: 'City, town or village',
    city_placeholder: 'e.g. Raipur, Delhi, London',
    use_location: 'Detect location',
    household_size: 'Total household members',
    children: 'Children (under 18)',
    elderly: 'Seniors (65+)',
    respiratory: 'Members with asthma or lung conditions',
    commute: 'Primary commute',
    cooking: 'Cooking fuel',
    heating: 'Primary heating',
    asthma: 'Asthma/respiratory vulnerability in household',
    outdoor_work: 'Family members work outdoors',
    create_btn: 'Generate Health Plan',
    reading_btn: 'Analyzing local air quality…',
    right_now: 'AIR QUALITY METRICS',
    air_quality: 'Current exposure',
    forecast_eyebrow: '24-HOUR OUTLOOK',
    forecast_title: 'PM2.5 hourly trend',
    routine_eyebrow: 'PERSONALISED DAILY ROUTINE',
    routine_title: 'Everyone’s day',
    all_family: 'All Family Overview',
    pill_fallback: 'Verified Safety Plan',
    pill_custom: 'AI-Personalised Plan',
    hacks_eyebrow: 'HOME PROTECTION',
    hacks_title: 'Indoor air safeguards',
    alternatives_eyebrow: 'COMMUNITY EMISSIONS',
    alternatives_title: 'Cleaner daily alternatives',
    qa_eyebrow: 'EXPERT CONSULTATION',
    qa_title: 'Ask a question about today’s air',
    qa_placeholder: 'e.g. Can I walk or jog after lunch?',
    ask: 'Ask',
    asking: 'Analyzing…',
    safety_shield_title: 'Active Safety Shield Protections',
    safety_shield_sub: 'Strict WHO/EPA safety rules automatically adjusted activities for vulnerable members:',
    why_suggestion: 'Clinical reasoning',
    influenced: 'directly influenced this advice.',
  },
  hi: {
    brand: 'साँस',
    hero_eyebrow: 'दैनिक वायु स्वास्थ्य मार्गदर्शिका',
    hero_title: 'स्वच्छ और सुरक्षित सांस के लिए व्यक्तिगत योजना।',
    hero_reading: 'AQI सूचकांक',
    no_reading: 'तैयार',
    your_location: 'स्थान और परिवार विवरण',
    plan_heading: 'सुरक्षा योजना तैयार करें',
    city_label: 'शहर, कस्बा या गाँव',
    city_placeholder: 'उदा. रायपुर, दिल्ली, जयपुर',
    use_location: 'स्थान पहचानें',
    household_size: 'परिवार के कुल सदस्य',
    children: 'बच्चे (18 वर्ष से कम)',
    elderly: 'वरिष्ठ नागरिक (65+)',
    respiratory: 'सांस या दमा से पीड़ित सदस्य',
    commute: 'यात्रा का मुख्य माध्यम',
    cooking: 'रसोई का ईंधन',
    heating: 'हीटिंग स्रोत',
    asthma: 'परिवार में अस्थमा या सांस की संवेदनशीलता',
    outdoor_work: 'खुले वातावरण में काम करने वाले सदस्य',
    create_btn: 'दैनिक स्वास्थ्य योजना बनाएं',
    reading_btn: 'हवा की जांच की जा रही है…',
    right_now: 'हवा की वर्तमान स्थिति',
    air_quality: 'प्रदूषण स्तर',
    forecast_eyebrow: '24 घंटे का पूर्वानुमान',
    forecast_title: 'PM2.5 प्रति घंटा रुझान',
    routine_eyebrow: 'व्यक्तिगत दिनचर्या',
    routine_title: 'परिवार के हर सदस्य का दिन',
    all_family: 'पूरा परिवार सारांश',
    pill_fallback: 'सत्यापित सुरक्षा योजना',
    pill_custom: 'अनुकूलित स्वास्थ्य योजना',
    hacks_eyebrow: 'घर की सुरक्षा',
    hacks_title: 'घर की हवा सुधारने के उपाय',
    alternatives_eyebrow: 'प्रदूषण रोकथाम',
    alternatives_title: 'पर्यावरण-अनुकूल विकल्प',
    qa_eyebrow: 'संदेह निवारण',
    qa_title: 'आज की हवा के बारे में पूछें',
    qa_placeholder: 'उदा. क्या दोपहर बाद टहलना सुरक्षित है?',
    ask: 'पूछें',
    asking: 'सोच रहे हैं…',
    safety_shield_title: 'सक्रिय सुरक्षा उपाय',
    safety_shield_sub: 'संवेदनशील सदस्यों की सुरक्षा हेतु दिनचर्या स्वतः संशोधित की गई:',
    why_suggestion: 'परामर्श का आधार',
    influenced: 'ने इस परामर्श को निर्धारित किया।',
  },
};

const POPULAR_CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Kolkata', 'Hyderabad', 'Pune'];

const QA_QUICK_PICKS = {
  en: [
    'Can I exercise outdoors today?',
    'Is it safe for children to play outside?',
    'Should we open windows for ventilation?',
  ],
  hi: [
    'क्या आज बाहर दौड़ना या व्यायाम करना सुरक्षित है?',
    'क्या बच्चों का आज बाहर खेलना सुरक्षित है?',
    'क्या आज ताज़ी हवा के लिए खिड़कियाँ खोलनी चाहिए?',
  ],
};

function getAqiDetails(aqi, lang = 'en') {
  if (aqi == null) return { category: 'unavailable', label: lang === 'hi' ? 'अनुपलब्ध' : 'Unavailable', desc: 'No live sensor reading' };
  const val = Number(aqi);
  if (val <= 50) return { category: 'good', label: lang === 'hi' ? 'अच्छा (0-50)' : 'Good (0–50)', desc: 'Air quality is satisfactory; air pollution poses little or no risk.' };
  if (val <= 100) return { category: 'moderate', label: lang === 'hi' ? 'मध्यम (51-100)' : 'Moderate (51–100)', desc: 'Acceptable air quality; very sensitive individuals may experience mild symptoms.' };
  if (val <= 150) return { category: 'usg', label: lang === 'hi' ? 'संवेदनशील वर्गों के लिए अस्वस्थ (101-150)' : 'Sensitive Groups (101–150)', desc: 'Children, elders, and individuals with respiratory issues should limit prolonged outdoor exertion.' };
  if (val <= 200) return { category: 'unhealthy', label: lang === 'hi' ? 'अस्वस्थ (151-200)' : 'Unhealthy (151–200)', desc: 'Everyone may begin to experience health effects; vulnerable groups avoid outdoor exertion.' };
  if (val <= 300) return { category: 'very-unhealthy', label: lang === 'hi' ? 'बहुत अस्वस्थ (201-300)' : 'Very Unhealthy (201–300)', desc: 'Health alert: serious risk of health effects for all household members.' };
  return { category: 'hazardous', label: lang === 'hi' ? 'खतरनाक (301+)' : 'Hazardous (301+)', desc: 'Health warning of emergency conditions. Entire population is likely affected.' };
}

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

function ForecastChart({ forecast, isLoading, isError, onRetry }) {
  const [activePoint, setActivePoint] = useState(null);

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

  const points = Array.isArray(forecast) ? forecast.slice(0, 24) : [];
  if (!points.length) {
    return (
      <div className="chart-state-box">
        <Icon name="wind" size={36} />
        <h4>No Forecast Available</h4>
        <p>Enter a city or town above and generate your plan to see hourly air trends.</p>
      </div>
    );
  }

  const isPartial = points.length < 18;
  const width = 640, height = 230, pad = 38, bottomPad = 32;
  const maxValue = Math.max(150, ...points.map((p) => Number(p.pm25 || 0)));
  const x = (i) => pad + (i * (width - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v) => height - bottomPad - (Number(v) * (height - bottomPad - 38)) / maxValue;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.pm25 || 0)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${height - bottomPad} L${x(0)},${height - bottomPad} Z`;

  const timeTicks = [0, 6, 12, 18, 23].filter((idx) => idx < points.length);

  const formatHour = (isoTime, index) => {
    if (!isoTime) return `+${index}h`;
    try {
      const d = new Date(isoTime);
      if (isNaN(d.getTime())) return `+${index}h`;
      const hrs = d.getHours();
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      const formatted = hrs % 12 || 12;
      return `${formatted} ${ampm}`;
    } catch {
      return `+${index}h`;
    }
  };

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
            <line x1={x(idx)} x2={x(idx)} y1={height - bottomPad} y2={height - bottomPad + 5} className="time-grid-line" />
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
  const [qaLoading, setQaLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('all');
  const [theme, setTheme] = useState('light');
  const requestSequence = useRef(0);

  const t = DICT[profile.language] || DICT.en;

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'));

  const set = (key, value) => setProfile((current) => ({ ...current, [key]: value }));

  const setCount = (key, rawValue, maximum, minimum = 0) => {
    const cleanStr = String(rawValue).replace(/^0+(?=\d)/, '');
    const parsed = parseInt(cleanStr, 10);
    const safeValue = Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : minimum;
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
  const aqiDetails = useMemo(() => getAqiDetails(aq?.aqi, profile.language), [aq?.aqi, profile.language]);
  const aqiDisplay = aq?.aqi == null ? (loading ? '…' : t.no_reading) : `${aq.aqi}`;

  const adultsCount = Math.max(0, profile.householdSize - profile.children - profile.elderly - profile.respiratoryConditions);

  const generate = async () => {
    if (!profile.location.trim()) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await postJson('/api/plan', { location: profile.location, household: profile });
      if (requestId === requestSequence.current) {
        setData(result);
        setSelectedMemberId('all');
      }
    } catch (cause) {
      if (requestId === requestSequence.current) setError(cause.message);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  const ask = async (qText = question) => {
    const query = (typeof qText === 'string' ? qText : question).trim();
    if (!query || qaLoading) return;
    setQaLoading(true);
    setAnswer('');
    try {
      const result = await postJson('/api/qa', { location: profile.location, household: profile, question: query });
      setAnswer(result.answer);
    } catch (cause) {
      setAnswer(cause.message);
    } finally {
      setQaLoading(false);
    }
  };

  const handleGeoLocation = () => {
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
          set('location', `${lat}, ${lon}`);
          const requestId = ++requestSequence.current;
          const result = await postJson('/api/plan', {
            location: `${lat}, ${lon}`,
            household: { ...profile, location: `${lat}, ${lon}` },
          });
          if (requestId === requestSequence.current) {
            setData(result);
            setSelectedMemberId('all');
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
  };

  const members = data?.plan?.members || [];
  const activeMembers = selectedMemberId === 'all'
    ? members
    : members.filter((m) => m.id === selectedMemberId);

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Breathe home">
          <span className="brand-mark"><Icon name="wind" size={25} /></span>
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
            onClick={() => set('language', profile.language === 'en' ? 'hi' : 'en')}
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

        <section className="setup-card card">
          <div className="card-heading">
            <div className="heading-icon"><Icon name="pin" /></div>
            <div>
              <span>{t.your_location}</span>
              <h2>{t.plan_heading}</h2>
            </div>
          </div>

          <div className="form-grid">
            <Field id="location" name="location" label={t.city_label} wide>
              <input
                value={profile.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder={t.city_placeholder}
                autoComplete="address-level2"
              />
            </Field>

            <Field id="household-size" name="householdSize" label={t.household_size}>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="12"
                step="1"
                value={profile.householdSize}
                onChange={(e) => setCount('householdSize', e.target.value, 12, 1)}
                onBlur={(e) => setCount('householdSize', e.target.value || 1, 12, 1)}
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
                onChange={(e) => setCount('elderly', e.target.value, Math.max(0, profile.householdSize - profile.children))}
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
                onChange={(e) => setCount('respiratoryConditions', e.target.value, Math.max(0, profile.householdSize - profile.children - profile.elderly))}
              />
            </Field>

            <Field id="commute-mode" name="commuteMode" label={t.commute}>
              <select value={profile.commuteMode} onChange={(e) => set('commuteMode', e.target.value)}>
                {['bus', 'train', 'car', 'two_wheeler', 'walk', 'cycle', 'work_from_home'].map((v) => (
                  <option value={v} key={v}>{v.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </Field>

            <Field id="cooking-fuel" name="cookingFuel" label={t.cooking}>
              <select value={profile.cookingFuel} onChange={(e) => set('cookingFuel', e.target.value)}>
                {['lpg', 'gas', 'electric', 'induction', 'wood', 'charcoal', 'biomass', 'kerosene', 'none'].map((v) => (
                  <option value={v} key={v}>{v}</option>
                ))}
              </select>
            </Field>

            <Field id="heating-source" name="heatingSource" label={t.heating}>
              <select value={profile.heatingSource} onChange={(e) => set('heatingSource', e.target.value)}>
                {['none', 'electric', 'central_electric', 'gas', 'wood', 'charcoal', 'biomass', 'kerosene'].map((v) => (
                  <option value={v} key={v}>{v.replaceAll('_', ' ')}</option>
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
                onClick={() => set('location', city)}
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

          <div className="household-summary">
            <span>Household Summary:</span>
            <strong>{adultsCount} Adults</strong>
            {profile.children > 0 && <span>· {profile.children} Children</span>}
            {profile.elderly > 0 && <span>· {profile.elderly} Seniors</span>}
            {profile.respiratoryConditions > 0 && <span>· {profile.respiratoryConditions} Respiratory Conditions</span>}
          </div>

          <div className="toggle-row">
            <label className="toggle">
              <input
                id="asthma"
                name="asthma"
                type="checkbox"
                checked={profile.asthma}
                onChange={(e) => set('asthma', e.target.checked)}
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
                onChange={(e) => set('outdoorWork', e.target.checked)}
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

        {data && (
          <>
            {data.note && <p className="data-note">{data.note}</p>}
            <section className="overview-grid">
              <article className="card health-card">
                <div className="card-heading">
                  <div className="heading-icon peach"><Icon name="shield" /></div>
                  <div>
                    <span>{t.right_now}</span>
                    <h2>{t.air_quality}</h2>
                  </div>
                </div>
                <div className="health-reading">
                  <strong>{aqiDisplay}</strong>
                  <span>{aqiDetails.label}</span>
                </div>
                <p className="health-desc">{aqiDetails.desc}</p>
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

              <article className="card forecast-card">
                <div className="card-heading">
                  <div className="heading-icon lilac"><Icon name="wind" /></div>
                  <div>
                    <span>{t.forecast_eyebrow}</span>
                    <h2>{t.forecast_title}</h2>
                  </div>
                </div>
                <ForecastChart
                  forecast={aq?.forecast}
                  isLoading={loading}
                  isError={!aq?.forecast && !!error}
                  onRetry={generate}
                />
              </article>
            </section>

            <section className="members-section">
              <div className="section-title">
                <div>
                  <span>{t.routine_eyebrow}</span>
                  <h2>{t.routine_title}</h2>
                </div>
                <span className={`source-pill ${data.fallback ? 'fallback' : ''}`}>
                  {data.fallback ? t.pill_fallback : t.pill_custom}
                </span>
              </div>

              {members.length > 1 && (
                <nav className="member-nav" aria-label="Household Member View Filter">
                  <button
                    type="button"
                    className={`member-pill ${selectedMemberId === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedMemberId('all')}
                  >
                    👥 {t.all_family}
                  </button>
                  {members.map((member) => (
                    <button
                      type="button"
                      key={member.id}
                      className={`member-pill ${selectedMemberId === member.id ? 'active' : ''}`}
                      onClick={() => setSelectedMemberId(member.id)}
                    >
                      {member.role === 'child' ? '🧒' : member.role === 'elder' ? '🧓' : member.vulnerable ? '🩺' : '👤'} {member.label}
                    </button>
                  ))}
                </nav>
              )}

              {activeMembers.map((member) => (
                <article className="member-card card" key={member.id}>
                  <div className="member-name">
                    <div className="avatar">
                      <Icon name={member.role === 'child' ? 'spark' : member.role === 'elder' ? 'shield' : 'people'} />
                    </div>
                    <div>
                      <h3>{member.label}</h3>
                      <p>{member.vulnerable ? 'Health Protected · Extra-sensitive routine' : 'Standard healthy routine'}</p>
                    </div>
                  </div>
                  <div className="period-grid">
                    {['morning', 'afternoon', 'evening'].map((period) => {
                      const item = member.periods[period];
                      const humanContributors = (item.whyFactors || []).slice(0, 3).map((factor) => factor.label);
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
                              <p>{humanContributors.join(', ')} {t.influenced}</p>
                            </details>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </article>
              ))}
            </section>

            <section className="action-grid">
              <article className="card">
                <div className="card-heading">
                  <div className="heading-icon mint"><Icon name="leaf" /></div>
                  <div>
                    <span>{t.hacks_eyebrow}</span>
                    <h2>{t.hacks_title}</h2>
                  </div>
                </div>
                <ul className="action-list">
                  {(data.plan.indoorAirHacks || []).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div className="heading-icon yellow"><Icon name="people" /></div>
                  <div>
                    <span>{t.alternatives_eyebrow}</span>
                    <h2>{t.alternatives_title}</h2>
                  </div>
                </div>
                <ul className="action-list">
                  {(data.plan.sustainableAlternatives || []).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="card qa-card">
              <div className="card-heading">
                <div className="heading-icon blue"><Icon name="chat" /></div>
                <div>
                  <span>{t.qa_eyebrow}</span>
                  <h2>{t.qa_title}</h2>
                </div>
              </div>
              <div className="qa-row">
                <textarea
                  id="air-question"
                  name="question"
                  rows="2"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  placeholder={t.qa_placeholder}
                  aria-label="Ask question about air quality"
                />
                <button
                  type="button"
                  className="ask-button"
                  onClick={() => ask()}
                  disabled={qaLoading || !question.trim()}
                  aria-label="Ask question"
                >
                  {qaLoading ? t.asking : t.ask}
                </button>
              </div>

              <div className="qa-suggestions">
                {(QA_QUICK_PICKS[profile.language] || QA_QUICK_PICKS.en).map((prompt) => (
                  <button
                    type="button"
                    className="qa-pill"
                    key={prompt}
                    onClick={() => {
                      setQuestion(prompt);
                      ask(prompt);
                    }}
                  >
                    💬 {prompt}
                  </button>
                ))}
              </div>

              {answer && (
                <p className="answer" role="region" aria-live="polite">
                  {answer}
                </p>
              )}
            </section>

            {data.overrides?.length > 0 && (
              <section className="card safety-log">
                <div className="card-heading">
                  <div className="heading-icon peach"><Icon name="shield" /></div>
                  <div>
                    <span>SAFETY SHIELD ACTIVE</span>
                    <h2>{t.safety_shield_title}</h2>
                  </div>
                </div>
                <p className="reason">{t.safety_shield_sub}</p>
                <div className="safety-notices">
                  {data.overrides.map((entry, i) => {
                    const matchedMember = members.find((m) => m.id === entry.memberId);
                    const memberName = matchedMember ? matchedMember.label : (entry.memberId || 'Family member');
                    return (
                      <div className="safety-notice-card" key={i}>
                        <div className="safety-notice-icon">🛡️</div>
                        <div className="safety-notice-content">
                          <h4>{memberName} · {entry.period.toUpperCase()} Activity Protected</h4>
                          <p>
                            High outdoor air pollution exceeded the safety threshold. High-exertion outdoor activity was automatically moved indoors to protect lung function.
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
