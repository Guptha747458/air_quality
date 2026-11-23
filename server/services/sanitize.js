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
  const total = profile.householdSize || 1;
  const childrenCount = Math.min(profile.children || 0, total);
  const elderlyCount = Math.min(profile.elderly || 0, Math.max(0, total - childrenCount));
  const remainingSlots = Math.max(0, total - childrenCount - elderlyCount);
  const respiratoryCount = Math.min(profile.respiratoryConditions || 0, total);

  // 1. Generate Children
  for (let i = 0; i < childrenCount; i += 1) {
    members.push({
      id: `child_${i + 1}`,
      label: `Child ${i + 1}`,
      vulnerable: true,
      role: 'child',
      vulnerabilities: ['age-child'],
    });
  }

  // 2. Generate Elderly
  for (let i = 0; i < elderlyCount; i += 1) {
    members.push({
      id: `elder_${i + 1}`,
      label: `Elder ${i + 1}`,
      vulnerable: true,
      role: 'elder',
      vulnerabilities: ['age-elder'],
    });
  }

  // 3. Generate Adults (remaining slots)
  // If respiratory conditions were requested and slots exist, prioritize creating adult personas with respiratory conditions
  let respiratoryAssigned = 0;
  for (let i = 0; i < remainingSlots; i += 1) {
    const isRespiratory = respiratoryAssigned < respiratoryCount || (profile.asthma && respiratoryAssigned === 0);
    if (isRespiratory) {
      respiratoryAssigned += 1;
      members.push({
        id: `respiratory_adult_${respiratoryAssigned}`,
        label: `Adult with respiratory condition ${respiratoryAssigned}`,
        vulnerable: true,
        role: 'adult',
        vulnerabilities: ['respiratory-condition', ...(profile.asthma ? ['asthma'] : [])],
      });
    } else {
      members.push({
        id: `adult_${i + 1}`,
        label: `Adult ${i + 1}`,
        vulnerable: false,
        role: 'adult',
        vulnerabilities: [],
      });
    }
  }

  // If there are still unassigned respiratory conditions (e.g. household is all children or elders),
  // tag existing vulnerable members so their respiratory condition is never silently dropped.
  if (respiratoryAssigned < respiratoryCount || profile.asthma) {
    for (const member of members) {
      if (!member.vulnerabilities.includes('respiratory-condition')) {
        member.vulnerabilities.push('respiratory-condition');
        if (profile.asthma && !member.vulnerabilities.includes('asthma')) {
          member.vulnerabilities.push('asthma');
        }
        member.vulnerable = true;
        respiratoryAssigned += 1;
        if (respiratoryAssigned >= respiratoryCount && !profile.asthma) break;
      }
    }
  }

  return members;
}

export function sanitizeQuestion(value) {
  return cleanText(value, 500);
}

export function sanitizePlanResponse(value) {
  return value && typeof value === 'object' ? value : null;
}
