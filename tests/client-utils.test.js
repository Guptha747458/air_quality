import test from 'node:test';
import assert from 'node:assert/strict';
import { getAqiDetails, getBestOutdoorWindow, calculateDemographics } from '../src/utils/aqi.js';
import { formatHour, capitalize, sanitizeInputNumber } from '../src/utils/format.js';

test('getAqiDetails handles null/undefined AQI', () => {
  const res = getAqiDetails(null, 'en');
  assert.equal(res.category, 'unavailable');
  assert.equal(res.riskLevel, 'Unknown');
});

test('getAqiDetails returns Good for AQI <= 50', () => {
  const res = getAqiDetails(42, 'en');
  assert.equal(res.category, 'good');
  assert.equal(res.riskLevel, 'Minimal Risk');
});

test('getAqiDetails returns Moderate for AQI 51-100', () => {
  const res = getAqiDetails(85, 'en');
  assert.equal(res.category, 'moderate');
  assert.equal(res.riskLevel, 'Moderate Alert');
});

test('getAqiDetails returns USG for AQI 101-150', () => {
  const res = getAqiDetails(130, 'en');
  assert.equal(res.category, 'usg');
  assert.equal(res.riskLevel, 'Unhealthy for Sensitive Groups');
});

test('getAqiDetails returns Unhealthy for AQI 151-200', () => {
  const res = getAqiDetails(175, 'en');
  assert.equal(res.category, 'unhealthy');
  assert.equal(res.riskLevel, 'High Risk Alert');
});

test('getAqiDetails returns Very Unhealthy for AQI 201-300', () => {
  const res = getAqiDetails(250, 'en');
  assert.equal(res.category, 'very-unhealthy');
  assert.equal(res.riskLevel, 'Emergency Warning');
});

test('getAqiDetails returns Hazardous for AQI > 300', () => {
  const res = getAqiDetails(380, 'en');
  assert.equal(res.category, 'hazardous');
  assert.equal(res.riskLevel, 'Hazardous Emergency');
});

test('getBestOutdoorWindow computes lowest PM2.5 window from forecast', () => {
  const mockForecast = [
    { time: '2026-11-23T08:00:00Z', pm25: 180 },
    { time: '2026-11-23T09:00:00Z', pm25: 160 },
    { time: '2026-11-23T10:00:00Z', pm25: 120 },
    { time: '2026-11-23T14:00:00Z', pm25: 25 }, // Cleanest window
    { time: '2026-11-23T15:00:00Z', pm25: 30 },
    { time: '2026-11-23T16:00:00Z', pm25: 40 },
    { time: '2026-11-23T17:00:00Z', pm25: 140 },
  ];
  const windowStr = getBestOutdoorWindow(mockForecast, 'en');
  assert.ok(windowStr.length > 0);
  assert.match(windowStr, /–/);
});

test('calculateDemographics guarantees adult count >= 0 and accurate breakdown for 50 members', () => {
  const profile = {
    householdSize: 50,
    children: 15,
    elderly: 10,
    respiratoryConditions: 5,
    asthma: true,
  };
  const demo = calculateDemographics(profile);
  assert.equal(demo.size, 50);
  assert.equal(demo.children, 15);
  assert.equal(demo.elderly, 10);
  assert.equal(demo.adults, 25);
  assert.equal(demo.respiratory, 5);
});

test('calculateDemographics clamps when children exceed household size', () => {
  const profile = {
    householdSize: 4,
    children: 6,
    elderly: 2,
  };
  const demo = calculateDemographics(profile);
  assert.equal(demo.children, 4);
  assert.equal(demo.elderly, 0);
  assert.equal(demo.adults, 0);
});

test('formatHour formats ISO string to AM/PM', () => {
  const formatted = formatHour('2026-11-23T14:00:00Z', 0);
  assert.ok(formatted.includes('AM') || formatted.includes('PM'));
});

test('capitalize capitalizes strings', () => {
  assert.equal(capitalize('morning'), 'Morning');
  assert.equal(capitalize(''), '');
});

test('sanitizeInputNumber strips leading zeros and clamps', () => {
  assert.equal(sanitizeInputNumber('05', 12, 1), 5);
  assert.equal(sanitizeInputNumber('99', 12, 1), 12);
  assert.equal(sanitizeInputNumber('-5', 12, 1), 1);
  assert.equal(sanitizeInputNumber('abc', 12, 1), 1);
});
