import { sanitizeLocation, sanitizeProfile, sanitizeQuestion } from './sanitize.js';
import { SAFETY_RULES } from './config.js';
import { applySafetyToPlan, validatePlanOutput } from './safety.js';
import { buildRecommendation } from './xai.js';

export function geminiEnabled(config) {
  return typeof config?.apiKey === 'string' && config.apiKey.trim().length > 0;
}

export async function callGemini(config, systemPrompt, userPrompt) {
  if (!geminiEnabled(config)) {
    throw new Error('Gemini disabled: missing API key');
  }
  const url = `${config.baseUrl}/${config.model}:generateContent?key=${config.apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs || 12000);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini ${response.status}: ${text}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = JSON.parse(text);
  return parsed;
}

export function sanitizePlannerInput(rawLocation, rawProfile) {
  const location = sanitizeLocation(rawLocation || '');
  const profile = sanitizeProfile(rawProfile || {});
  return { location, profile };
}

function periodPlan(member, airQuality, profile, period = 'morning') {
  const thresholds = SAFETY_RULES;
  const forecastIndex = period === 'morning' ? 6 : period === 'afternoon' ? 13 : 19;
  const forecastPoint = Array.isArray(airQuality?.forecast) ? airQuality.forecast[forecastIndex] : null;
  const aqi = forecastPoint?.aqi != null
    ? Number(forecastPoint.aqi)
    : (airQuality?.aqi === null || airQuality?.aqi === undefined ? null : Number(airQuality.aqi));
  const vulnerable = member?.vulnerable ?? false;
  const blockedOutdoor = aqi === null || aqi > thresholds.outdoorBlockAqi || (vulnerable && aqi > thresholds.vulnerableOutdoorBlockAqi);
  const hour = period === 'morning' ? 8 : period === 'afternoon' ? 14 : 19;
  const safeOutdoor = !blockedOutdoor && aqi <= 100;
  const outdoorExertion = safeOutdoor ? 'light' : 'none';
  const outdoor = safeOutdoor ? true : false;
  const durationMinutes = outdoor ? 30 : 0;

  let commuteSuggestion;
  if (member.label.startsWith('Child')) {
    commuteSuggestion = 'Travel via enclosed school transit or carpool; keep bus windows closed during highway traffic.';
  } else if (member.label.startsWith('Elder')) {
    commuteSuggestion = 'Minimize transit errands; schedule unavoidable trips during midday low-traffic hours.';
  } else if (profile.outdoorWork) {
    commuteSuggestion = 'Wear a fitted N95 mask during travel and outdoor shifts; schedule shaded indoor recovery breaks.';
  } else if (profile.commuteMode === 'car') {
    commuteSuggestion = 'Switch AC to cabin air recirculation mode; avoid prolonged idling in traffic.';
  } else if (profile.commuteMode === 'walk' || profile.commuteMode === 'cycle') {
    commuteSuggestion = aqi > 100 ? 'Air quality is poor; switch to public bus or rail instead of walking/cycling.' : 'Walking or cycling is acceptable along tree-lined streets away from main roads.';
  } else if (profile.commuteMode === 'two_wheeler') {
    commuteSuggestion = 'Wear a certified anti-particulate mask and keep helmet visor closed on congested roads.';
  } else if (profile.commuteMode === 'work_from_home') {
    commuteSuggestion = 'Zero commute exposure today; keep home workspace well-sealed and air-filtered.';
  } else {
    commuteSuggestion = 'Use public transit (bus/train); board promptly to avoid breathing platform exhaust.';
  }

  let indoorActivity;
  if (member.label.startsWith('Child')) {
    indoorActivity = blockedOutdoor
      ? (period === 'morning'
          ? 'Plan morning indoor learning and creative play; keep windows shut during morning pollution.'
          : period === 'afternoon'
            ? 'Quiet indoor rest, crafts, or reading; stay away from open windows during peak outdoor haze.'
            : 'Indoor family evening activities; keep bedroom air clean and filtered before sleeping.')
      : (period === 'morning'
          ? 'Morning indoor activities with brief ventilation only during low-AQI window.'
          : period === 'afternoon'
            ? 'Indoor playtime away from direct sunlight and outdoor dust.'
            : 'Wind down with quiet indoor games in a filtered room.');
  } else if (member.label.startsWith('Elder')) {
    indoorActivity = blockedOutdoor
      ? (period === 'morning'
          ? 'Stay in the cleanest interior room; do light indoor stretching and hydrate well.'
          : period === 'afternoon'
            ? 'Midday rest in a cool, filtered room; avoid physical exertion.'
            : 'Early dinner and relaxation in a purified sleeping area.')
      : (period === 'morning'
          ? 'Gentle morning mobility exercises indoors with light ventilation if clean.'
          : period === 'afternoon'
            ? 'Rest or quiet reading indoors away from afternoon dust.'
            : 'Gentle indoor winding down and early rest.');
  } else if (member.label.includes('respiratory')) {
    indoorActivity = blockedOutdoor
      ? (period === 'morning'
          ? 'Stay indoors in the cleanest room; avoid incense, smoke, or cold dry drafts.'
          : period === 'afternoon'
            ? 'Keep inhaler accessible; remain in an air-purified room and avoid physical strain.'
            : 'Ensure nighttime air purifier is on low noise mode in sleeping area.')
      : (period === 'morning'
          ? 'Gentle indoor movement; use a purifier if available during morning haze.'
          : period === 'afternoon'
            ? 'Indoor work or study in a well-filtered environment.'
            : 'Relaxation indoors; keep bedroom sealed against night pollution.');
  } else {
    indoorActivity = blockedOutdoor
      ? (period === 'morning'
          ? 'Indoor morning routine; avoid ventilating during peak traffic and commute hours.'
          : period === 'afternoon'
            ? 'Midday indoor work; keep windows closed and run air filtration if available.'
            : 'Seal windows before evening temperature inversion; prepare a clean indoor rest space.')
      : (period === 'morning'
          ? 'Ventilate briefly during the morning low-AQI window; run purifier afterward.'
          : period === 'afternoon'
            ? 'Standard indoor activities; keep blinds drawn to reduce cooling load.'
            : 'Normal indoor evening activities; ensure windows are secured before night.');
  }
  const reason = aqi === null
    ? 'Live air quality reading is unavailable; outdoor activity is paused as a sensible health precaution.'
    : `Tailored for current conditions (AQI ${aqi})${vulnerable ? ' with enhanced safeguards for sensitive airways.' : '.'}`;
  const xai = buildRecommendation({
    aqi,
    pm25: Number(airQuality?.pm25 ?? 0),
    hour,
    windSpeed: Number(airQuality?.windSpeed ?? 5),
    vulnerable,
    commuteFactor: profile.commuteMode === 'work_from_home' ? 0 : profile.commuteMode === 'walk' || profile.commuteMode === 'cycle' ? 0.7 : 0.5,
    cookingFactor: ['wood', 'charcoal', 'biomass', 'kerosene'].includes(profile.cookingFuel) ? 0.9 : 0.3,
    heatingFactor: ['wood', 'charcoal', 'biomass', 'kerosene'].includes(profile.heatingSource) ? 0.9 : 0.3,
    outdoorWork: profile.outdoorWork,
  });
  const impact = outdoor
    ? 'Outdoor activity can increase exposure to traffic particles; choose a low-traffic route and limit exertion.'
    : 'An indoor alternative reduces time in polluted outdoor air; avoid indoor smoke and use filtration if available.';
  return {
    activity: outdoor
      ? (period === 'morning'
          ? (member.label.startsWith('Child')
            ? 'Morning outdoor play in a clean park or courtyard away from main roads.'
            : member.label.startsWith('Elder')
              ? 'Gentle morning walk in a green space before traffic builds up.'
              : member.label.includes('respiratory')
                ? 'Short, light morning walk; stop immediately if chest tightness or coughing occurs.'
                : 'Morning jog or outdoor exercise during low-traffic hours.')
          : period === 'afternoon'
            ? (member.label.startsWith('Child')
              ? 'Short shaded outdoor games; avoid running during peak sun and dust.'
              : member.label.startsWith('Elder')
                ? 'Brief shaded stroll; sit and rest frequently.'
                : member.label.includes('respiratory')
                  ? 'Limited outdoor errands only; wear a mask if near traffic.'
                  : 'Low-intensity outdoor activity; stay hydrated in shaded areas.')
            : (member.label.startsWith('Child')
              ? 'Light playground play before sunset; return indoors before evening pollution rises.'
              : member.label.startsWith('Elder')
                ? 'Gentle evening garden walk before nightfall.'
                : member.label.includes('respiratory')
                  ? 'Brief evening outdoor step; return indoors before temperatures drop.'
                  : 'Evening stroll or cycling before evening road traffic peak.'))
      : indoorActivity,
    outdoor,
    exertion: outdoorExertion,
    durationMinutes,
    reason,
    indoorAlternative: indoorActivity,
    commute: commuteSuggestion,
    source: 'surrogate',
    xai,
    impact,
  };
}

export function buildPlan(location, profile, airQuality, config) {
  const members = Array.isArray(profile?.members) ? profile.members : [];
  const planMembers = members.map((member) => {
    const periods = {
      morning: periodPlan(member, airQuality, profile, 'morning'),
      afternoon: periodPlan(member, airQuality, profile, 'afternoon'),
      evening: periodPlan(member, airQuality, profile, 'evening'),
    };
    return {
      id: member.id,
      label: member.label,
      vulnerable: member.vulnerable,
      vulnerabilityScore: member.vulnerabilityScore,
      periods,
    };
  });

  const plan = {
    location,
    summary: `Daily plan for ${location} based on ${airQuality?.aqi == null ? 'AQI unavailable' : `AQI ${airQuality.aqi}`}.`,
    members: planMembers,
    indoorAirHacks: [
      'Close windows when outdoor AQI is high to reduce particle infiltration; ventilate during cleaner periods.',
      'Use a properly sized HEPA purifier to filter airborne particles in occupied rooms.',
      'Avoid incense, candles, and open-flame cooking to prevent adding smoke and particles indoors.',
      'Use a kitchen exhaust vent while cooking to remove pollutants at their source.',
    ],
    sustainableAlternatives: [
      'Choose a bus, train, or carpool instead of solo driving to reduce tailpipe emissions per passenger.',
      'Replace wood or charcoal cooking with electric cooking where practical to avoid on-site combustion smoke.',
      'Avoid burning biomass where possible; it releases fine particles into local air.',
      'Prefer efficient electric heating over coal or biomass where the electricity supply allows, reducing on-site combustion emissions.',
    ],
  };

  const validation = validatePlanOutput(plan);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.issues.join('; ')}`);
  }

  return { plan, validation };
}

