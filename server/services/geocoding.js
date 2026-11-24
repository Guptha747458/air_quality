export const FALLBACK_CITIES = [
  { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
];

export async function geocodeLocation(city, {
  geocodeUrl = 'https://geocoding-api.open-meteo.com/v1/search',
  fetchImpl = fetch,
  language = 'en',
  timeout = 3000,
} = {}) {
  const url = new URL(geocodeUrl);
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', language);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetchImpl(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`Geocoding error: ${response.status}`);
    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) throw new Error('No geocoding result');
    return {
      city: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      country: result.country_code || result.country,
      source: 'open-meteo',
    };
  } catch (error) {
    // Fallback: search static list by substring
    const lower = city.toLowerCase();
    let fallback = FALLBACK_CITIES.find((c) => lower.includes(c.name.toLowerCase()));
    if (!fallback) {
      fallback = FALLBACK_CITIES[0]; // fallback to Delhi
    }
    return {
      ...fallback,
      source: 'fallback',
      note: `Geocoding service unavailable; using nearest fallback location ${fallback.name}.`,
      error: error.message,
    };
  }
}

export async function fetchAirQuality(location, {
  airQualityUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality',
  fetchImpl = fetch,
  timeout = 5000,
} = {}) {
  if (!location) {
    throw new Error('Missing location');
  }
  const url = new URL(airQualityUrl);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'pm2_5,pm10,us_aqi,wind_speed_10m');
  url.searchParams.set('hourly', 'pm2_5,pm10,us_aqi,wind_speed_10m');
  url.searchParams.set('timezone', 'auto');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetchImpl(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`Air quality error: ${response.status}`);
    const data = await response.json();
    const current = data?.current || data?.current_values || {};
    const pm25 = current.pm2_5 ?? null;
    const pm10 = current.pm10 ?? null;
    const usAqi = current.us_aqi ?? null;
    const windSpeed = current.wind_speed_10m ?? null;
    if (usAqi === null && pm25 === null) {
      throw new Error('No air quality data');
    }
    const times = Array.isArray(data?.hourly?.time) ? data.hourly.time : [];
    const pm25Forecast = times.map((time, index) => ({
      time,
      pm25: data?.hourly?.pm2_5?.[index] ?? null,
      pm10: data?.hourly?.pm10?.[index] ?? null,
      aqi: data?.hourly?.us_aqi?.[index] ?? null,
      windSpeed: data?.hourly?.wind_speed_10m?.[index] ?? null,
    })).filter((point) => point.pm25 !== null || point.aqi !== null);
    return {
      aqi: usAqi ?? estimateAQI(pm25, pm10),
      pm25,
      pm10,
      usAqi,
      windSpeed,
      source: 'open-meteo',
      timestamp: data?.current?.time || data?.hourly?.time?.[0] || null,
      timezone: data?.timezone || null,
      forecast: pm25Forecast,
    };
  } catch (error) {
    return {
      aqi: null,
      pm25: null,
      pm10: null,
      usAqi: null,
      source: 'fallback',
      timezone: null,
      note: `Air quality service unavailable; no measured AQI is shown. ${error.message}`,
      error: error.message,
      forecast: [],
    };
  }
}

function estimateAQI(pm25, pm10) {
  if (pm25 === null && pm10 === null) return 0;
  let pm = pm25 ?? 0;
  if (pm < 12) return Math.round(pm * 50 / 12);
  if (pm < 35.4) return Math.round(50 + (pm - 12) * 50 / (35.4 - 12));
  if (pm < 55.4) return Math.round(100 + (pm - 35.4) * 50 / (55.4 - 35.4));
  if (pm < 150.4) return Math.round(150 + (pm - 55.4) * 50 / (150.4 - 55.4));
  if (pm < 250.4) return Math.round(200 + (pm - 150.4) * 100 / (250.4 - 150.4));
  return 300;
}

export async function fetchAirQualityByCity(city, options = {}) {
  const geocodeUrl = options.geocodeUrl || 'https://geocoding-api.open-meteo.com/v1/search';
  const airQualityUrl = options.airQualityUrl || 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const fetchImpl = options.fetchImpl || fetch;
  const lang = options.language || 'en';
  const location = await geocodeLocation(city, {
    geocodeUrl,
    fetchImpl,
    language: lang,
  });
  if (!location) {
    return { source: 'fallback', note: 'Could not resolve location', aqi: 0 };
  }
  const airQuality = await fetchAirQuality(location, {
    airQualityUrl,
    fetchImpl,
  });
  return {
    ...airQuality,
    location,
    dataSource: airQuality.source,
    locationSource: location.source,
    note: location.source === 'fallback' ? location.note : airQuality.note,
    source: location.source === 'fallback' ? 'fallback' : airQuality.source,
  };
}