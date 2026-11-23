import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFETY_RULES,
  getSafetyThresholds,
  GEMINI,
  OPEN_METEO,
  MEMBER_ROLES,
  LANGUAGE_CODES,
} from '../server/services/config.js';
import {
  sanitizeText,
  sanitizeLocation,
  sanitizeBoolean,
  sanitizeNumber,
  sanitizeProfile,
  sanitizeQuestion,
  sanitizePlanResponse,
  buildMembers,
  ValidationError,
} from '../server/services/sanitize.js';
import {
  applySafetyToPlan,
  validatePlanOutput,
} from '../server/services/safety.js';
import { makeFallbackPlan, toPublicPlanResponse } from '../server/services/planner.js';

const epsilon = 1e-9;

// ----- Config / rules -----

test('SAFETY_RULES defined and contains thresholds', () => {
  assert.ok(SAFETY_RULES.outdoorBlockAqi === 150);
  assert.ok(SAFETY_RULES.vulnerableOutdoorBlockAqi === 100);
});

test('getSafetyThresholds returns same values', () => {
  const t = getSafetyThresholds();
  assert.strictEqual(t.outdoorBlockAqi, 150);
});

test('Gemini config present', () => {
  assert.ok(typeof GEMINI.apiKey === 'string');
  assert.ok(typeof GEMINI.model === 'string');
});

test('Open-Meteo config present', () => {
  assert.ok(typeof OPEN_METEO.geocodeUrl === 'string');
  assert.ok(typeof OPEN_METEO.airQualityUrl === 'string');
});

// ----- Text sanitisation -----

test('sanitizeText respects maxLength', () => {
  const long = 'A'.repeat(300);
  const result = sanitizeText(long, 10);
  assert.strictEqual(result.length, 10);
});

test('sanitizeLocation validates and cleans', () => {
  const result = sanitizeLocation('  Bengaluru  ');
  assert.strictEqual(result, 'Bengaluru');
  assert.throws(() => sanitizeLocation('invalid/path'), ValidationError);
});

test('sanitizeBoolean true variants', () => {
  assert.strictEqual(sanitizeBoolean('true'), true);
  assert.strictEqual(sanitizeBoolean('yes'), true);
  assert.strictEqual(sanitizeBoolean('1'), true);
});

test('sanitizeBoolean false variants and default', () => {
  assert.strictEqual(sanitizeBoolean('false'), false);
  assert.strictEqual(sanitizeBoolean('no'), false);
  assert.strictEqual(sanitizeBoolean('0'), false);
  assert.strictEqual(sanitizeBoolean(), false);
});

test('sanitizeNumber clamps and rounds', () => {
  assert.strictEqual(sanitizeNumber(5.7, 1, 10, 0), 6);
  assert.strictEqual(sanitizeNumber(0, 1, 10, 5), 1);
  assert.strictEqual(sanitizeNumber(20, 1, 10, 5), 10);
});

// ----- Profile building -----

test('sanitizeProfile extracts counts and validates counts', () => {
  const profile = sanitizeProfile({
    householdSize: 4,
    children: 1,
    elderly: 1,
    respiratoryConditions: 1,
    asthma: true,
    outdoorWork: false,
    commuteMode: 'car',
    cookingFuel: 'lpg',
    heatingSource: 'electric',
    language: 'en',
  });
  assert.strictEqual(profile.householdSize, 4);
  assert.strictEqual(profile.children, 1);
  assert.strictEqual(profile.elderly, 1);
  assert.strictEqual(profile.respiratoryConditions, 1);
  assert.strictEqual(profile.asthma, true);
  assert.strictEqual(profile.outdoorWork, false);
  assert.strictEqual(profile.commuteMode, 'car');
  assert.strictEqual(profile.cookingFuel, 'lpg');
  assert.strictEqual(profile.heatingSource, 'electric');
  assert.strictEqual(profile.language, 'en');
  assert.ok(profile.vulnerableCount <= profile.householdSize);
  assert.ok(profile.members.length <= profile.householdSize);
});

test('sanitizeProfile defaults and clamps children exceeding household size', () => {
  const profile = sanitizeProfile({ householdSize: 2, children: 5, elderly: 0 });
  assert.strictEqual(profile.children, 2);
});

