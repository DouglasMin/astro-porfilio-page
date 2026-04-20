export interface Particle {
  x: number;
  y: number;
  speed: number;   // 0.2-0.5 px/frame upward
  size: number;    // 1-3px
  opacity: number; // varies by theme
}

export interface ParticleConfig {
  canvas: HTMLCanvasElement;
  particleCount: number;  // 15-30 desktop, ≤10 mobile
  isDarkMode: boolean;
}

const MOBILE_BREAKPOINT = 768;
const MAX_MOBILE_PARTICLES = 10;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

function createParticles(count: number, width: number, height: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 0.2 + Math.random() * 0.3,       // 0.2-0.5 px/frame
      size: 1 + Math.random() * 2,             // 1-3px
      opacity: 0.1 + Math.random() * 0.2,      // base opacity, adjusted per theme in draw
    });
  }
  return particles;
}

export function initParticles(config: ParticleConfig) {
  const { canvas } = config;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { start() {}, stop() {}, updateTheme(_isDark: boolean) {}, resize() {} };
  }

  let isDark = config.isDarkMode;
  let animationId: number | null = null;
  let lastFrameTime = 0;
  let running = false;

  function getEffectiveParticleCount(): number {
    if (canvas.width < MOBILE_BREAKPOINT) {
      return Math.min(config.particleCount, MAX_MOBILE_PARTICLES);
    }
    return config.particleCount;
  }

  let particles = createParticles(getEffectiveParticleCount(), canvas.width, canvas.height);

  function updateParticles() {
    const h = canvas.height;
    for (const p of particles) {
      // Float upward
      p.y -= p.speed;

      // Wrap to bottom when exiting top
      if (p.y < -p.size) {
        p.y = h + p.size;
        p.x = Math.random() * canvas.width;
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);

      if (isDark) {
        // Dark mode: cyan particles at opacity 0.1-0.3
        const opacity = 0.1 + p.opacity * 0.67; // maps base 0.1-0.3 to ~0.17-0.3
        ctx!.fillStyle = `rgba(6, 182, 212, ${opacity})`;
      } else {
        // Light mode: blue particles at opacity 0.05-0.15
        const opacity = 0.05 + p.opacity * 0.33; // maps base 0.1-0.3 to ~0.08-0.15
        ctx!.fillStyle = `rgba(59, 130, 246, ${opacity})`;
      }

      ctx!.fill();
      ctx!.closePath();
    }
  }

  function render(timestamp: number) {
    if (!running) return;

    // Pause when tab is hidden
    if (document.hidden) {
      animationId = requestAnimationFrame(render);
      return;
    }

    // Throttle to ~30fps
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) {
      animationId = requestAnimationFrame(render);
      return;
    }
    lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);

    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    updateParticles();
    drawParticles();

    animationId = requestAnimationFrame(render);
  }

  function start() {
    if (running) return;
    running = true;
    lastFrameTime = performance.now();
    animationId = requestAnimationFrame(render);
  }

  function stop() {
    running = false;
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function updateTheme(newIsDark: boolean) {
    isDark = newIsDark;
  }

  function resize() {
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    } else {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    // Recreate particles with appropriate count for new size
    particles = createParticles(getEffectiveParticleCount(), canvas.width, canvas.height);
  }

  return { start, stop, updateTheme, resize };
}
