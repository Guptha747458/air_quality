import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// --- Module imports ---
import {
  SAFETY_RULES, getSafetyThresholds, GEMINI, OPEN_METEO,
  MEMBER_ROLES, LANGUAGE_CODES,
} from '../server/services/config.js';
import {
  sanitizeText, sanitizeLocation, sanitizeBoolean, sanitizeNumber,
  sanitizeProfile, sanitizeQuestion, sanitizePlanResponse,
  buildMembers, ValidationError,
} from '../server/services/sanitize.js';
import {
  EXERTIONS, assessSafety, createSafetyLogEntry,
  applySafetyToPlan, validatePlanOutput,
} from '../server/services/safety.js';
import {
  computeShapley, buildSurrogateFeatures, buildSurrogateWeights,
  surrogatePredict, buildRecommendation,
} from '../server/services/xai.js';
import {
  FALLBACK_CITIES, geocodeLocation, fetchAirQuality, fetchAirQualityByCity,
} from '../server/services/geocoding.js';
import {
  geminiEnabled, sanitizePlannerInput, buildPlan,
  makeFallbackPlan, mergeLlmWithCanonicalHousehold,
  toPublicPlanResponse, answerQuestion,
} from '../server/services/planner.js';
import { routeHandler, CSP, respondJson } from '../server/index.js';

// ========== Helpers ==========

const epsilon = 1e-9;

function mockFetchOk(data) {
  return async () => ({ ok: true, json: async () => data, text: async () => JSON.stringify(data) });
}
function mockFetchFail(status = 500) {
  return async () => ({ ok: false, status, json: async () => ({}), text: async () => 'error' });
}

function makeProfile(overrides = {}) {
  return sanitizeProfile({
    householdSize: 3, children: 1, elderly: 1,
    respiratoryConditions: 0, asthma: false, outdoorWork: false,
    commuteMode: 'bus', cookingFuel: 'lpg', heatingSource: 'electric',
    language: 'en', ...overrides,
  });
}

function createMockReq(method, url) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.destroy = () => {};
  process.nextTick(() => req.emit('end'));
  return req;
}

function createMockRes() {
  const res = {
    statusCode: null, headers: {}, body: '', _ended: false,
    writeHead(status, hdrs) { res.statusCode = status; Object.assign(res.headers, hdrs || {}); },
    setHeader(k, v) { res.headers[k] = v; },
    end(data) { res.body = data ? (typeof data === 'string' ? data : data.toString()) : ''; res._ended = true; },
  };
  return res;
}

// ================================================================
//  1. XAI MODULE (10 tests)
// ================================================================

test('computeShapley with valid linear features', () => {
  const features = { a: 2, b: 3 };
  const weights = { a: 0.5, b: 0.4 };
  const result = computeShapley(features, weights, 0);
  assert.ok(result.sumValidated);
  assert.ok(Math.abs(result.sum - result.prediction) < epsilon);
  assert.strictEqual(result.attributions.length, 2);
});

test('computeShapley throws on null features', () => {
  assert.throws(() => computeShapley(null, { a: 1 }), /features must be an object/);
});

test('computeShapley throws on null weights', () => {
  assert.throws(() => computeShapley({ a: 1 }, null), /weights must be an object/);
});

test('computeShapley throws on baseline mismatch', () => {
  const features = { x: 10 };
  const weights = { x: 0.5 };
  assert.throws(() => computeShapley(features, weights, 2), /Shapley sum mismatch/);
});

test('buildSurrogateFeatures returns defaults for empty context', () => {
  const f = buildSurrogateFeatures({});
  assert.strictEqual(f.pm25, 0);
  assert.strictEqual(f.hour, 12);
  assert.strictEqual(f.wind, 5);
  assert.strictEqual(f.vulnerability, 0);
  assert.strictEqual(f.commuteFactor, 0.5);
  assert.strictEqual(f.outdoorWork, 0);
});