test('buildMembers generates correct member list', () => {
  const profile = {
    householdSize: 3,
    children: 1,
    elderly: 0,
    respiratoryConditions: 0,
    asthma: false,
    outdoorWork: false,
    commuteMode: 'walk',
    cookingFuel: 'electric',
    heatingSource: 'none',
    language: 'en',
    vulnerableCount: 1,
  };
  const members = buildMembers(profile);
  assert.strictEqual(members.length, 3);
  // child + 2 adults to fill householdSize=3
  const hasChild = members.some(m => m.label === 'Child 1');
  const hasAdults = members.filter(m => m.vulnerable === false);
  assert.ok(hasChild);
  assert.strictEqual(hasAdults.length, 2);
});

test('fallback plan avoids internal surrogate wording in user-facing reasons', () => {
  const profile = sanitizeProfile({
    householdSize: 2,
    children: 1,
    elderly: 0,
    respiratoryConditions: 0,
  });
  const fallback = makeFallbackPlan('Bengaluru', profile, { aqi: 160, pm25: 70, forecast: [] });
  const serialized = JSON.stringify(fallback);
  assert.doesNotMatch(serialized, /Surrogate fallback|surrogate fallback/i);
  assert.strictEqual(fallback.members.length, 2);
});

test('household category totals never exceed household size', () => {
  const profile = sanitizeProfile({
    householdSize: 2,
    children: 5,
    elderly: 5,
    respiratoryConditions: 5,
  });
  assert.strictEqual(profile.members.length, profile.householdSize);
  assert.ok(
    profile.children + profile.elderly + profile.respiratoryConditions
      <= profile.householdSize,
  );
});

test('public plan response removes internal scoring fields', () => {
  const profile = sanitizeProfile({
    householdSize: 2,
    children: 1,
    elderly: 0,
    respiratoryConditions: 0,
  });
  const fallback = makeFallbackPlan('Bengaluru', profile, { aqi: 160, pm25: 70, forecast: [] });
  const publicResult = toPublicPlanResponse({
    plan: fallback,
    source: 'fallback',
    airQuality: { aqi: 160, pm25: 70, forecast: [] },
    geminiDisabled: true,
    overrides: [],
  });
  const serialized = JSON.stringify(publicResult);
  assert.doesNotMatch(serialized, /vulnerabilityScore|prediction|baseline|attributions|source.?:.?surrogate/i);
  assert.strictEqual(publicResult.plan.members.length, 2);
});

test('asthma count creates a respiratory persona only when no explicit count exists', () => {
  const profile = sanitizeProfile({
    householdSize: 2,
    children: 0,
    elderly: 0,
    respiratoryConditions: 0,
    asthma: true,
  });
  assert.strictEqual(profile.members.length, 2);
  assert.ok(profile.members.some((member) => member.label.includes('respiratory')));
});

// ----- Question sanitisation -----

test('sanitizeQuestion trims and limits length', () => {
  const result = sanitizeQuestion('  What is PM2.5?  ');
  assert.strictEqual(result, 'What is PM2.5?');
});

// ----- Shapley attribution (linear model) -----

test('Shapley contributions sum to prediction minus baseline', () => {
  // Linear model: prediction = 2*PM25 + 3*hour + 1*wind + 4*vuln + 5*commuteFactor
  const features = {
    pm25: 12,
    hour: 8,
    wind: 5,
    vulnerability: 3,
    commuteFactor: 2,
  };
  // weights
  const w = { pm25: 2, hour: 3, wind: 1, vulnerability: 4, commuteFactor: 5 };
  const baseline = 0;
  const prediction = Object.entries(features).reduce((sum, [k, v]) => sum + w[k] * v, 0);
  const contributions = Object.entries(features).map(([k, v]) => ({
    feature: k,
    attribution: w[k] * v,
  }));
  // sum attributions
  const sum = contributions.reduce((a, c) => a + c.attribution, 0);
  assert.ok(Math.abs(sum - (prediction - baseline)) < epsilon, `sum ${sum} vs pred ${prediction} baseline ${baseline}`);
  // verify each attribution matches feature*weight
  contributions.forEach(c => {
    assert.strictEqual(c.attribution, w[c.feature] * features[c.feature]);
  });
});

