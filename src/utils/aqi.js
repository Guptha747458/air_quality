/**
 * AQI Calculation & Clinical EPA Tier Mapping
 */

export function getAqiDetails(aqi, lang = 'en') {
  if (aqi == null) {
    return {
      category: 'unavailable',
      label: lang === 'hi' ? 'अनुपलब्ध' : 'Unavailable',
      desc: lang === 'hi' ? 'कोई लाइव सेंसर डेटा नहीं मिला' : 'No live sensor reading currently available.',
      riskLevel: lang === 'hi' ? 'अज्ञात' : 'Unknown',
      actionPrompt: lang === 'hi' ? 'हवा की जांच करें' : 'Check outdoor air quality before exertion.',
      whoAffected: lang === 'hi' ? 'डेटा अनुपलब्ध' : 'Data pending verification',
    };
  }

  const val = Number(aqi);

  if (val <= 50) {
    return {
      category: 'good',
      label: lang === 'hi' ? 'अच्छा (0–50)' : 'Good (0–50)',
      desc: lang === 'hi'
        ? 'हवा की गुणवत्ता संतोषजनक है; प्रदूषण से कोई जोखिम नहीं है।'
        : 'Air quality is satisfactory; air pollution poses little to no health risk.',
      riskLevel: lang === 'hi' ? 'न्यूनतम जोखिम' : 'Minimal Risk',
      actionPrompt: lang === 'hi' ? 'बाहरी गतिविधियों के लिए आदर्श समय' : 'Ideal conditions for all outdoor activities and natural ventilation.',
      whoAffected: lang === 'hi' ? 'कोई नहीं — सभी के लिए सुरक्षित' : 'No one — Safe for all family members',
    };
  }

  if (val <= 100) {
    return {
      category: 'moderate',
      label: lang === 'hi' ? 'मध्यम (51–100)' : 'Moderate (51–100)',
      desc: lang === 'hi'
        ? 'हवा स्वीकार्य है; अत्यंत संवेदनशील व्यक्तियों में हल्के लक्षण हो सकते हैं।'
        : 'Acceptable air quality; very sensitive individuals may experience mild respiratory symptoms.',
      riskLevel: lang === 'hi' ? 'मध्यम जोखिम' : 'Moderate Alert',
      actionPrompt: lang === 'hi' ? 'सामान्य गतिविधियां जारी रख सकते हैं' : 'Standard daily routines safe; monitor children during prolonged exertion.',
      whoAffected: lang === 'hi' ? 'अत्यंत संवेदनशील व्यक्ति' : 'Unusually sensitive individuals with severe asthma',
    };
  }

  if (val <= 150) {
    return {
      category: 'usg',
      label: lang === 'hi' ? 'संवेदनशील वर्गों के लिए अस्वस्थ (101–150)' : 'Sensitive Groups (101–150)',
      desc: lang === 'hi'
        ? 'बच्चों, वरिष्ठों और दमा पीड़ितों को बाहरी श्रम सीमित करना चाहिए।'
        : 'Children, seniors, and individuals with respiratory conditions should limit prolonged outdoor exertion.',
      riskLevel: lang === 'hi' ? 'संवेदनशील चेतावनी' : 'Unhealthy for Sensitive Groups',
      actionPrompt: lang === 'hi' ? 'संवेदनशील सदस्य घर के अंदर रहें' : 'Shift high-exertion workouts indoors; keep asthma inhalers handy.',
      whoAffected: lang === 'hi' ? 'बच्चे, वरिष्ठ नागरिक, दमा पीड़ित' : 'Children, Seniors, and Respiratory Patients',
    };
  }

  if (val <= 200) {
    return {
      category: 'unhealthy',
      label: lang === 'hi' ? 'अस्वस्थ (151–200)' : 'Unhealthy (151–200)',
      desc: lang === 'hi'
        ? 'हर कोई स्वास्थ्य प्रभाव महसूस कर सकता है; संवेदनशील वर्ग बाहर जाने से बचें।'
        : 'Everyone may experience health effects; sensitive groups should avoid all outdoor physical exertion.',
      riskLevel: lang === 'hi' ? 'उच्च जोखिम' : 'High Risk Alert',
      actionPrompt: lang === 'hi' ? 'बाहरी व्यायाम रोकें और खिड़कियाँ बंद रखें' : 'Avoid outdoor running/play; use indoor air filtration and N95 masks for commutes.',
      whoAffected: lang === 'hi' ? 'सभी परिवारजन (संवेदनशील सर्वाधिक प्रभावित)' : 'All family members; children & seniors heavily impacted',
    };
  }

  if (val <= 300) {
    return {
      category: 'very-unhealthy',
      label: lang === 'hi' ? 'बहुत अस्वस्थ (201–300)' : 'Very Unhealthy (201–300)',
      desc: lang === 'hi'
        ? 'स्वास्थ्य चेतावनी: परिवार के सभी सदस्यों के लिए गंभीर प्रभाव का जोखिम।'
        : 'Health alert: serious risk of respiratory and cardiovascular effects for everyone.',
      riskLevel: lang === 'hi' ? 'गंभीर जोखिम' : 'Emergency Warning',
      actionPrompt: lang === 'hi' ? 'सभी सदस्य घर के अंदर सुरक्षित रहें' : 'Keep all members indoors; seal drafty windows and run HEPA air purifiers.',
      whoAffected: lang === 'hi' ? 'पूरा परिवार खतरे में' : 'Entire household at acute health risk',
    };
  }

  return {
    category: 'hazardous',
    label: lang === 'hi' ? 'खतरनाक (301+)' : 'Hazardous (301+)',
    desc: lang === 'hi'
      ? 'आपातकालीन चेतावनी। पूरी आबादी के प्रभावित होने की प्रबल आशंका।'
      : 'Health emergency conditions: entire population is likely to experience adverse symptoms.',
    riskLevel: lang === 'hi' ? 'खतरनाक आपातकाल' : 'Hazardous Emergency',
    actionPrompt: lang === 'hi' ? 'पूर्णतः घर में रहें और खिड़कियाँ सील रखें' : 'Stay strictly indoors; eliminate all outdoor exposure and use emergency filtration.',
    whoAffected: lang === 'hi' ? 'सभी सदस्य तुरंत सुरक्षित हों' : 'Emergency: entire population vulnerable to toxic particulates',
  };
}

