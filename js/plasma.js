/**
 * ASCII Plasma Engine
 * Generates an animated sinusoidal interference pattern mapped to ASCII characters.
 * Tuned with a frame-rate governor for low CPU and battery usage on ambient displays.
 */
(function (global) {
  "use strict";

  const DEFAULT_OPTIONS = {
    characters: " .:-=+*#%@",
    characterHeight: 14,
    color: "#00aaff",
    backgroundColor: "#020508",
    fontFamily: '"Courier New", Courier, monospace',
    targetFps: 20, // 20 FPS cap (~50ms interval) to save battery on ambient displays
    timeSpeed: 0.0018
  };

  class AsciiPlasma {
    constructor(canvas, options = {}) {
      if (!canvas) {
        throw new Error("AsciiPlasma: Canvas element not provided.");
      }

      this.canvas = canvas;
      this.options = Object.assign({}, DEFAULT_OPTIONS, options);
      this.context = canvas.getContext("2d", { alpha: false });

      this.width = 0;
      this.height = 0;
      this.columns = 0;
      this.rows = 0;
      this.characterWidth = 8.5; // fallback until measured
      this.lastFrameTime = 0;
      this.frameInterval = 1000 / this.options.targetFps;
      this.animationFrameId = null;
      this.isRunning = false;

      this.handleResize = this.resize.bind(this);
      this.renderFrame = this.render.bind(this);

      this.init();
    }

    init() {
      window.addEventListener("resize", this.handleResize);
      this.resize();

      // Respect reduced motion accessibility setting
      const prefersReducedMotion =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        this.renderSingleFrame(0);
      } else {
        this.start();
      }
    }

    resize() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      this.width = window.innerWidth;
      this.height = window.innerHeight;

      this.canvas.width = Math.floor(this.width * pixelRatio);
      this.canvas.height = Math.floor(this.height * pixelRatio);

      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      this.context.font = `${this.options.characterHeight}px ${this.options.fontFamily}`;
      this.context.textBaseline = "top";

      // Dynamically measure monospace character width to prevent right-edge clipping
      const metrics = this.context.measureText("M");
      this.characterWidth = metrics.width || 8.5;

      this.columns = Math.ceil(this.width / this.characterWidth) + 1;
      this.rows = Math.ceil(this.height / this.options.characterHeight) + 1;

      // If animation is paused (e.g. reduced motion), repaint immediately on resize
      if (!this.isRunning) {
        this.renderSingleFrame(performance.now());
      }
    }

    calculateValue(x, y, time) {
      return (
        Math.sin(x / 7 + time) +
        Math.sin(y / 5 + time * 0.7) +
        Math.sin((x + y) / 10 + time * 1.3) +
        Math.sin(Math.sqrt(x * x + y * y) / 6 + time)
      );
    }

    getCharacter(value) {
      const normalizedValue = (value + 4) / 8;
      const chars = this.options.characters;
      const index = Math.max(
        0,
        Math.min(chars.length - 1, Math.floor(normalizedValue * chars.length))
      );
      return chars[index];
    }

    renderSingleFrame(timestamp) {
      const time = timestamp * this.options.timeSpeed;
      const ctx = this.context;
      const charH = this.options.characterHeight;

      ctx.fillStyle = this.options.backgroundColor;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = this.options.color;

      for (let y = 0; y < this.rows; y++) {
        let line = "";
        for (let x = 0; x < this.columns; x++) {
          const val = this.calculateValue(x, y, time);
          line += this.getCharacter(val);
        }
        ctx.fillText(line, 0, y * charH);
      }
    }

    render(timestamp) {
      if (!this.isRunning) return;

      // Frame rate throttling for battery and thermal efficiency
      if (timestamp - this.lastFrameTime >= this.frameInterval) {
        this.lastFrameTime = timestamp;
        this.renderSingleFrame(timestamp);
      }

      this.animationFrameId = requestAnimationFrame(this.renderFrame);
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.renderFrame);
    }

    stop() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    destroy() {
      this.stop();
      window.removeEventListener("resize", this.handleResize);
    }
  }

  // Export to global scope
  global.AsciiPlasma = AsciiPlasma;
})(window);

