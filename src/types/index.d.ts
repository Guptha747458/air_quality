export interface HouseholdProfile {
  location: string;
  householdSize: number;
  children: number;
  elderly: number;
  respiratoryConditions: number;
  asthma: boolean;
  outdoorWork: boolean;
  commuteMode: string;
  cookingFuel: string;
  heatingSource: string;
  language: 'en' | 'hi';
}

export interface ForecastPoint {
  time: string;
  pm25: number;
  pm10?: number;
  aqi?: number;
}

export interface AirQualityData {
  aqi: number;
  pm25: number;
  pm10?: number;
  windSpeed?: number;
  forecast?: ForecastPoint[];
}

export interface WhyFactor {
  factor: string;
  contribution: number;
  direction: 'increase' | 'decrease';
  label: string;
}

export interface PeriodRoutine {
  activity: string;
  why: string;
  exposureEffect?: string;
  commute?: string;
  whyFactors?: WhyFactor[];
}

export interface Member {
  id: string;
  label: string;
  role: 'child' | 'elder' | 'adult';
  vulnerable: boolean;
  periods: {
    morning: PeriodRoutine;
    afternoon: PeriodRoutine;
    evening: PeriodRoutine;
  };
}

export interface GroupedProtection {
  memberId: string;
  memberName: string;
  role: 'child' | 'elder' | 'adult';
  vulnerable: boolean;
  periods: string[];
}

export interface PlanData {
  airQuality: AirQualityData;
  plan: {
    summary: string;
    members: Member[];
    indoorAirHacks: string[];
    sustainableAlternatives: string[];
  };
  overrides?: Array<{
    memberId: string;
    period: string;
    rule: string;
    reason: string;
  }>;
  fallback?: boolean;
  note?: string;
}