export function makeFallbackPlan(location, profile, airQuality) {
  const hour = new Date().getHours();
  const aqi = airQuality?.aqi == null ? null : Number(airQuality.aqi);
  return {
    location,
    summary: `Safety-guided fallback plan for ${location}. ${aqi == null ? 'AQI unavailable.' : `AQI ${aqi}.`}`,
    members: (profile?.members || []).map((member) => {
      const memberPeriods = {};
      for (const period of ['morning', 'afternoon', 'evening']) {
        const memberPlan = periodPlan(member, airQuality, profile, period);
        memberPeriods[period] = {
          ...memberPlan,
          reason: memberPlan.reason,
        };
      }
      const periods = {
        ...memberPeriods,
      };
      return { id: member.id, label: member.label, vulnerable: member.vulnerable, vulnerabilityScore: member.vulnerabilityScore, periods };
    }),
    indoorAirHacks: [
      'Close windows when outdoor AQI is high to reduce particle infiltration.',
      'Run a purifier if available to filter airborne particles.',
      'Avoid incense, candles, and open-flame cooking to limit indoor smoke.',
    ],
    sustainableAlternatives: [
      'Choose shared transport to reduce tailpipe emissions per passenger.',
      'Replace wood or charcoal cooking with electric cooking where practical to avoid on-site combustion smoke.',
    ],
  };
}