/**
 * Identify the cleanest continuous 2-hour outdoor window from the forecast.
 */
export function getBestOutdoorWindow(forecast, lang = 'en') {
  if (!Array.isArray(forecast) || forecast.length < 3) {
    return lang === 'hi' ? 'डेटा उपलब्ध नहीं' : 'Forecast pending';
  }

  let minAvgPm = Infinity;
  let bestStartIdx = 0;

  for (let i = 0; i <= Math.min(forecast.length - 2, 22); i++) {
    const avg = ((Number(forecast[i].pm25) || 50) + (Number(forecast[i + 1].pm25) || 50)) / 2;
    if (avg < minAvgPm) {
      minAvgPm = avg;
      bestStartIdx = i;
    }
  }

  const parseTime = (isoTime, offsetHours) => {
    if (!isoTime) return `+${offsetHours}h`;
    const d = new Date(isoTime);
    if (isNaN(d.getTime())) return `+${offsetHours}h`;
    const hrs = d.getHours();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const formatted = hrs % 12 || 12;
    return `${formatted}:00 ${ampm}`;
  };

  const startTimeStr = parseTime(forecast[bestStartIdx]?.time, bestStartIdx);
  const endIdx = Math.min(forecast.length - 1, bestStartIdx + 2);
  const endTimeStr = parseTime(forecast[endIdx]?.time, endIdx);

  return `${startTimeStr} – ${endTimeStr}`;
}

/**
 * Strictly bounded demographic calculations ensuring adult >= 0.
 */
export function calculateDemographics(profile) {
  const size = Math.max(1, Number(profile.householdSize) || 1);
  const children = Math.max(0, Math.min(size, Number(profile.children) || 0));
  const maxElderly = Math.max(0, size - children);
  const elderly = Math.max(0, Math.min(maxElderly, Number(profile.elderly) || 0));
  const adults = Math.max(0, size - children - elderly);
  const maxRespiratory = Math.max(0, size);
  const respiratory = Math.max(
    0,
    Math.min(maxRespiratory, Number(profile.respiratoryConditions) || (profile.asthma ? 1 : 0))
  );

  return { size, children, elderly, adults, respiratory };
}
