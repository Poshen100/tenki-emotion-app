/**
 * @fileoverview Performance Chart - Chart.js 績效可視化
 * @description 使用 Chart.js 渲染期望值柱狀圖。
 * @version 2.0.0
 */

(function (global) {
    'use strict';

    class PerformanceChart {
        /**
         * @param {string} canvasId - Canvas 元素 ID
         */
        constructor(canvasId) {
            this.canvasId = canvasId;
            this.chart = null;
        }

        /**
         * 渲染期望值柱狀圖
         * @param {Object} data - 各 tier 的期望值數據
         */
        render(data) {
            const canvas = document.getElementById(this.canvasId);
            if (!canvas) {
                console.warn('[PerformanceChart] Canvas not found:', this.canvasId);
                return;
            }

            // 銷毀舊圖表
            if (this.chart) {
                this.chart.destroy();
            }

            const ctx = canvas.getContext('2d');

            const tiers = [];
            const values = [];
            const colors = [];
            const borderColors = [];

            const tierConfig = {
                peak: { label: 'PEAK (≥80)', bg: 'rgba(0, 255, 136, 0.7)', border: '#00FF88' },
                optimal: { label: 'OPTIMAL (55-79)', bg: 'rgba(100, 200, 255, 0.7)', border: '#64C8FF' },
                neutral: { label: 'NEUTRAL (35-54)', bg: 'rgba(255, 215, 0, 0.7)', border: '#FFD700' },
                degraded: { label: 'DEGRADED (<35)', bg: 'rgba(255, 107, 107, 0.7)', border: '#FF6B6B' }
            };

            for (const [tier, config] of Object.entries(tierConfig)) {
                if (data[tier] && data[tier].expectancy !== undefined) {
                    tiers.push(config.label);
                    values.push(data[tier].expectancy);
                    colors.push(config.bg);
                    borderColors.push(config.border);
                }
            }

            if (tiers.length === 0) {
                ctx.font = '14px system-ui';
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.textAlign = 'center';
                ctx.fillText('尚無足夠數據', canvas.width / 2, canvas.height / 2);
                return;
            }

            this.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: tiers,
                    datasets: [{
                        label: '期望值 ($/筆)',
                        data: values,
                        backgroundColor: colors,
                        borderColor: borderColors,
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(17, 24, 39, 0.95)',
                            titleFont: { size: 13, weight: '600' },
                            bodyFont: { size: 12, family: "'SF Mono', monospace" },
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                label: function (context) {
                                    const val = context.parsed.y;
                                    return `期望值: ${val >= 0 ? '+' : ''}$${val.toFixed(2)}/筆`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.6)',
                                font: { size: 11 }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.6)',
                                font: { size: 11, family: "'SF Mono', monospace" },
                                callback: function (value) {
                                    return (value >= 0 ? '+' : '') + '$' + value;
                                }
                            },
                            title: {
                                display: true,
                                text: '期望值 ($)',
                                color: 'rgba(255, 255, 255, 0.4)',
                                font: { size: 12 }
                            }
                        }
                    },
                    animation: {
                        duration: 800,
                        easing: 'easeOutQuart'
                    }
                }
            });
        }

        /**
         * 更新圖表數據
         * @param {Object} data
         */
        update(data) {
            this.render(data);
        }

        /**
         * 銷毀圖表
         */
        destroy() {
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }
        }
    }

    // ==================== EXPORT ====================

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { PerformanceChart };
    }

    global.TENKI_PERFORMANCE_CHART = {
        create: (canvasId) => new PerformanceChart(canvasId),
        PerformanceChart
    };

    console.log('[PERFORMANCE-CHART] Module loaded ✓');

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
