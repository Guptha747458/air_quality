export const SAFETY_RULES = Object.freeze({
  outdoorBlockAqi: 150,
  vulnerableOutdoorBlockAqi: 100,
  moderateExertionBlockAqi: 100,
  lowExertionAllowedAqi: 150
});

export const GEMINI = Object.freeze({
  apiKey: process.env.GEMINI_API_KEY || '',
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  timeoutMs: 12000,
  systemInstruction: 'You are an air-quality planning assistant. Return only valid JSON.'
});

export const OPEN_METEO = Object.freeze({
  geocodeUrl: 'https://geocoding-api.open-meteo.com/v1/search',
  airQualityUrl: 'https://air-quality-api.open-meteo.com/v1/air-quality'
});

export const MEMBER_ROLES = Object.freeze({
  adult: 'Adult',
  child: 'Child',
  elderly: 'Elder',
  respiratory: 'Adult with respiratory condition'
});

export const LANGUAGE_CODES = Object.freeze({
  en: 'en',
  hi: 'hi'
});

export function getSafetyThresholds() {
  return { ...SAFETY_RULES };
}
