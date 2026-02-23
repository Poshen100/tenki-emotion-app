/**
 * Hybrid Sync (Web Bluetooth & Wearables Integration)
 * 
 * Supports connecting to BLE Chest Straps for medical-grade RR-Intervals.
 * BLE data always overrides Camera rPPG when present.
 */

const HybridSync = {
    bleDevice: null,
    bleServer: null,
    hrService: null,
    hrCharacteristic: null,

    isConnected: false,
    isConnecting: false,

    // Stats
    lastHR: 0,
    lastRR: [],
    source: 'camera', // 'camera' or 'ble'

    /**
     * Request Bluetooth connection to a Heart Rate monitor
     */
    connect: async function () {
        if (!navigator.bluetooth) {
            console.warn('[HybridSync] Web Bluetooth API not supported in this browser.');
            // Stub for iOS PWA where WebBLE might not be available
            return;
        }

        try {
            this.isConnecting = true;
            console.log('[HybridSync] Requesting Bluetooth Device...');

            this.bleDevice = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['heart_rate'] }]
            });

            this.bleDevice.addEventListener('gattserverdisconnected', this._onDisconnected.bind(this));

            console.log('[HybridSync] Connecting to GATT Server...');
            this.bleServer = await this.bleDevice.gatt.connect();

            console.log('[HybridSync] Getting Heart Rate Service...');
            this.hrService = await this.bleServer.getPrimaryService('heart_rate');

            console.log('[HybridSync] Getting Heart Rate Measurement Characteristic...');
            this.hrCharacteristic = await this.hrService.getCharacteristic('heart_rate_measurement');

            this.hrCharacteristic.addEventListener('characteristicvaluechanged', this._handleHRMeasurement.bind(this));

            console.log('[HybridSync] Starting Notifications...');
            await this.hrCharacteristic.startNotifications();

            this.isConnected = true;
            this.isConnecting = false;
            this.source = 'ble';

            console.log('[HybridSync] Successfully connected to BLE HR Monitor.');

            // Notify system of source change
            if (window.EventBridge) {
                window.EventBridge.emit('source:changed', { source: 'ble', name: this.bleDevice.name });
            }

        } catch (error) {
            console.error('[HybridSync] Connection failed:', error);
            this.isConnecting = false;
            this._resetState();
        }
    },

    disconnect: function () {
        if (!this.bleDevice) return;

        console.log('[HybridSync] Disconnecting from Bluetooth Device...');
        if (this.bleDevice.gatt.connected) {
            this.bleDevice.gatt.disconnect();
        }
    },

    _onDisconnected: function (event) {
        const device = event.target;
        console.log(`[HybridSync] Device ${device.name} is disconnected.`);
        this._resetState();

        // Fallback to camera
        if (window.EventBridge) {
            window.EventBridge.emit('source:changed', { source: 'camera' });
        }
    },

    _resetState: function () {
        this.isConnected = false;
        this.source = 'camera';
        this.bleDevice = null;
        this.bleServer = null;
        this.hrService = null;
        this.hrCharacteristic = null;
    },

    _handleHRMeasurement: function (event) {
        const value = event.target.value;

        // Parse Heart Rate Measurement (0x2A37)
        // Flags are in the first byte
        const flags = value.getUint8(0);

        // Heart Rate Value Format (bit 0): 0 = 8-bit, 1 = 16-bit
        const hr16bit = flags & 0x01;

        let hrValue = 0;
        let index = 1;

        if (hr16bit) {
            hrValue = value.getUint16(index, true); // true = little-endian
            index += 2;
        } else {
            hrValue = value.getUint8(index);
            index += 1;
        }

        this.lastHR = hrValue;

        // RR-Interval (bit 4)
        const rrIntervalPresent = flags & 0x10;
        const rrIntervals = [];

        if (rrIntervalPresent) {
            // 1 or more RR intervals may be present
            while (index < value.byteLength) {
                // RR-Intervals are in units of 1/1024 seconds
                const rawRR = value.getUint16(index, true);
                const rrMs = (rawRR / 1024) * 1000;
                rrIntervals.push(rrMs);
                index += 2;
            }
            this.lastRR = rrIntervals;
        }

        // Broadcast live medical-grade data
        if (window.EventBridge) {
            window.EventBridge.emit('ble:data', {
                hr: hrValue,
                rr: rrIntervals,
                timestamp: Date.now()
            });
        }
    },

    // Import stubs for HealthKit/Garmin (to be called by app logic when authorized)
    importHealthKitSDNN: function (sdnnValues) {
        console.log('[HybridSync] Imported HealthKit SDNN data', sdnnValues);
        // Logic to fuse into TEI_PR99_Engine baseline
    },

    importGarminRMSSD: function (rmssdValues) {
        console.log('[HybridSync] Imported Garmin RMSSD data', rmssdValues);
        // Logic to fuse into TEI_PR99_Engine baseline
    }
};

window.HybridSync = HybridSync;
