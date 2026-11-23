const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const LOCATION_PATTERN = /^[\p{L}\p{N} ,.\-']{2,120}$/u;

export class ValidationError extends Error {}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') throw new ValidationError('Expected text input');
  let output = value.normalize('NFKC');
  output = output.replace(HTML_TAG, '');
  output = output.replace(/[<>]/g, '');
  output = output.replace(CONTROL, '');
  output = output.replace(/\s+/g, ' ').trim();
  return output.slice(0, maxLength);
}

export function sanitizeText(value, maxLength = 200) {
  return cleanText(value, maxLength);
}

export function sanitizeLocation(value) {
  const cleaned = cleanText(value, 120);
  if (!LOCATION_PATTERN.test(cleaned)) throw new ValidationError('Enter a valid place name');
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function sanitizeBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1', 'y', 'home'].includes(normalized)) return true;
    if (['false', 'no', '0', 'n', 'away', 'outdoor'].includes(normalized)) return false;
  }
  if (value === undefined || value === null || value === '') return defaultValue;
  throw new ValidationError('Boolean input is invalid');
}

export function sanitizeNumber(value, min, max, defaultValue) {
  let parsed = Number(value);
  if (Number.isNaN(parsed)) parsed = Number(defaultValue);
  parsed = Math.round(parsed);
  if (parsed < min) parsed = min;
  if (parsed > max) parsed = max;
  return parsed;
}

const COMMUTE_MODES = new Set([
  'car', 'motorcycle', 'two_wheeler', 'e_two_wheeler', 'bus', 'train', 'walk', 'cycle', 'work_from_home'
]);

const COOKING_FUELS = new Set([
  'none', 'wood', 'charcoal', 'biomass', 'lpg', 'gas', 'electric', 'kerosene', 'induction'
]);

const HEATING_SOURCES = new Set([
  'none', 'electric', 'gas', 'biomass', 'wood', 'charcoal', 'kerosene', 'central_electric'
]);

export function sanitizeProfile(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const householdSize = sanitizeNumber(raw.householdSize, 1, 12, 2);
  let children = sanitizeNumber(raw.children, 0, householdSize, 0);
  let elderly = sanitizeNumber(raw.elderly, 0, Math.max(0, householdSize - children), 0);
  let respiratoryConditions = sanitizeNumber(raw.respiratoryConditions, 0, Math.max(0, householdSize - children - elderly), 0);
  // Category totals must never exceed the household size.
  children = Math.min(children, householdSize);
  elderly = Math.min(elderly, householdSize - children);
  respiratoryConditions = Math.min(respiratoryConditions, householdSize - children - elderly);
  const asthma = sanitizeBoolean(raw.asthma, false);
  const outdoorWork = sanitizeBoolean(raw.outdoorWork, false);

  const rawCommute = typeof raw.commuteMode === 'string' ? raw.commuteMode.trim().toLowerCase().replace(/\s+/g, '_') : 'car';
  const commuteMode = COMMUTE_MODES.has(rawCommute) ? rawCommute : 'car';
  const rawCooking = typeof raw.cookingFuel === 'string' ? raw.cookingFuel.trim().toLowerCase().replace(/\s+/g, '_') : 'lpg';
  const cookingFuel = COOKING_FUELS.has(rawCooking) ? rawCooking : 'lpg';
  const rawHeating = typeof raw.heatingSource === 'string' ? raw.heatingSource.trim().toLowerCase().replace(/\s+/g, '_') : 'none';
  const heatingSource = HEATING_SOURCES.has(rawHeating) ? rawHeating : 'none';
  const language = raw.language === 'hi' ? 'hi' : 'en';

  const profile = {
    householdSize,
    children,
    elderly,
    respiratoryConditions,
    asthma,
    outdoorWork,
    commuteMode,
    cookingFuel,
    heatingSource,
    language
  };

  const members = buildMembers(profile);
  profile.vulnerableCount = members.filter((member) => member.vulnerable).length;

  return { ...profile, members };
}

export function buildMembers(profile) {
  const members = [];
  const addAdult = (label, vulnerable, vulnerabilities = []) => {
    members.push({
      id: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${members.length + 1}`,
      label,
      vulnerable,
      role: 'adult',
      vulnerabilities,
    });
  };

  for (let index = 0; index < profile.children; index += 1) {
    members.push({
      id: `child_${index + 1}`,
      label: `Child ${index + 1}`,
      vulnerable: true,
      role: 'child',
      vulnerabilities: ['age-child'],
    });
  }
  for (let index = 0; index < profile.elderly; index += 1) {
    members.push({
      id: `elder_${index + 1}`,
      label: `Elder ${index + 1}`,
      vulnerable: true,
      role: 'elder',
      vulnerabilities: ['age-elder'],
    });
  }
  for (let index = 0; index < profile.respiratoryConditions; index += 1) {
    members.push({
      id: `respiratory_adult_${index + 1}`,
      label: `Adult with respiratory condition ${index + 1}`,
      vulnerable: true,
      role: 'adult',
      vulnerabilities: ['respiratory-condition'],
    });
  }
  const accounted = profile.children + profile.elderly + profile.respiratoryConditions;
  const adults = profile.householdSize - accounted;
  for (let index = 0; index < adults; index += 1) {
    const asthmaPersona = profile.asthma
      && profile.respiratoryConditions === 0
      && index === 0;
    if (asthmaPersona) {
      addAdult(`Adult with respiratory condition ${index + 1}`, true, ['respiratory-condition', 'asthma']);
    } else {
      addAdult(`Adult ${index + 1}`, false, []);
    }
  }
  if (profile.asthma && profile.respiratoryConditions > 0) {
    const firstRespiratory = members.find((member) => member.role === 'adult' && member.vulnerabilities.includes('respiratory-condition'));
    if (firstRespiratory) firstRespiratory.vulnerabilities.push('asthma');
  }
  return members;
}

export function sanitizeQuestion(value) {
  return cleanText(value, 500);
}

export function sanitizePlanResponse(value) {
  return value && typeof value === 'object' ? value : null;
}
