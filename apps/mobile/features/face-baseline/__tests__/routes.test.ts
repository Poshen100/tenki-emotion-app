import { ONBOARDING_COMPLETE_ROUTE, establishedExitRoute, FB_ROUTES } from '../screens/routes';

describe('establishedExitRoute', () => {
  it('routes back to onboarding complete when entered from onboarding', () => {
    expect(establishedExitRoute('onboarding')).toBe(ONBOARDING_COMPLETE_ROUTE);
  });

  it('routes to the standalone maturity loop otherwise', () => {
    expect(establishedExitRoute('standalone')).toBe(FB_ROUTES.maturity);
  });
});