test('buildSurrogateFeatures with vulnerable context', () => {
  const f = buildSurrogateFeatures({ vulnerable: true, pm25: 50, hour: 8 });
  assert.strictEqual(f.vulnerability, 1);
  assert.strictEqual(f.pm25, 50);
  assert.strictEqual(f.hour, 8);
});

test('buildSurrogateFeatures with outdoor work', () => {
  const f = buildSurrogateFeatures({ outdoorWork: true });
  assert.strictEqual(f.outdoorWork, 1);
});

test('buildSurrogateWeights returns expected keys', () => {
  const w = buildSurrogateWeights();
  const expected = ['pm25', 'hour', 'wind', 'vulnerability', 'commuteFactor', 'cookingFactor', 'heatingFactor', 'outdoorWork'];
  assert.deepStrictEqual(Object.keys(w).sort(), expected.sort());
});

test('surrogatePredict validates sum property', () => {
  const features = buildSurrogateFeatures({ pm25: 30, hour: 14, windSpeed: 3, vulnerable: true });
  const result = surrogatePredict(features);
  assert.ok(result.sumValidated);
  assert.ok(Math.abs(result.sum - result.prediction) < epsilon);
});

test('buildRecommendation returns top 3 dominant contributors', () => {
  const rec = buildRecommendation({ pm25: 60, hour: 14, windSpeed: 2, vulnerable: true });
  assert.strictEqual(rec.dominantContributors.length, 3);
  assert.strictEqual(rec.topShapley.length, 3);
  assert.ok(typeof rec.prediction === 'number');
  assert.ok(Math.abs(rec.sum - rec.prediction) < epsilon);
});

// ================================================================
//  2. GEOCODING WITH MOCKS (8 tests)
// ================================================================

test('geocodeLocation success with mock fetch', async () => {
  const mockFetch = mockFetchOk({ results: [{ name: 'Delhi', latitude: 28.6, longitude: 77.2, country_code: 'IN' }] });
  const result = await geocodeLocation('Delhi', { fetchImpl: mockFetch });
  assert.strictEqual(result.city, 'Delhi');
  assert.strictEqual(result.source, 'open-meteo');
  assert.ok(typeof result.latitude === 'number');
});

test('geocodeLocation falls back on fetch failure', async () => {
  const mockFetch = async () => { throw new Error('Network error'); };
  const result = await geocodeLocation('Mumbai', { fetchImpl: mockFetch });
  assert.strictEqual(result.source, 'fallback');
  assert.strictEqual(result.name, 'Mumbai');
});

test('geocodeLocation falls back to Delhi for unknown city', async () => {
  const mockFetch = async () => { throw new Error('timeout'); };
  const result = await geocodeLocation('Xyzville', { fetchImpl: mockFetch });
  assert.strictEqual(result.source, 'fallback');
  assert.strictEqual(result.name, 'Delhi');
});

test('geocodeLocation handles empty results', async () => {
  const mockFetch = mockFetchOk({ results: [] });
  const result = await geocodeLocation('Nowhere', { fetchImpl: mockFetch });
  assert.strictEqual(result.source, 'fallback');
});

test('fetchAirQuality success with mock data', async () => {
  const mockData = {
    current: { pm2_5: 35, pm10: 50, us_aqi: 85, wind_speed_10m: 4 },
    hourly: { time: ['2026-01-01T00:00', '2026-01-01T01:00'], pm2_5: [30, 40], pm10: [45, 55], us_aqi: [80, 90], wind_speed_10m: [3, 5] },
  };
  const result = await fetchAirQuality({ latitude: 28.6, longitude: 77.2 }, { fetchImpl: mockFetchOk(mockData) });
  assert.strictEqual(result.aqi, 85);
  assert.strictEqual(result.pm25, 35);
  assert.strictEqual(result.source, 'open-meteo');
  assert.ok(result.forecast.length > 0);
});

test('fetchAirQuality returns fallback on failure', async () => {
  const result = await fetchAirQuality({ latitude: 28.6, longitude: 77.2 }, { fetchImpl: mockFetchFail(500) });
  assert.strictEqual(result.source, 'fallback');
  assert.strictEqual(result.aqi, null);
});

