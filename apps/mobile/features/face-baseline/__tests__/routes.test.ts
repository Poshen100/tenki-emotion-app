import {
  DAILY_RESULT_ROUTE,
  ONBOARDING_COMPLETE_ROUTE,
  establishedExitRoute,
  FB_ROUTES,
} from '../screens/routes';

describe('establishedExitRoute', () => {
  it('routes back to onboarding complete when entered from onboarding', () => {
    expect(establishedExitRoute('onboarding')).toBe(ONBOARDING_COMPLETE_ROUTE);
  });

  it('routes to the standalone maturity loop otherwise', () => {
    expect(establishedExitRoute('standalone')).toBe(FB_ROUTES.maturity);
  });
});

describe('DAILY_RESULT_ROUTE', () => {
  it('pins the daily reveal to the existing scan result screen (app/scan/result.tsx)', () => {
    expect(DAILY_RESULT_ROUTE).toBe('/scan/result');
  });
});
