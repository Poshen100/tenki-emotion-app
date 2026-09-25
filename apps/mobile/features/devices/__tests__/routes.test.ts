import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEVICES_ROUTE } from '../screens/routes';

describe('DEVICES_ROUTE', () => {
  it('points at the Devices screen', () => {
    expect(DEVICES_ROUTE).toBe('/devices');
  });

  it('has a matching file-based route, so the push cannot silently 404', () => {
    const appDir = join(__dirname, '..', '..', '..', 'app');
    const routeFile = join(appDir, `${DEVICES_ROUTE.replace(/^\//, '')}.tsx`);
    expect(existsSync(routeFile)).toBe(true);
  });
});
