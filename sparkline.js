class Sparkline {
    constructor(canvas, color) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.color = color;
        this.data = [];
        this.maxPoints = 40;
        this._resize();
        this._resizeObserver = new ResizeObserver(() => this._resize());
        this._resizeObserver.observe(canvas.parentElement);
    }

    _resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.w = rect.width;
        this.h = rect.height;
        if (this.data.length > 1) this.draw();
    }

    push(value) {
        this.data.push(value);
        if (this.data.length > this.maxPoints) this.data.shift();
        this.draw();
    }

    draw() {
        const { ctx, w, h, data, color } = this;
        if (data.length < 2) return;
        ctx.clearRect(0, 0, w, h);

        const min = Math.min(...data) * 0.85;
        const max = Math.max(...data) * 1.15;
        const range = max - min || 1;
        const yScale = v => h - ((v - min) / range) * (h - 4) - 2;
        const xStep = w / (this.maxPoints - 1);
        const pts = data.map((v, i) => ({ x: (this.maxPoints - data.length + i) * xStep, y: yScale(v) }));

        // Area fill
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color + '30');
        grad.addColorStop(1, color + '00');
        ctx.beginPath();
        ctx.moveTo(pts[0].x, h);
        this._bezierPath(ctx, pts);
        ctx.lineTo(pts[pts.length - 1].x, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        this._bezierPath(ctx, pts);
        ctx.strokeStyle = color + '90';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // End dot
        const last = pts[pts.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color + '25';
        ctx.fill();
    }

    _bezierPath(ctx, pts) {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
            const curr = pts[i], next = pts[i + 1];
            const cpx = (curr.x + next.x) / 2;
            ctx.bezierCurveTo(cpx, curr.y, cpx, next.y, next.x, next.y);
        }
    }
}
