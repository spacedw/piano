/**
 * NoteHitFX — High-performance particle system for note impact effects.
 *
 * Creates sparkle particles, impact flashes, and glow trails when notes
 * reach the piano hit line. Uses object pooling for zero GC pressure.
 *
 * All rendering uses additive blending ('lighter') for natural light accumulation.
 */

const POOL_SIZE = 500;
const GRAVITY = 120;        // pixels/s² — gentle downward pull
const FLASH_DURATION = 0.18; // seconds
const PARTICLE_LIFE_MIN = 0.3;
const PARTICLE_LIFE_MAX = 0.7;

// Easing: fast start, smooth fade
function easeOutQuad(t) {
    return t * (2 - t);
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export class NoteHitFX {
    constructor() {
        // Particle pool — flat structure for cache friendliness
        this.particles = new Array(POOL_SIZE);
        for (let i = 0; i < POOL_SIZE; i++) {
            this.particles[i] = {
                alive: false,
                x: 0, y: 0,
                vx: 0, vy: 0,
                life: 0, maxLife: 0,
                size: 0,
                r: 255, g: 248, b: 230,
                startAlpha: 1,
                type: 'spark', // 'spark' | 'dot'
            };
        }
        this.nextParticle = 0;

        // Flash pool — up to 20 concurrent flashes
        this.flashes = new Array(20);
        for (let i = 0; i < 20; i++) {
            this.flashes[i] = {
                alive: false,
                x: 0, y: 0,
                width: 0,
                life: 0, maxLife: FLASH_DURATION,
                r: 255, g: 248, b: 230,
            };
        }
        this.nextFlash = 0;

        // Active glow columns (set externally each frame)
        this.glows = [];

        // State
        this.hasActiveEffects = false;
        this.lastTime = 0;
    }

    /**
     * Emit particles and flash for a note impact.
     * @param {number} x - Left edge of the key (px)
     * @param {number} y - Y position of the hit line (px)
     * @param {number} w - Width of the key (px)
     * @param {number} velocity - 0–1, how hard the note was hit
     * @param {{ r: number, g: number, b: number }} color - RGB color
     */
    emit(x, y, w, velocity, color) {
        const cx = x + w / 2;
        const intensity = 0.4 + velocity * 0.6; // 0.4 – 1.0
        const count = Math.floor(6 + intensity * 12); // 6–18 particles

        // Spawn sparkle particles
        for (let i = 0; i < count; i++) {
            const p = this.particles[this.nextParticle];
            this.nextParticle = (this.nextParticle + 1) % POOL_SIZE;

            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9; // upward spread
            const speed = (60 + Math.random() * 100) * intensity;

            p.alive = true;
            p.x = cx + (Math.random() - 0.5) * w * 0.6;
            p.y = y - Math.random() * 4;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.maxLife = PARTICLE_LIFE_MIN + Math.random() * (PARTICLE_LIFE_MAX - PARTICLE_LIFE_MIN);
            p.life = p.maxLife;
            p.size = (1.2 + Math.random() * 2.5) * intensity;
            p.r = color.r + Math.floor(Math.random() * 30);
            p.g = color.g + Math.floor(Math.random() * 20);
            p.b = color.b + Math.floor(Math.random() * 15);
            p.startAlpha = 0.7 + Math.random() * 0.3;
            p.type = Math.random() > 0.3 ? 'spark' : 'dot';
        }

        // Spawn impact flash
        const f = this.flashes[this.nextFlash];
        this.nextFlash = (this.nextFlash + 1) % 20;
        f.alive = true;
        f.x = cx;
        f.y = y;
        f.width = w;
        f.life = FLASH_DURATION;
        f.maxLife = FLASH_DURATION;
        f.r = Math.min(255, color.r + 40);
        f.g = Math.min(255, color.g + 30);
        f.b = Math.min(255, color.b + 20);

        this.hasActiveEffects = true;
    }

    /**
     * Set the list of currently active note glow positions.
     * @param {{ x: number, y: number, w: number, color: { r: number, g: number, b: number }, velocity: number }[]} list
     */
    setActiveGlows(list) {
        this.glows = list;
    }

    /**
     * Update physics. Call once per frame.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (dt > 0.1) dt = 0.1; // clamp for tab-switch protection

        let anyAlive = false;

        // Update particles
        for (let i = 0; i < POOL_SIZE; i++) {
            const p = this.particles[i];
            if (!p.alive) continue;

            p.life -= dt;
            if (p.life <= 0) {
                p.alive = false;
                continue;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += GRAVITY * dt;
            p.vx *= 0.98; // gentle drag
            anyAlive = true;
        }

        // Update flashes
        for (let i = 0; i < 20; i++) {
            const f = this.flashes[i];
            if (!f.alive) continue;

            f.life -= dt;
            if (f.life <= 0) {
                f.alive = false;
                continue;
            }
            anyAlive = true;
        }

        this.hasActiveEffects = anyAlive || this.glows.length > 0;
    }

    /**
     * Draw all effects onto a canvas context.
     * The context should already be scaled for DPR.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} canvasWidth - Logical width
     * @param {number} canvasHeight - Logical height
     */
    draw(ctx, canvasWidth, canvasHeight) {
        if (!this.hasActiveEffects) return;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.globalCompositeOperation = 'lighter';

        // 1. Draw glow columns (behind everything)
        this._drawGlows(ctx, canvasHeight);

        // 2. Draw flashes
        this._drawFlashes(ctx);

        // 3. Draw particles (on top)
        this._drawParticles(ctx);

        ctx.globalCompositeOperation = 'source-over';
    }

    _drawGlows(ctx, canvasHeight) {
        for (const g of this.glows) {
            const alpha = 0.08 + (g.velocity || 0.5) * 0.12; // 0.08 – 0.20
            const glowHeight = 50 + (g.velocity || 0.5) * 30;

            // Vertical glow column
            const grad = ctx.createLinearGradient(0, g.y - glowHeight, 0, g.y);
            grad.addColorStop(0, `rgba(${g.color.r}, ${g.color.g}, ${g.color.b}, 0)`);
            grad.addColorStop(0.7, `rgba(${g.color.r}, ${g.color.g}, ${g.color.b}, ${alpha * 0.4})`);
            grad.addColorStop(1, `rgba(${g.color.r}, ${g.color.g}, ${g.color.b}, ${alpha})`);
            ctx.fillStyle = grad;
            ctx.fillRect(g.x, g.y - glowHeight, g.w, glowHeight);

            // Horizontal glow at hit line
            const hGrad = ctx.createRadialGradient(
                g.x + g.w / 2, g.y, 0,
                g.x + g.w / 2, g.y, g.w * 1.5
            );
            hGrad.addColorStop(0, `rgba(${g.color.r}, ${g.color.g}, ${g.color.b}, ${alpha * 0.6})`);
            hGrad.addColorStop(1, `rgba(${g.color.r}, ${g.color.g}, ${g.color.b}, 0)`);
            ctx.fillStyle = hGrad;
            ctx.fillRect(g.x + g.w / 2 - g.w * 1.5, g.y - 6, g.w * 3, 12);
        }
    }

    _drawFlashes(ctx) {
        for (let i = 0; i < 20; i++) {
            const f = this.flashes[i];
            if (!f.alive) continue;

            const progress = 1 - f.life / f.maxLife; // 0 → 1
            const radius = f.width * (1 + easeOutCubic(progress) * 2.5);
            const alpha = (1 - easeOutQuad(progress)) * 0.7;

            if (alpha < 0.01) continue;

            // Radial flash
            const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
            grad.addColorStop(0, `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha})`);
            grad.addColorStop(0.3, `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha * 0.5})`);
            grad.addColorStop(1, `rgba(${f.r}, ${f.g}, ${f.b}, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(f.x - radius, f.y - radius, radius * 2, radius * 2);

            // Horizontal light streak
            const streakW = radius * 3;
            const streakH = 3;
            const sGrad = ctx.createLinearGradient(f.x - streakW / 2, 0, f.x + streakW / 2, 0);
            sGrad.addColorStop(0, `rgba(${f.r}, ${f.g}, ${f.b}, 0)`);
            sGrad.addColorStop(0.5, `rgba(${f.r}, ${f.g}, ${f.b}, ${alpha * 0.4})`);
            sGrad.addColorStop(1, `rgba(${f.r}, ${f.g}, ${f.b}, 0)`);
            ctx.fillStyle = sGrad;
            ctx.fillRect(f.x - streakW / 2, f.y - streakH / 2, streakW, streakH);
        }
    }

    _drawParticles(ctx) {
        for (let i = 0; i < POOL_SIZE; i++) {
            const p = this.particles[i];
            if (!p.alive) continue;

            const lifeRatio = p.life / p.maxLife;
            const alpha = easeOutQuad(lifeRatio) * p.startAlpha;

            if (alpha < 0.01) continue;

            if (p.type === 'spark') {
                // Star sparkle — 4-point cross
                const s = p.size * (0.5 + lifeRatio * 0.5);
                ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;

                // Horizontal bar
                ctx.fillRect(p.x - s * 1.5, p.y - s * 0.2, s * 3, s * 0.4);
                // Vertical bar
                ctx.fillRect(p.x - s * 0.2, p.y - s * 1.5, s * 0.4, s * 3);

                // Bright center
                ctx.beginPath();
                ctx.arc(p.x, p.y, s * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                ctx.fill();
            } else {
                // Soft dot with glow
                const s = p.size;
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 2);
                grad.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`);
                grad.addColorStop(0.5, `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha * 0.3})`);
                grad.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`);
                ctx.fillStyle = grad;
                ctx.fillRect(p.x - s * 2, p.y - s * 2, s * 4, s * 4);
            }
        }
    }

    /**
     * Returns true if there are any active effects to render.
     */
    get isActive() {
        return this.hasActiveEffects;
    }
}
