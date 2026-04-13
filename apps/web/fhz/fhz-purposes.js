// TENKI FIX v5.2 - added canonical FHZ purpose definitions including BASELINE mode
(function (global) {
    'use strict';

    var PURPOSES = [
        {
            id: 'QUICK',
            label: 'Quick',
            subtitle: '30 sec quick PPG read',
            commitLabel: 'Start Quick Scan',
            guidance: 'Lock a stable finger signal and hand off to the scan flow.',
            rppgMode: 'default',
            countdownSec: 30,
            usesResultsFlow: true
        },
        {
            id: 'DEEP',
            label: 'Deep',
            subtitle: '60 sec deep PPG scan',
            commitLabel: 'Start Deep Scan',
            guidance: 'Use the rear camera for a full progressive PPG finger scan.',
            rppgMode: 'spectrum',
            countdownSec: 62,
            usesResultsFlow: true
        },
        {
            id: 'BASELINE',
            label: 'Baseline',
            subtitle: 'Hold finger on lens for 3 min',
            commitLabel: 'Build Baseline',
            guidance: 'Capture a calm 3 minute finger PPG baseline before other scans.',
            rppgMode: 'spectrum',
            countdownSec: 180,
            usesResultsFlow: false
        }
    ];

    function getPurposeById(purposeId) {
        var i;

        for (i = 0; i < PURPOSES.length; i++) {
            if (PURPOSES[i].id === purposeId) {
                return PURPOSES[i];
            }
        }

        return PURPOSES[0];
    }

    function getDefaultPurpose() {
        return PURPOSES[0];
    }

    global.TENKI_FHZ_PURPOSES = {
        PURPOSES: PURPOSES,
        getById: getPurposeById,
        getDefaultPurpose: getDefaultPurpose
    };
})(window);