test('fetchAirQuality throws on missing location', async () => {
  await assert.rejects(() => fetchAirQuality(null), /Missing location/);
});

test('fetchAirQualityByCity end-to-end with mocks', async () => {
  const geoData = { results: [{ name: 'Pune', latitude: 18.5, longitude: 73.8, country_code: 'IN' }] };
  const aqData = {
    timezone: 'Asia/Kolkata',
    current: { pm2_5: 20, pm10: 30, us_aqi: 50, wind_speed_10m: 6 },
    hourly: { time: ['2026-01-01T00:00'], pm2_5: [20], pm10: [30], us_aqi: [50], wind_speed_10m: [6] },
  };
  let callCount = 0;
  const mockFetch = async (url) => {
    callCount++;
    const data = url.includes('geocoding') ? geoData : aqData;
    return { ok: true, json: async () => data };
  };
  const result = await fetchAirQualityByCity('Pune', { fetchImpl: mockFetch });
  assert.strictEqual(result.aqi, 50);
  assert.strictEqual(result.location.city, 'Pune');
  assert.strictEqual(result.timezone, 'Asia/Kolkata');
  assert.strictEqual(result.dataSource, 'open-meteo');
  assert.strictEqual(result.locationSource, 'open-meteo');
  assert.strictEqual(callCount, 2);
});

// ================================================================
//  3. SAFETY MODULE (10 tests)
// ================================================================

test('assessSafety blocks when AQI is null', () => {
  const result = assessSafety({ outdoor: true, exertion: 'light' }, { aqi: null });
  assert.strictEqual(result.shouldBlock, true);
  assert.ok(result.reason.includes('unavailable'));
});

test('assessSafety allows at low AQI for non-vulnerable', () => {
  const result = assessSafety({ outdoor: true, exertion: 'light' }, { aqi: 40, vulnerable: false });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.shouldBlock, false);
});

test('assessSafety blocks at AQI 160 for all members', () => {
  const result = assessSafety({ outdoor: true, exertion: 'light' }, { aqi: 160, vulnerable: false });
  assert.strictEqual(result.shouldBlock, true);
});

test('assessSafety blocks vulnerable member at AQI 105', () => {
  const result = assessSafety({ outdoor: true, exertion: 'light' }, { aqi: 105, vulnerable: true });
  assert.strictEqual(result.shouldBlock, true);
});

test('assessSafety blocks moderate exertion at AQI 105', () => {
  const result = assessSafety({ exertion: 'moderate' }, { aqi: 105, vulnerable: false });
  assert.strictEqual(result.shouldBlock, true);
});

test('assessSafety blocks high exertion at any AQI', () => {
  const result = assessSafety({ exertion: 'high' }, { aqi: 50, vulnerable: false });
  assert.strictEqual(result.shouldBlock, true);
});

test('createSafetyLogEntry has correct structure', () => {
  const entry = createSafetyLogEntry({
    source: 'llm', memberId: 'adult_1', period: 'morning',
    action: 'replaced', originalExcerpt: 'Jog outdoors', context: { aqi: 160 },
  });
  assert.ok(entry.timestamp);
  assert.strictEqual(entry.memberId, 'adult_1');
  assert.strictEqual(entry.period, 'morning');
  assert.strictEqual(entry.action, 'replaced');
  assert.strictEqual(entry.context.aqi, 160);
  assert.strictEqual(entry.context.outdoorBlockAqi, 150);
});