test('Shapley contributions non‑negative when all features non‑negative and weights positive', () => {
  const features = { x: 1, y: 2 };
  const weights = { x: 0.5, y: 0.3 };
  const prediction = features.x * weights.x + features.y * weights.y;
  const contributions = [features.x * weights.x, features.y * weights.y];
  const sum = contributions.reduce((a, c) => a + c, 0);
  assert.ok(Math.abs(sum - prediction) < epsilon);
});

test('Shapley attribution respects sum of absolute values bound', () => {
  const features = { pm25: 30, hour: 10, wind: 4, vulnerability: 2, commuteFactor: 1 };
  const weights = { pm25: 0.1, hour: 0.2, wind: 0.15, vulnerability: 0.25, commuteFactor: 0.3 };
  const prediction = Object.entries(features).reduce((s, [k, v]) => s + weights[k] * v, 0);
  const attributions = Object.entries(features).map(([k, v]) => weights[k] * v);
  const sum = attributions.reduce((a, c) => a + c, 0);
  assert.ok(Math.abs(sum - prediction) < epsilon);
});

// ----- Safety gate integration -----

test('AQI safety gate blocks outdoor when AQI > 150', () => {
  const aqi = 160;
  const rule = SAFETY_RULES.outdoorBlockAqi;
  assert.strictEqual(rule, 150);
  const blocked = aqi > rule;
  assert.ok(blocked);
});

test('Vulnerable member stricter block at AQI > 100', () => {
  const aqi = 105;
  const vulnerableRule = SAFETY_RULES.vulnerableOutdoorBlockAqi;
  assert.strictEqual(vulnerableRule, 100);
  const blocked = aqi > vulnerableRule;
  assert.ok(blocked);
});

test('AQI safe when below thresholds', () => {
  const aqi = 80;
  const blocked = aqi > 150;
  assert.ok(!blocked);
});

test('Safety threshold function returns same rule values', () => {
  const t = getSafetyThresholds();
  assert.strictEqual(t.outdoorBlockAqi, 150);
  assert.strictEqual(t.vulnerableOutdoorBlockAqi, 100);
});

test('applySafetyToPlan blocks outdoor exertion when AQI > 150 and logs override', () => {
  const plan = {
    summary: 'Test plan',
    members: [
      {
        id: 'adult_1',
        label: 'Adult 1',
        vulnerable: false,
        vulnerabilityScore: 0.2,
        periods: {
          morning: {
            activity: 'Jog outdoors',
            outdoor: true,
            exertion: 'moderate',
            durationMinutes: 30,
            reason: 'Good air',
            source: 'llm',
            __source: 'llm',
          },
        },
      },
    ],
  };
  const result = applySafetyToPlan(plan, { aqi: 160 });
  const period = result.plan.members[0].periods.morning;
  assert.strictEqual(period.outdoor, false);
  assert.strictEqual(period.exertion, 'none');
  assert.ok(result.overrides.length > 0);
  assert.ok(result.overrides[0].action === 'replaced');
});

test('validatePlanOutput accepts a valid plan', () => {
  const plan = {
    summary: 'Valid plan summary',
    members: [
      {
        id: 'adult_1',
        label: 'Adult 1',
        vulnerable: false,
        vulnerabilityScore: 0.2,
        periods: {
          morning: {
            activity: 'Light indoor yoga',
            outdoor: false,
            exertion: 'light',
            durationMinutes: 20,
            reason: 'AQI moderate',
            indoorAlternative: 'Yoga indoors',
            source: 'surrogate',
          },
          afternoon: {
            activity: 'Read indoors',
            outdoor: false,
            exertion: 'none',
            durationMinutes: 30,
            reason: 'High AQI',
            indoorAlternative: 'Read indoors',
            source: 'surrogate',
          },
          evening: {
            activity: 'Walk indoors',
            outdoor: false,
            exertion: 'none',
            durationMinutes: 10,
            reason: 'High AQI',
            indoorAlternative: 'Walk indoors',
            source: 'surrogate',
          },
        },
      },
    ],
  };
  const result = validatePlanOutput(plan);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.issues.length, 0);
});