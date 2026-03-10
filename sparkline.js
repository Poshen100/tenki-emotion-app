/**
 * sparkline.js — Canvas-based real-time sparkline waveforms
 *
 * 40-point rolling window, 350ms update rate
 * Bezier-smoothed line, gradient area fill
 * Retina: canvas.width = el.width * dpr; ctx.scale(dpr, dpr)
 * Auto-scale Y (min*0.85, max*1.15)
 */
(function (global) {
    'use strict';

    var DPR = Math.min(window.devicePixelRatio || 1, 2);

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} opts - { color, maxPoints, lineWidth }
     */
    function Sparkline(canvas, opts) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.color = (opts && opts.color) || '#00B4D8';
        this.maxPoints = (opts && opts.maxPoints) || 40;
        this.lineWidth = (opts && opts.lineWidth) || 1.5;
        this.data = [];

        // Retina setup
        var rect = canvas.getBoundingClientRect();
        var w = rect.width || canvas.width || 160;
        var h = rect.height || canvas.height || 32;
        canvas.width = w * DPR;
        canvas.height = h * DPR;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        this.ctx.scale(DPR, DPR);
        this.w = w;
        this.h = h;
    }

    Sparkline.prototype.push = function (value) {
        this.data.push(value);
        if (this.data.length > this.maxPoints) this.data.shift();
        this.draw();
    };

    Sparkline.prototype.draw = function () {
        var ctx = this.ctx;
        var w = this.w;
        var h = this.h;
        var data = this.data;

        ctx.clearRect(0, 0, w, h);
        if (data.length < 2) return;

        // Auto-scale with padding
        var min = Infinity, max = -Infinity;
        for (var k = 0; k < data.length; k++) {
            if (data[k] < min) min = data[k];
            if (data[k] > max) max = data[k];
        }
        min *= 0.85;
        max *= 1.15;
        var range = max - min || 1;

        var pad = 2;
        var drawH = h - pad * 2;
        var step = w / (this.maxPoints - 1);
        var startIdx = this.maxPoints - data.length;

        // Calculate points
        var pts = [];
        for (var i = 0; i < data.length; i++) {
            pts.push({
                x: (startIdx + i) * step,
                y: pad + drawH - ((data[i] - min) / range) * drawH
            });
        }

        // Draw bezier-smoothed line
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.moveTo(pts[0].x, pts[0].y);

        for (var j = 1; j < pts.length; j++) {
            var prev = pts[j - 1];
            var curr = pts[j];
            var cpx = (prev.x + curr.x) / 2;
            ctx.quadraticCurveTo(prev.x + (cpx - prev.x) * 0.8, prev.y, cpx, (prev.y + curr.y) / 2);
            ctx.quadraticCurveTo(curr.x - (curr.x - cpx) * 0.8, curr.y, curr.x, curr.y);
        }
        ctx.stroke();

        // Area fill with gradient
        var lastPt = pts[pts.length - 1];
        ctx.lineTo(lastPt.x, h);
        ctx.lineTo(pts[0].x, h);
        ctx.closePath();

        // Parse color for rgba
        var fillGrad = ctx.createLinearGradient(0, 0, 0, h);
        fillGrad.addColorStop(0, this._rgba(0.25));
        fillGrad.addColorStop(1, this._rgba(0));
        ctx.fillStyle = fillGrad;
        ctx.fill();
    };

    Sparkline.prototype._rgba = function (alpha) {
        var c = this.color;
        // Handle hex colors
        if (c.charAt(0) === '#') {
            var hex = c.slice(1);
            if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
            var r = parseInt(hex.slice(0, 2), 16);
            var g = parseInt(hex.slice(2, 4), 16);
            var b = parseInt(hex.slice(4, 6), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        }
        return c;
    };

    Sparkline.prototype.reset = function () {
        this.data = [];
        this.ctx.clearRect(0, 0, this.w * DPR, this.h * DPR);
    };

    global.TENKI_Sparkline = Sparkline;
})(window);
