/**
 * TENKI Sparkline renderer (Canvas 2D)
 *
 * 繪製即時滾動的生物信號波形圖
 * 放置於每個 BioCard 底部 (高 32px)
 */

class Sparkline {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {string} color - RGB(A) or hex for the line (e.g. '#00B4D8')
     */
    constructor(canvas, color) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.color = color;

        // Auto-resize observing
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
        this.resize();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = 32 * dpr;
        this.ctx.scale(dpr, dpr);
        this.cssWidth = rect.width;
        this.cssHeight = 32;
    }

    /**
     * @param {number[]} data - 數值陣列 (最多 40 點)
     */
    render(data) {
        if (!data || data.length === 0) return;

        const ctx = this.ctx;
        const w = this.cssWidth;
        const h = this.cssHeight;

        ctx.clearRect(0, 0, w, h);

        if (data.length < 2) return;

        // Auto-scale Y (min*0.85, max*1.15)
        let min = Math.min(...data);
        let max = Math.max(...data);
        if (min === max) {
            min -= 10;
            max += 10;
        }
        const range = (max - min) * 1.3; // Give 15% padding top and bottom
        const yMin = min - (max - min) * 0.15;

        // 從右向左繪製 (最新的點在最右邊)
        const points = [];
        // 假設 data[length-1] 是最新點，固定在 x=w
        const dx = w / 39; // 40 points total = 39 intervals

        for (let i = 0; i < data.length; i++) {
            // point index 0 is oldest, point[length-1] is newest
            // we map index to x so that index=(length-1) -> x=w
            const x = w - (data.length - 1 - i) * dx;
            const y = h - ((data[i] - yMin) / range) * h;
            points.push({ x, y });
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        // Smooth Bezier Curve (簡單控制點生成)
        for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const cx = (p0.x + p1.x) / 2;
            ctx.bezierCurveTo(cx, p0.y, cx, p1.y, p1.x, p1.y);
        }

        // Line Styles
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        ctx.stroke();

        // Area Fill
        ctx.lineTo(points[points.length - 1].x, h);
        ctx.lineTo(points[0].x, h);
        ctx.closePath();

        const hexColor = this.color.startsWith('#') ? this.color : '#FFFFFF';
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        // Add alpha to hex color for gradient
        // e.g. #00B4D8 -> #00B4D840 (25% opacity) to #00B4D800 (0%)
        gradient.addColorStop(0, hexColor + '40'); // ~25% alpha
        gradient.addColorStop(1, hexColor + '00'); // 0% alpha

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 1.0;
        ctx.fill();
    }
}