test('applySafetyToPlan with mixed vulnerability members', () => {
  const plan = {
    summary: 'Test', members: [
      { id: 'child_1', vulnerable: true, periods: { morning: { activity: 'Play', outdoor: true, exertion: 'light', durationMinutes: 30, reason: 'ok' }, afternoon: { activity: 'Read', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'ok' }, evening: { activity: 'Sleep', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'ok' } } },
      { id: 'adult_1', vulnerable: false, periods: { morning: { activity: 'Walk', outdoor: true, exertion: 'light', durationMinutes: 30, reason: 'ok' }, afternoon: { activity: 'Work', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'ok' }, evening: { activity: 'Walk', outdoor: true, exertion: 'light', durationMinutes: 20, reason: 'ok' } } },
    ],
  };
  const result = applySafetyToPlan(plan, { aqi: 105 });
  // Child is vulnerable and AQI > 100 → morning blocked
  assert.strictEqual(result.plan.members[0].periods.morning.outdoor, false);
  // Adult is NOT vulnerable and AQI < 150 → morning allowed (but exertion 'light' at >100 is blocked)
  assert.strictEqual(result.plan.members[1].periods.morning.outdoor, false);
  assert.ok(result.overrides.length > 0);
});

test('applySafetyToPlan with empty plan', () => {
  const result = applySafetyToPlan({ summary: 'Empty', members: [] }, { aqi: 200 });
  assert.strictEqual(result.overrides.length, 0);
  assert.strictEqual(result.plan.members.length, 0);
});

test('validatePlanOutput rejects null plan', () => {
  const result = validatePlanOutput(null);
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.some(i => i.includes('object')));
});

test('validatePlanOutput rejects plan with missing summary', () => {
  const result = validatePlanOutput({ members: [] });
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.some(i => i.includes('summary')));
});

