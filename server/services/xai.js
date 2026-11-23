const EPSILON = 1e-9;

export function computeShapley(features, weights, baseline = 0) {
  if (!features || typeof features !== 'object') {
    throw new Error('features must be an object');
  }
  if (!weights || typeof weights !== 'object') {
    throw new Error('weights must be an object');
  }
  const keys = Object.keys(features);
  const prediction = keys.reduce((sum, k) => sum + (weights[k] || 0) * (features[k] || 0), 0);
  const attributions = keys.map((k) => ({
    feature: k,
    value: features[k] || 0,
    weight: weights[k] || 0,
    attribution: (weights[k] || 0) * (features[k] || 0),
  }));
  const sum = attributions.reduce((s, a) => s + a.attribution, 0);
  if (Math.abs(sum - (prediction - baseline)) > EPSILON) {
    throw new Error(`Shapley sum mismatch: sum=${sum}, prediction-baseline=${prediction - baseline}`);
  }
  return {
    prediction,
    baseline,
    attributions,
    sum,
    sumValidated: true,
  };
}

export function buildSurrogateFeatures(context) {
  const aqi = context?.aqi ?? 0;
  const pm25 = context?.pm25 ?? 0;
  const hour = context?.hour ?? 12;
  const wind = context?.windSpeed ?? 5;
  const vulnerable = context?.vulnerable ? 1 : 0;
  const commuteFactor = context?.commuteFactor ?? 0.5;
  const cookingFactor = context?.cookingFactor ?? 0.5;
  const heatingFactor = context?.heatingFactor ?? 0.5;
  const outdoorWork = context?.outdoorWork ? 1 : 0;
  return {
    pm25,
    hour,
    wind,
    vulnerability: vulnerable,
    commuteFactor,
    cookingFactor,
    heatingFactor,
    outdoorWork,
  };
}

const SURROGATE_WEIGHTS = Object.freeze({
  pm25: 0.08,
  hour: 0.05,
  wind: -0.04,
  vulnerability: 0.3,
  commuteFactor: 0.2,
  cookingFactor: 0.15,
  heatingFactor: 0.12,
  outdoorWork: 0.1,
});

export function buildSurrogateWeights() {
  return SURROGATE_WEIGHTS;
}

export function surrogatePredict(features) {
  const weights = buildSurrogateWeights();
  return computeShapley(features, weights, 0);
}

export function buildRecommendation(context) {
  const features = buildSurrogateFeatures(context);
  const result = surrogatePredict(features);
  const dominant = [...result.attributions]
    .sort((a, b) => Math.abs(b.attribution) - Math.abs(a.attribution))
    .slice(0, 3);
  return {
    prediction: result.prediction,
    baseline: result.baseline,
    sum: result.sum,
    attributions: result.attributions,
    dominantContributors: dominant.map((d) => d.feature),
    topShapley: dominant,
  };
}