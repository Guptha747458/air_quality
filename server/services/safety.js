import { SAFETY_RULES } from './config.js';

export const EXERTIONS = Object.freeze(['none', 'light', 'moderate', 'high']);

export function assessSafety(activity, context) {
  const aqi = context?.aqi ?? 0;
  const vulnerable = context?.vulnerable ?? false;
  if (context?.aqi === null || context?.aqi === undefined) {
    return {
      allowed: false,
      shouldBlock: true,
      reason: 'Outdoor activity blocked because live AQI data is unavailable',
    };
  }
  const outdoorBlocked = aqi > SAFETY_RULES.outdoorBlockAqi;
  const vulnerableBlocked = vulnerable && aqi > SAFETY_RULES.vulnerableOutdoorBlockAqi;
  const exertionBlocked =
    activity?.exertion === 'moderate' ||
    activity?.exertion === 'high' ||
    (activity?.exertion === 'light' && aqi > SAFETY_RULES.moderateExertionBlockAqi);

  const shouldBlock = outdoorBlocked || vulnerableBlocked || exertionBlocked;
  if (!shouldBlock) {
    return { allowed: true, shouldBlock: false, reason: null };
  }

  const reasons = [];
  if (outdoorBlocked) reasons.push(`Outdoor activity blocked at AQI ${aqi} above safety limit ${SAFETY_RULES.outdoorBlockAqi}`);
  if (vulnerableBlocked) reasons.push(`Vulnerable member exposure blocked at AQI ${aqi} above stricter limit ${SAFETY_RULES.vulnerableOutdoorBlockAqi}`);
  if (activity?.exertion === 'moderate' || activity?.exertion === 'high') reasons.push(`Exertion level ${activity.exertion} is not allowed at AQI ${aqi}`);

  return {
    allowed: false,
    shouldBlock: true,
    reason: reasons.join('; '),
  };
}

export function createSafetyLogEntry({ source, memberId, period, action, originalExcerpt, context }) {
  return {
    timestamp: new Date().toISOString(),
    source,
    memberId: memberId || null,
    period: period || null,
    action,
    originalExcerpt: originalExcerpt || null,
    context: {
      aqi: context?.aqi ?? null,
      pm25: context?.pm25 ?? null,
      outdoorBlockAqi: SAFETY_RULES.outdoorBlockAqi,
      vulnerableOutdoorBlockAqi: SAFETY_RULES.vulnerableOutdoorBlockAqi,
    },
  };
}

export function applySafetyToPlan(plan, context) {
  const overrides = [];
  const members = Array.isArray(plan?.members) ? plan.members : [];
  for (const member of members) {
    const periods = member?.periods || {};
    for (const period of ['morning', 'afternoon', 'evening']) {
      const activity = periods?.[period];
      const assessment = assessSafety(activity, {
        aqi: context?.aqi ?? null,
        vulnerable: member?.vulnerable ?? false,
      });
      if (assessment.shouldBlock) {
        const originalExcerpt = activity?.activity || activity?.reason || '';
        overrides.push(createSafetyLogEntry({
          source: activity?.__source || 'llm',
          memberId: member?.id,
          period,
          action: 'replaced',
          originalExcerpt,
          context,
        }));
        periods[period] = {
          ...(activity || {}),
          outdoor: false,
          exertion: 'none',
          durationMinutes: 0,
          reason: `Safety override: ${assessment.reason}. Indoor activity recommended.`,
          indoorAlternative: activity?.indoorAlternative || 'Keep windows closed and use a purifier during high AQI.',
          generatedBy: 'safety_fallback',
        };
      }
    }
  }
  return { plan, overrides };
}

export function validatePlanOutput(plan) {
  const issues = [];
  if (!plan || typeof plan !== 'object') {
    return { valid: false, issues: ['Plan must be an object'] };
  }
  if (typeof plan.summary !== 'string' || plan.summary.trim().length < 5) {
    issues.push('Missing or short summary');
  }
  const members = Array.isArray(plan.members) ? plan.members : [];
  if (!Array.isArray(members) || members.length < 1) {
    issues.push('Missing members array');
  }
  for (const member of members) {
    if (!member?.id) issues.push('Member missing id');
    const periods = member?.periods;
    if (!periods) {
      issues.push(`Member ${member?.id || 'unknown'} missing periods`);
      continue;
    }
    for (const period of ['morning', 'afternoon', 'evening']) {
      const activity = periods[period];
      if (!activity?.activity) {
        issues.push(`Member ${member?.id} period ${period} missing activity`);
        continue;
      }
      if (typeof activity.outdoor !== 'boolean') issues.push(`Member ${member.id} period ${period} outdoor must be boolean`);
      if (!EXERTIONS.includes(activity.exertion)) issues.push(`Member ${member.id} period ${period} invalid exertion`);
      const duration = Number(activity.durationMinutes);
      if (Number.isNaN(duration) || duration < 0 || duration > 240) {
        issues.push(`Member ${member.id} period ${period} invalid durationMinutes`);
      }
      if (typeof activity.reason !== 'string') issues.push(`Member ${member.id} period ${period} missing reason`);
    }
  }
  return { valid: issues.length === 0, issues };
}