test('validatePlanOutput rejects member with invalid exertion', () => {
  const result = validatePlanOutput({
    summary: 'Test plan summary here',
    members: [{ id: 'a', periods: { morning: { activity: 'x', outdoor: true, exertion: 'extreme', durationMinutes: 10, reason: 'r' }, afternoon: { activity: 'x', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'r' }, evening: { activity: 'x', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'r' } } }],
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.some(i => i.includes('exertion')));
});

test('validatePlanOutput rejects member with invalid durationMinutes', () => {
  const result = validatePlanOutput({
    summary: 'Test plan summary here',
    members: [{ id: 'a', periods: { morning: { activity: 'x', outdoor: false, exertion: 'none', durationMinutes: 999, reason: 'r' }, afternoon: { activity: 'x', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'r' }, evening: { activity: 'x', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'r' } } }],
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.some(i => i.includes('durationMinutes')));
});

// ================================================================
//  4. PLANNER (12 tests)
// ================================================================

test('geminiEnabled returns false with empty key', () => {
  assert.strictEqual(geminiEnabled({ apiKey: '' }), false);
});

test('geminiEnabled returns false with undefined config', () => {
  assert.strictEqual(geminiEnabled(undefined), false);
  assert.strictEqual(geminiEnabled(null), false);
});

test('geminiEnabled returns true with valid key', () => {
  assert.strictEqual(geminiEnabled({ apiKey: 'test-key-123' }), true);
});

test('geminiEnabled returns false with whitespace-only key', () => {
  assert.strictEqual(geminiEnabled({ apiKey: '   ' }), false);
});

test('sanitizePlannerInput sanitizes both location and profile', () => {
  const result = sanitizePlannerInput('  Bengaluru  ', { householdSize: 3 });
  assert.strictEqual(result.location, 'Bengaluru');
  assert.strictEqual(result.profile.householdSize, 3);
  assert.ok(Array.isArray(result.profile.members));
});

test('buildPlan creates valid plan with members', () => {
  const profile = makeProfile();
  const airQuality = { aqi: 80, pm25: 30, forecast: [] };
  const result = buildPlan('Bengaluru', profile, airQuality, { apiKey: '' });
  assert.ok(result.plan.summary.includes('Bengaluru'));
  assert.strictEqual(result.plan.members.length, profile.members.length);
  assert.ok(result.validation.valid);
  assert.match(result.plan.sustainableAlternatives[0], /tailpipe emissions/i);
  assert.match(result.plan.indoorAirHacks[0], /particle infiltration/i);
});

test('makeFallbackPlan creates plan for all member types', () => {
  const profile = makeProfile({ children: 1, elderly: 1, respiratoryConditions: 1, householdSize: 4, asthma: false });
  const plan = makeFallbackPlan('Delhi', profile, { aqi: 120, pm25: 50, forecast: [] });
  assert.ok(plan.summary.includes('Delhi'));
  assert.strictEqual(plan.members.length, profile.members.length);
  assert.ok(plan.members.every(m => m.periods.morning && m.periods.afternoon && m.periods.evening));
  assert.match(plan.sustainableAlternatives[0], /emissions per passenger/i);
  assert.match(plan.indoorAirHacks[0], /particle infiltration/i);
});

test('makeFallbackPlan handles null AQI', () => {
  const profile = makeProfile();
  const plan = makeFallbackPlan('Mumbai', profile, { aqi: null, pm25: null, forecast: [] });
  assert.ok(plan.summary.includes('unavailable'));
  assert.ok(plan.members.every(m => m.periods.morning.outdoor === false));
});

test('mergeLlmWithCanonicalHousehold merges LLM plan', () => {
  const profile = makeProfile({ householdSize: 2, children: 0, elderly: 0 });
  const llmPlan = {
    summary: 'AI plan for Delhi',
    members: [{ periods: { morning: { activity: 'Yoga indoors', outdoor: false, exertion: 'light', durationMinutes: 20, reason: 'Good' }, afternoon: { activity: 'Read', outdoor: false, exertion: 'none', durationMinutes: 0, reason: 'AQI high' }, evening: { activity: 'Walk', outdoor: true, exertion: 'light', durationMinutes: 15, reason: 'Evening air better' } } }],
    indoorAirHacks: ['Close windows'],
    sustainableAlternatives: ['Use bus'],
  };
  const result = mergeLlmWithCanonicalHousehold(llmPlan, profile.members, 'Delhi', profile, { aqi: 60 });
  assert.strictEqual(result.members[0].periods.morning.activity, 'Yoga indoors');
  assert.ok(result.indoorAirHacks.length > 0);
});

test('mergeLlmWithCanonicalHousehold falls back when LLM member missing period', () => {
  const profile = makeProfile({ householdSize: 2, children: 0, elderly: 0 });
  const llmPlan = {
    summary: 'Partial plan',
    members: [{ periods: { morning: { activity: 'Walk' }, afternoon: null, evening: null } }],
  };
  const result = mergeLlmWithCanonicalHousehold(llmPlan, profile.members, 'Delhi', profile, { aqi: 60 });
  // afternoon and evening should have surrogate-generated activity
  assert.ok(result.members[0].periods.afternoon.activity);
  assert.ok(result.members[0].periods.evening.activity);
});

test('toPublicPlanResponse strips internal fields', () => {
  const profile = makeProfile();
  const fallback = makeFallbackPlan('Bengaluru', profile, { aqi: 160, pm25: 70, forecast: [] });
  const publicResult = toPublicPlanResponse({
    plan: fallback, source: 'fallback',
    airQuality: {
      aqi: 160, pm25: 70, pm10: 90, source: 'open-meteo',
      timestamp: '2026-01-01T10:00', timezone: 'Asia/Kolkata',
      locationSource: 'open-meteo', forecast: [],
    },
    geminiDisabled: true, overrides: [],
  });
  const serialized = JSON.stringify(publicResult);
  assert.doesNotMatch(serialized, /vulnerabilityScore/);
  assert.strictEqual(publicResult.plan.members.length, profile.members.length);
  assert.ok(typeof publicResult.airQuality.aqi === 'number');
  assert.equal(publicResult.airQuality.source, 'open-meteo');
  assert.equal(publicResult.airQuality.timestamp, '2026-01-01T10:00');
  assert.equal(publicResult.airQuality.timezone, 'Asia/Kolkata');
});

test('answerQuestion handles medical questions safely', () => {
  const result = answerQuestion('What medicine should I take?', { aqi: 100, location: { city: 'Delhi' } }, {});
  assert.ok(result.answer.includes('cannot'));
  assert.ok(result.answer.includes('clinician') || result.answer.includes('emergency'));
});

test('answerQuestion handles outdoor activity questions', () => {
  const result = answerQuestion('Can I walk outdoors today?', { aqi: 160, location: { city: 'Delhi' } }, { vulnerableCount: 0 });
  assert.ok(result.answer.includes('avoid') || result.answer.includes('indoor'));
});

test('answerQuestion handles generic questions', () => {
  const result = answerQuestion('What about cooking?', { aqi: 80, location: { city: 'Mumbai' } }, {});
  assert.ok(result.answer.includes('AQI'));
});

// ================================================================
//  5. SANITIZE EDGE CASES (11 tests)
// ================================================================

test('sanitizeText strips HTML tags', () => {
  const result = sanitizeText('<p>Clean content</p>');
  assert.strictEqual(result, 'Clean content');
  assert.ok(!result.includes('<'));
  assert.ok(!result.includes('>'));
});

test('sanitizeText strips control characters', () => {
  const result = sanitizeText('Hello\x00World\x07');
  assert.strictEqual(result, 'HelloWorld');
});

test('sanitizeLocation rejects empty string', () => {
  assert.throws(() => sanitizeLocation(''), ValidationError);
});

test('sanitizeLocation rejects single character', () => {
  assert.throws(() => sanitizeLocation('X'), ValidationError);
});

test('sanitizeLocation rejects special characters', () => {
  assert.throws(() => sanitizeLocation('city; DROP TABLE users'), ValidationError);
});

test('sanitizeProfile with all zeros defaults', () => {
  const profile = sanitizeProfile({ householdSize: 0, children: 0, elderly: 0 });
  assert.strictEqual(profile.householdSize, 1);  // min is 1
  assert.strictEqual(profile.members.length, 1);
});

test('sanitizeProfile with unknown commute mode defaults to car', () => {
  const profile = sanitizeProfile({ householdSize: 2, commuteMode: 'helicopter' });
  assert.strictEqual(profile.commuteMode, 'car');
});

test('sanitizeProfile with unknown cooking fuel defaults to lpg', () => {
  const profile = sanitizeProfile({ householdSize: 2, cookingFuel: 'solar' });
  assert.strictEqual(profile.cookingFuel, 'lpg');
});

test('sanitizeProfile with unknown heating source defaults to none', () => {
  const profile = sanitizeProfile({ householdSize: 2, heatingSource: 'nuclear' });
  assert.strictEqual(profile.heatingSource, 'none');
});

test('buildMembers with asthma and existing respiratory conditions', () => {
  const profile = {
    householdSize: 3, children: 0, elderly: 0, respiratoryConditions: 1,
    asthma: true, outdoorWork: false, commuteMode: 'bus', cookingFuel: 'lpg',
    heatingSource: 'electric', language: 'en',
  };
  const members = buildMembers(profile);
  const respiratory = members.find(m => m.vulnerabilities.includes('respiratory-condition'));
  assert.ok(respiratory);
  assert.ok(respiratory.vulnerabilities.includes('asthma'));
});

test('sanitizePlanResponse with null returns null', () => {
  assert.strictEqual(sanitizePlanResponse(null), null);
  assert.strictEqual(sanitizePlanResponse(undefined), null);
});

test('sanitizeQuestion strips HTML and limits length', () => {
  const result = sanitizeQuestion('<b>Is it safe</b> to walk?');
  assert.ok(!result.includes('<'));
  assert.ok(result.includes('Is it safe'));
});

// ================================================================
//  6. SERVER ROUTE TESTS (8 tests)
// ================================================================

test('health endpoint returns 200 with status ok', async () => {
  const req = createMockReq('GET', '/health');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.status, 'ok');
});

test('unknown route returns 404', async () => {
  const req = createMockReq('GET', '/nonexistent');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.error, 'Not found');
});