export function mergeLlmWithCanonicalHousehold(llmPlan, canonicalMembers, location, profile, airQuality) {
  const llmMembers = Array.isArray(llmPlan?.members) ? llmPlan.members : [];
  const members = canonicalMembers.map((canonical, index) => {
    const llmMember = llmMembers[index];
    const periods = {};
    for (const period of ['morning', 'afternoon', 'evening']) {
      const candidate = llmMember?.periods?.[period];
      periods[period] = candidate?.activity
        ? { ...candidate, source: 'llm' }
        : periodPlan(canonical, airQuality, profile, period);
    }
    return {
      id: canonical.id,
      label: canonical.label,
      vulnerable: canonical.vulnerable,
      role: canonical.role,
      vulnerabilities: canonical.vulnerabilities,
      periods,
    };
  });
  return {
    location,
    summary: llmPlan?.summary || `Personalised daily plan for ${location}.`,
    members,
    indoorAirHacks: Array.isArray(llmPlan?.indoorAirHacks) ? llmPlan.indoorAirHacks.slice(0, 4) : [],
    sustainableAlternatives: Array.isArray(llmPlan?.sustainableAlternatives) ? llmPlan.sustainableAlternatives.slice(0, 4) : [],
  };
}

export function toPublicPlanResponse(result) {
  const plan = result?.plan || {};
  const air = result?.airQuality || {};
  return {
    plan: {
      location: plan.location,
      summary: plan.summary,
      members: (plan.members || []).map((member) => ({
        id: member.id,
        label: member.label,
        vulnerable: member.vulnerable,
        periods: Object.fromEntries(['morning', 'afternoon', 'evening'].map((period) => {
          const item = member.periods?.[period] || {};
          const top = item.xai?.topShapley || [];
          return [period, {
            activity: item.activity,
            outdoor: item.outdoor,
            exposureEffect: item.impact,
            why: item.reason,
            whyFactors: top.slice(0, 3).map((entry) => ({
              label: {
                pm25: 'Live particle levels',
                hour: 'Time of day',
                wind: 'Local wind',
                vulnerability: 'Household vulnerability',
                commuteFactor: 'Commute type',
                cookingFactor: 'Cooking source',
                heatingFactor: 'Heating source',
                outdoorWork: 'Outdoor work',
              }[entry.feature] || 'Current conditions',
            })),
          }];
        })),
      })),
      indoorAirHacks: (plan.indoorAirHacks || []).slice(0, 4),
      sustainableAlternatives: (plan.sustainableAlternatives || []).slice(0, 4),
    },
    source: result.source === 'llm' ? 'llm' : 'fallback',
    fallback: result.source !== 'llm' || result.geminiDisabled,
    airQuality: {
      status: air.aqi == null ? 'unavailable' : 'available',
      aqi: air.aqi ?? null,
      pm25: air.pm25 ?? null,
      pm10: air.pm10 ?? null,
      source: air.dataSource || air.source || 'fallback',
      timestamp: air.timestamp || null,
      timezone: air.timezone || null,
      locationSource: air.locationSource || air.location?.source || null,
      forecast: (air.forecast || []).slice(0, 24),
      location: air.location || null,
    },
    note: air.note || null,
    overrides: (result.overrides || []).map((entry) => ({
      timestamp: entry.timestamp,
      memberId: entry.memberId,
      period: entry.period,
      action: entry.action,
    })),
  };
}

