/**
 * sparkline.js — Canvas-based real-time sparkline waveforms
 * Used in Bento cards for HR, HRV, RR, Stress mini charts.
 */
(function (global) {
    'use strict';

    /**
     * Create a sparkline renderer for a canvas element.
     * @param {HTMLCanvasElement} canvas - Target canvas
     * @param {object} opts - Configuration
     * @param {string} opts.color - Stroke color (CSS)
     * @param {number} opts.maxPoints - Max data points to display (default 30)
     * @param {number} opts.lineWidth - Line width in px (default 1.5)
     * @param {number} opts.minY - Minimum Y value (optional, auto-scaled)
     * @param {number} opts.maxY - Maximum Y value (optional, auto-scaled)
     */
    function Sparkline(canvas, opts) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.color = (opts && opts.color) || '#00B4D8';
        this.maxPoints = (opts && opts.maxPoints) || 30;
        this.lineWidth = (opts && opts.lineWidth) || 1.5;
        this.minY = (opts && opts.minY) || null;
        this.maxY = (opts && opts.maxY) || null;
        this.data = [];
    }

    Sparkline.prototype.push = function (value) {
        this.data.push(value);
        if (this.data.length > this.maxPoints) {
            this.data.shift();
        }
        this.draw();
    };

    Sparkline.prototype.draw = function () {
        var ctx = this.ctx;
        var w = this.canvas.width;
        var h = this.canvas.height;
        var data = this.data;

        ctx.clearRect(0, 0, w, h);

        if (data.length < 2) return;

        var minVal = this.minY !== null ? this.minY : Math.min.apply(null, data);
        var maxVal = this.maxY !== null ? this.maxY : Math.max.apply(null, data);
        var range = maxVal - minVal || 1;

        var padding = 2;
        var drawH = h - padding * 2;
        var stepX = w / (this.maxPoints - 1);

        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        var startIdx = this.maxPoints - data.length;
        for (var i = 0; i < data.length; i++) {
            var x = (startIdx + i) * stepX;
            var y = padding + drawH - ((data[i] - minVal) / range) * drawH;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Gradient fill under line
        var gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, this.color.replace(')', ', 0.15)').replace('rgb', 'rgba'));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.lineTo((startIdx + data.length - 1) * stepX, h);
        ctx.lineTo(startIdx * stepX, h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
    };

    Sparkline.prototype.reset = function () {
        this.data = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    };

    global.TENKI_Sparkline = Sparkline;
})(window);