test('CSP header is set on responses', async () => {
  const req = createMockReq('GET', '/health');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(res.headers['Content-Security-Policy'], CSP);
});

test('X-Content-Type-Options header is set', async () => {
  const req = createMockReq('GET', '/health');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(res.headers['X-Content-Type-Options'], 'nosniff');
});

test('X-Frame-Options header is DENY', async () => {
  const req = createMockReq('GET', '/health');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(res.headers['X-Frame-Options'], 'DENY');
});

test('Strict-Transport-Security header is set', async () => {
  const req = createMockReq('GET', '/health');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.ok(res.headers['Strict-Transport-Security'].includes('max-age'));
});

test('Permissions-Policy header is set', async () => {
  const req = createMockReq('GET', '/health');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.ok(res.headers['Permissions-Policy'].includes('camera=()'));
});

test('DELETE method returns 405', async () => {
  const req = createMockReq('DELETE', '/health');
  const res = createMockRes();
  routeHandler(req, res);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(res.statusCode, 405);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.error, 'Method not allowed');
});

// ================================================================
//  7. CONFIG MODULE (4 tests)
// ================================================================

test('MEMBER_ROLES has expected keys', () => {
  assert.ok(MEMBER_ROLES.adult);
  assert.ok(MEMBER_ROLES.child);
  assert.ok(MEMBER_ROLES.elderly);
  assert.ok(MEMBER_ROLES.respiratory);
});

