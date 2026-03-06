/**
 * TENKI Haptics — 跨平台觸感回饋
 * 
 * Android: navigator.vibrate()
 * iOS:     Sub-bass audio pulse (AudioContext 20Hz, 30ms)
 * 
 * 規則: 震動只在「正面事件」觸發。降級/警告不震動。
 */

class TenkiHaptics {
    constructor(audioEngine) {
        this.audio = audioEngine;
        this.canVibrate = 'vibrate' in navigator;
        this.enabled = true;
    }

    lightTap() {
        if (!this.enabled) return;
        if (this.canVibrate) navigator.vibrate(15);
        else this.audio.playSubBassPulse();
    }

    phaseUp() {
        if (!this.enabled) return;
        if (this.canVibrate) navigator.vibrate([10, 30, 10]);
        else {
            this.audio.playSubBassPulse();
            setTimeout(() => this.audio.playSubBassPulse(), 40);
        }
    }

    complete() {
        if (!this.enabled) return;
        if (this.canVibrate) navigator.vibrate([15, 50, 15, 50, 30]);
        else {
            this.audio.playSubBassPulse();
            setTimeout(() => this.audio.playSubBassPulse(), 65);
            setTimeout(() => this.audio.playSubBassPulse(), 130);
        }
    }
}
