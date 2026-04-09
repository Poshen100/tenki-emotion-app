// Baseline feature flags — URL params override for dev/testing
const params = new URLSearchParams(location.search);

export const flags = {
  debug_sensor_mode: params.has('debug_sensor'),
  show_advanced_calibration: params.has('show_advanced'),
  auto_use_provisional: false,
  mock_fail: params.get('mock_fail') || null,
  mock_accept: params.get('mock_accept') || null,
};