export async function generatePlan(location, profile, airQuality, config) {
  let plan;
  let source = 'fallback';
  let llmPlan = null;
  try {
    if (!geminiEnabled(config)) {
      throw new Error('Gemini disabled');
    }
    const prompt = `Create a valid daily-plan JSON object for ${location}. Profile: ${JSON.stringify(profile)}. Live conditions: ${JSON.stringify(airQuality)}. Include summary, members, indoorAirHacks, and sustainableAlternatives. For every member include morning, afternoon, and evening objects with activity, outdoor(boolean), exertion(none/light/moderate/high), durationMinutes, reason, indoorAlternative, source="llm". Give each routine a clear reason tied to the live air data or household profile. Make every indoorAirHacks and sustainableAlternatives string an actionable recommendation with a brief explanation of its expected air-quality, exposure, or emissions impact. Do not invent quantified benefits. Never recommend outdoor activity with AQI above 150 or for vulnerable members above 100.`;
    plan = await callGemini(config, 'Return JSON only.', prompt);
    const validation = validatePlanOutput(plan);
    if (!validation.valid) throw new Error(validation.issues.join('; '));
    llmPlan = plan;
    source = 'llm';
  } catch (error) {
    plan = null;
  }

  if (!plan) {
    plan = makeFallbackPlan(location, profile, airQuality);
  } else if (llmPlan) {
    plan = mergeLlmWithCanonicalHousehold(llmPlan, profile.members, location, profile, airQuality);
  }

  const safetyContext = { aqi: airQuality?.aqi ?? null };
  const safetyResult = applySafetyToPlan(plan, safetyContext);

  const result = {
    plan: safetyResult.plan,
    source,
    airQuality,
    geminiDisabled: !geminiEnabled(config),
    overrides: safetyResult.overrides,
    safetyThresholds: SAFETY_RULES,
  };
  return toPublicPlanResponse(result);
}

export function answerQuestion(question, airQuality, profile) {
  const q = sanitizeQuestion(question || '');
  const lower = q.toLowerCase();
  const location = airQuality?.location?.city ?? 'your location';
  const aqi = airQuality?.aqi ?? null;
  let answer;
  if (/diagnos|dosing|dose|medicine|medication|prescri/.test(lower)) {
    answer = `I cannot diagnose or give medicine dosing. For symptoms in ${location}, contact a local clinician or emergency service. Live AQI is ${aqi == null ? 'unavailable' : aqi}; stay indoors if AQI exceeds 150.`;
  } else if (/outdoor|exercise|walk|jog|run/.test(lower)) {
    const blocked = aqi == null || aqi > 150 || (profile?.vulnerableCount > 0 && aqi > 100);
    answer = blocked
      ? `At AQI ${aqi == null ? 'unavailable' : aqi} in ${location}, avoid outdoor exertion. For vulnerable household members, move the activity indoors.`
      : `At AQI ${aqi} in ${location}, keep outdoor activity light, avoid high-traffic roads, and stop if symptoms occur.`;
  } else {
    answer = `At AQI ${aqi == null ? 'unavailable' : aqi} in ${location}, keep windows closed above 100, use a fitted filter or purifier if available, and avoid incense or open-flame cooking.`;
  }
  return { answer, source: 'surrogate', airQuality };
}
