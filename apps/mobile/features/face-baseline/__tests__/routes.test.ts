import { planOnboardingBaselines } from '@tenki/domain';
import {
  DAILY_RESULT_ROUTE,
  FINGER_BASELINE_ROUTE,
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

describe('the finger branch out of the face baseline', () => {
  it('goes to the finger baseline when nothing else can supply HRV', () => {
    const plan = planOnboardingBaselines({ connectedPlatforms: [] });
    expect(establishedExitRoute('onboarding', plan)).toBe(FINGER_BASELINE_ROUTE);
  });

  it('goes straight to completion when a wearable already supplies HRV', () => {
    const plan = planOnboardingBaselines({ connectedPlatforms: ['healthkit'] });
    expect(establishedExitRoute('onboarding', plan)).toBe(ONBOARDING_COMPLETE_ROUTE);
  });

  it('keeps the original behaviour when no plan is passed', () => {
    // Every caller predating the branch must be unaffected.
    expect(establishedExitRoute('onboarding')).toBe(ONBOARDING_COMPLETE_ROUTE);
  });

  it('never diverts a standalone scan into onboarding', () => {
    const plan = planOnboardingBaselines({ connectedPlatforms: [] });
    expect(establishedExitRoute('standalone', plan)).not.toBe(FINGER_BASELINE_ROUTE);
  });
});
