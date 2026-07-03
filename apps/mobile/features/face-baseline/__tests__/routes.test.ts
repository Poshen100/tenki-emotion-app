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
  it('pins the daily reveal to the Today tab (standalone result screens retired 2026-07-03)', () => {
    expect(DAILY_RESULT_ROUTE).toBe('/');
  });
});