test('LANGUAGE_CODES has en and hi', () => {
  assert.strictEqual(LANGUAGE_CODES.en, 'en');
  assert.strictEqual(LANGUAGE_CODES.hi, 'hi');
});

test('EXERTIONS contains expected values', () => {
  assert.ok(EXERTIONS.includes('none'));
  assert.ok(EXERTIONS.includes('light'));
  assert.ok(EXERTIONS.includes('moderate'));
  assert.ok(EXERTIONS.includes('high'));
  assert.strictEqual(EXERTIONS.length, 4);
});

test('FALLBACK_CITIES contains at least 5 cities', () => {
  assert.ok(FALLBACK_CITIES.length >= 5);
  assert.ok(FALLBACK_CITIES.every(c => c.name && typeof c.lat === 'number' && typeof c.lon === 'number'));
});

// ================================================================
//  8. INTEGRATION-STYLE (3 tests)
// ================================================================

test('full pipeline: profile → fallback plan → safety → public response', () => {
  const profile = makeProfile({ householdSize: 4, children: 1, elderly: 1, respiratoryConditions: 1 });
  const airQuality = { aqi: 120, pm25: 55, forecast: [] };
  const plan = makeFallbackPlan('Delhi', profile, airQuality);
  const safetyResult = applySafetyToPlan(plan, { aqi: 120 });
  const publicResult = toPublicPlanResponse({
    plan: safetyResult.plan, source: 'fallback',
    airQuality, geminiDisabled: true, overrides: safetyResult.overrides,
  });
  assert.strictEqual(publicResult.plan.members.length, 4);
  assert.ok(publicResult.fallback);
  assert.strictEqual(publicResult.airQuality.aqi, 120);
  // All vulnerable members should have outdoor blocked at AQI 120
  const vulnerableMembers = publicResult.plan.members.filter((_, i) => profile.members[i].vulnerable);
  for (const vm of vulnerableMembers) {
    for (const period of ['morning', 'afternoon', 'evening']) {
      assert.strictEqual(vm.periods[period].outdoor, false);
    }
  }
});

test('respondJson helper produces valid JSON', () => {
  const res = createMockRes();
  respondJson(res, 201, { created: true });
  assert.strictEqual(res.statusCode, 201);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.created, true);
  assert.strictEqual(res.headers['Content-Type'], 'application/json');
});

test('sanitizeBoolean handles edge cases', () => {
  assert.strictEqual(sanitizeBoolean('y'), true);
  assert.strictEqual(sanitizeBoolean('n'), false);
  assert.strictEqual(sanitizeBoolean('home'), true);
  assert.strictEqual(sanitizeBoolean('outdoor'), false);
  assert.strictEqual(sanitizeBoolean(1), true);
  assert.strictEqual(sanitizeBoolean(0), false);
  assert.strictEqual(sanitizeBoolean(null), false);
  assert.strictEqual(sanitizeBoolean(''), false);
  assert.throws(() => sanitizeBoolean('maybe'), ValidationError);
});
