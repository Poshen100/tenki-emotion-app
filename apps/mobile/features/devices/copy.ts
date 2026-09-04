/**
 * @module features/devices/copy
 * @description User-facing strings for the Devices screen, kept in one file so
 * the compliance rules can be tested in one place.
 *
 * Rules enforced by `__tests__/providers.test.ts`:
 *   - 「Apple 健康」never 「Apple 健身」; Health Connect never Google Fit.
 *   - No medical, diagnostic, emotion-detection or financial framing.
 *   - Never claim a device is supported before its adapter ships — an absent
 *     adapter says so plainly, as our gap rather than the user's.
 */

import type { DeviceUnavailableReason } from './types/devices.types';

/** Why a provider is greyed out, said plainly. */
export const UNAVAILABLE_COPY: Readonly<Record<DeviceUnavailableReason, string>> = {
  wrong_os: '這個裝置在你目前的系統上不適用',
  hub_not_installed: '需要先安裝並設定 Health Connect',
  adapter_missing: '尚未開放連接，功能還在開發中',
  second_wave: '規劃中，尚未開放連接',
};

/** Section copy for the screen itself. */
export const DEVICES_SCREEN_COPY = {
  title: '連接裝置',
  subtitle: '連上你已經在用的健康資料，讓校準更貼近你',
  privacyNote: '原始生理訊號留在這支手機上，不會上傳。你可以隨時中斷連接。',
  emptyState: '目前沒有已連接的來源，相機掃描仍可完整使用。',
  neverSynced: '尚未同步',
  connectAction: '連接',
  disconnectAction: '中斷連接',
  retryAction: '再試一次',
} as const;
