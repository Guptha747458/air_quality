# Air Quality & Daily Routines

GenAI-powered app for low-emission daily routines, indoor air hacks, and sustainable alternatives tailored to each user's location and lifestyle.

## Deployed Version Updates

The current deployed version (November 24, 2026, commit `5e72f46`) includes:

- **24-hour PM2.5 forecast timeline** with interactive data points, chart loading/error states, partial-data notices, and retry support.
- **Executive air-quality insights** that summarize current risk, outdoor guidance, and key pollutants.
- **Household vulnerability groups** for children, seniors, sensitive airways, and general adults, with AQI-based risk messaging.
- **Scalable household routines** for 50 or more members, including role filters, member search, and pagination.
- **Expandable daily action details** and quick questions for faster air-quality consultations.
- **Light and dark themes** with accessible contrast, focus indicators, input states, and dark-mode chart and status styling.
- **Responsive and mobile layouts** down to 320px, including a compact hero/grid and a single-column layout for smaller screens.
- **Browser geolocation support** for generating a plan from the user's current coordinates.
- **English and Hindi interface support** through a language toggle.
- **Updated Vite build assets** and corrected script/stylesheet references in the deployed React build.

The frontend was introduced in the preceding deployment update (`faff20b`) as a component-based React application with AQI utilities, translated labels, reusable UI cards, forecast visualization, and unit coverage for client calculations.

## Architecture

- **GenAI layer**: Google Gemini 2.5 Flash (via `GEMINI_API_KEY`) generates daily plans as structured JSON.
- **Explainability (XAI) layer**: A surrogate linear model approximates the planner. Exact Shapley values are computed as `feature * weight` for each feature; the sum of attributions equals `prediction - baseline` within floating-point tolerance.
- **Safety layer**: Hard rules run before and after the LLM. Outdoor exertion is blocked when AQI exceeds 150; for vulnerable members, the threshold is 100. Overrides are logged.
- **Live data**: Open-Meteo Geocoding resolves the location; the Open-Meteo Air Quality API provides current PM2.5, PM10, and AQI. Falls back to the nearest static location if geocoding fails.
- **Frontend**: React with custom Material 3 Expressive tokens, responsive `clamp()` sizing, expressive shapes, light/dark themes, and an inline SVG PM2.5 forecast chart.
- **Backend**: All third-party API calls (Gemini, Open-Meteo) are proxied through the server. API keys never reach the browser.

## Safety Rules

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Outdoor exertion | AQI > 150 | Blocked |
| Vulnerable members | AQI > 100 | Stricter block |
| Moderate exertion | AQI > 100 | Blocked |

Every LLM output is validated against the plan schema. Any recommendation violating a rule is replaced and logged.

## Shapley Attribution

For a linear surrogate `y = Σ w_i * x_i`, the Shapley contribution of feature `i` is `w_i * x_i`. The sum of all contributions equals `prediction - baseline` exactly (within floating-point tolerance). This is verified by the test suite.

## Setup

```bash
cp .env.example .env
# Edit .env to set GEMINI_API_KEY and PORT
npm install
npm test
npm start
```

## Tests

```bash
npm test
```

## CSP

A strict Content-Security-Policy is set on all responses: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com https://geocoding-api.open-meteo.com https://air-quality-api.open-meteo.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self';`.

## Running

Open `http://localhost:8787` in a browser. Enter a location and generate a plan. Disable the Gemini key to switch to fallback mode.

For a production build:

```bash
npm run build
```

The Vite build is written to `public/react-build` and is configured for deployment by Vercel through `vercel.json`.