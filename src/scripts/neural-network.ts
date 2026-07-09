export interface NeuralNode {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  layer: number;
  hue: 'cyan' | 'blue' | 'purple' | 'magenta';
  pulseOffset: number;
  phase: number;
}

export interface NeuralNetworkConfig {
  canvas: HTMLCanvasElement;
  nodeCount: number;
  connectionDistance: number;
  isDarkMode: boolean;
  colors: {
    cyan: string;
    blue: string;
    purple: string;
    magenta: string;
  };
}

interface SignalPulse {
  from: number;
  to: number;
  progress: number;
  speed: number;
  color: string;
}

interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

const MOBILE_BREAKPOINT = 768;
const MAX_MOBILE_NODES = 20;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const MAX_DPR = 2;
const HUES: NeuralNode['hue'][] = ['cyan', 'cyan', 'cyan', 'blue', 'purple', 'magenta'];

export function getEffectiveNodeCount(width: number, configuredNodeCount: number): number {
  if (width < MOBILE_BREAKPOINT) {
    return Math.min(configuredNodeCount, MAX_MOBILE_NODES);
  }
  return configuredNodeCount;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function createNodes(count: number, width: number, height: number): NeuralNode[] {
  const nodes: NeuralNode[] = [];
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < count; i++) {
    const layerRoll = Math.random();
    const layer = layerRoll > 0.78 ? 2 : layerRoll > 0.38 ? 1 : 0;
    const radius = layer === 2 ? randomBetween(2.6, 4.2) : layer === 1 ? randomBetween(2, 3.1) : randomBetween(1.2, 2);
    const opacity = layer === 2 ? randomBetween(0.52, 0.86) : layer === 1 ? randomBetween(0.34, 0.62) : randomBetween(0.18, 0.36);

    // Bias a few nodes away from the copy center so the hero text stays readable.
    const angle = Math.random() * Math.PI * 2;
    const centerAvoidance = Math.random() > 0.68 ? randomBetween(160, Math.max(width, height) * 0.36) : 0;
    const baseX = centerAvoidance
      ? centerX + Math.cos(angle) * centerAvoidance
      : Math.random() * width;
    const baseY = centerAvoidance
      ? centerY + Math.sin(angle) * centerAvoidance * 0.62
      : Math.random() * height;

    nodes.push({
      x: Math.max(0, Math.min(width, baseX)),
      y: Math.max(0, Math.min(height, baseY)),
      baseX: Math.max(0, Math.min(width, baseX)),
      baseY: Math.max(0, Math.min(height, baseY)),
      vx: randomBetween(-0.24, 0.24) * (0.65 + layer * 0.22),
      vy: randomBetween(-0.2, 0.2) * (0.65 + layer * 0.2),
      radius,
      opacity,
      layer,
      hue: HUES[Math.floor(Math.random() * HUES.length)],
      pulseOffset: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  return nodes;
}

export function initNeuralNetwork(config: NeuralNetworkConfig) {
  const { canvas, connectionDistance, colors } = config;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { start() {}, stop() {}, updateTheme(_isDark: boolean) {}, resize() {} };
  }

  let isDark = config.isDarkMode;
  let animationId: number | null = null;
  let lastFrameTime = 0;
  let lastPulseTime = 0;
  let running = false;
  let dpr = 1;
  let viewWidth = canvas.clientWidth || canvas.width;
  let viewHeight = canvas.clientHeight || canvas.height;
  const pointer: PointerState = { x: 0, y: 0, active: false };
  let nodes = createNodes(getEffectiveNodeCount(viewWidth, config.nodeCount), viewWidth, viewHeight);
  const pulses: SignalPulse[] = [];

  function resizeCanvasToParent() {
    const parent = canvas.parentElement;
    if (!parent) return;

    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    viewWidth = parent.clientWidth;
    viewHeight = parent.clientHeight;
    canvas.width = Math.max(1, Math.floor(viewWidth * dpr));
    canvas.height = Math.max(1, Math.floor(viewHeight * dpr));
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function distanceBetween(a: NeuralNode, b: NeuralNode): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointerInfluence(x: number, y: number, radius = 190): number {
    if (!pointer.active || viewWidth < MOBILE_BREAKPOINT) return 0;

    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > radius) return 0;

    return 1 - distance / radius;
  }

  function updateNodes(deltaSeconds: number, timestamp: number) {
    for (const node of nodes) {
      const layerSpeed = 0.35 + node.layer * 0.22;
      const driftX = Math.sin(timestamp * 0.00042 * layerSpeed + node.phase) * (9 + node.layer * 3);
      const driftY = Math.cos(timestamp * 0.00036 * layerSpeed + node.phase) * (7 + node.layer * 2.5);
      const influence = pointerInfluence(node.x, node.y);
      let repelX = 0;
      let repelY = 0;

      if (influence > 0) {
        const dx = node.x - pointer.x || 1;
        const dy = node.y - pointer.y || 1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        repelX = (dx / distance) * influence * (18 + node.layer * 8);
        repelY = (dy / distance) * influence * (18 + node.layer * 8);
      }

      node.baseX += node.vx * deltaSeconds * 28;
      node.baseY += node.vy * deltaSeconds * 28;

      if (node.baseX < -20 || node.baseX > viewWidth + 20) node.vx *= -1;
      if (node.baseY < -20 || node.baseY > viewHeight + 20) node.vy *= -1;

      node.baseX = Math.max(-20, Math.min(viewWidth + 20, node.baseX));
      node.baseY = Math.max(-20, Math.min(viewHeight + 20, node.baseY));
      node.x += (node.baseX + driftX + repelX - node.x) * 0.035;
      node.y += (node.baseY + driftY + repelY - node.y) * 0.035;
    }
  }

  function drawGlowField() {
    const centerGlow = ctx!.createRadialGradient(
      viewWidth * 0.5,
      viewHeight * 0.48,
      0,
      viewWidth * 0.5,
      viewHeight * 0.48,
      Math.max(viewWidth, viewHeight) * 0.52,
    );
    centerGlow.addColorStop(0, isDark ? rgba(colors.cyan, 0.16) : rgba(colors.cyan, 0.08));
    centerGlow.addColorStop(0.42, isDark ? rgba(colors.blue, 0.075) : rgba(colors.blue, 0.045));
    centerGlow.addColorStop(1, rgba(colors.purple, 0));
    ctx!.fillStyle = centerGlow;
    ctx!.fillRect(0, 0, viewWidth, viewHeight);

    const sideGlow = ctx!.createRadialGradient(viewWidth * 0.82, viewHeight * 0.24, 0, viewWidth * 0.82, viewHeight * 0.24, viewWidth * 0.42);
    sideGlow.addColorStop(0, isDark ? rgba(colors.magenta, 0.08) : rgba(colors.magenta, 0.035));
    sideGlow.addColorStop(1, rgba(colors.magenta, 0));
    ctx!.fillStyle = sideGlow;
    ctx!.fillRect(0, 0, viewWidth, viewHeight);
  }

  function drawConnections() {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const from = nodes[i];
        const to = nodes[j];
        const dist = distanceBetween(from, to);

        if (dist <= connectionDistance) {
          const baseOpacity = 1 - dist / connectionDistance;
          const layerWeight = 0.36 + (from.layer + to.layer) * 0.13;
          const hoverBoost = Math.max(pointerInfluence(from.x, from.y), pointerInfluence(to.x, to.y)) * 0.26;
          const opacity = isDark
            ? baseOpacity * layerWeight * 0.64 + hoverBoost
            : baseOpacity * layerWeight * 0.18 + hoverBoost * 0.3;
          const gradient = ctx!.createLinearGradient(from.x, from.y, to.x, to.y);

          gradient.addColorStop(0, rgba(colors[from.hue], opacity * 0.18));
          gradient.addColorStop(0.5, rgba(colors.cyan, opacity));
          gradient.addColorStop(1, rgba(colors[to.hue], opacity * 0.18));

          ctx!.beginPath();
          ctx!.moveTo(from.x, from.y);
          ctx!.lineTo(to.x, to.y);
          ctx!.strokeStyle = gradient;
          ctx!.lineWidth = Math.max(0.7, 0.85 + baseOpacity * 0.55);
          ctx!.stroke();
          ctx!.closePath();
        }
      }
    }
  }

  function findConnectionPair(): { from: number; to: number } | null {
    for (let attempt = 0; attempt < 18; attempt++) {
      const from = Math.floor(Math.random() * nodes.length);
      const to = Math.floor(Math.random() * nodes.length);

      if (from !== to && distanceBetween(nodes[from], nodes[to]) < connectionDistance * 0.92) {
        return { from, to };
      }
    }

    return null;
  }

  function spawnPulse(timestamp: number) {
    const maxPulses = viewWidth < MOBILE_BREAKPOINT ? 3 : 7;
    if (pulses.length >= maxPulses || timestamp - lastPulseTime < 420) return;

    const pair = findConnectionPair();
    if (!pair) return;

    lastPulseTime = timestamp;
    pulses.push({
      ...pair,
      progress: 0,
      speed: randomBetween(0.006, 0.012),
      color: Math.random() > 0.72 ? colors.magenta : colors.cyan,
    });
  }

  function updateAndDrawPulses(deltaSeconds: number, timestamp: number) {
    spawnPulse(timestamp);

    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i];
      const from = nodes[pulse.from];
      const to = nodes[pulse.to];

      if (!from || !to) {
        pulses.splice(i, 1);
        continue;
      }

      pulse.progress += pulse.speed * deltaSeconds * 60;
      if (pulse.progress >= 1) {
        pulses.splice(i, 1);
        continue;
      }

      const x = from.x + (to.x - from.x) * pulse.progress;
      const y = from.y + (to.y - from.y) * pulse.progress;
      const tailProgress = Math.max(0, pulse.progress - 0.12);
      const tailX = from.x + (to.x - from.x) * tailProgress;
      const tailY = from.y + (to.y - from.y) * tailProgress;
      const opacity = Math.sin(pulse.progress * Math.PI);

      ctx!.save();
      ctx!.shadowBlur = isDark ? 18 : 8;
      ctx!.shadowColor = rgba(pulse.color, isDark ? 0.7 : 0.35);
      ctx!.beginPath();
      ctx!.moveTo(tailX, tailY);
      ctx!.lineTo(x, y);
      ctx!.strokeStyle = rgba(pulse.color, (isDark ? 0.72 : 0.36) * opacity);
      ctx!.lineWidth = isDark ? 2.1 : 1.4;
      ctx!.lineCap = 'round';
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(x, y, isDark ? 2.3 : 1.8, 0, Math.PI * 2);
      ctx!.fillStyle = rgba(pulse.color, (isDark ? 0.9 : 0.48) * opacity);
      ctx!.fill();
      ctx!.restore();
    }
  }

  function drawNodes(timestamp: number) {
    for (const node of nodes) {
      const pulse = 0.5 + Math.sin(timestamp * 0.0015 + node.pulseOffset) * 0.5;
      const influence = pointerInfluence(node.x, node.y);
      const alpha = Math.min(1, node.opacity + pulse * 0.08 + influence * 0.32);
      const radius = node.radius + pulse * 0.45 + influence * 1.2;

      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(node.x, node.y, radius, 0, Math.PI * 2);

      if (isDark) {
        ctx!.shadowBlur = 10 + node.layer * 7 + influence * 14;
        ctx!.shadowColor = rgba(colors[node.hue], 0.66);
        ctx!.fillStyle = rgba(colors[node.hue], alpha);
      } else {
        ctx!.shadowBlur = influence ? 8 : 0;
        ctx!.shadowColor = rgba(colors[node.hue], 0.2);
        ctx!.fillStyle = rgba(colors[node.hue], alpha * 0.42);
      }

      ctx!.fill();
      ctx!.restore();
    }
  }

  function render(timestamp: number) {
    if (!running) return;

    if (document.hidden) {
      animationId = requestAnimationFrame(render);
      return;
    }

    const elapsed = timestamp - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) {
      animationId = requestAnimationFrame(render);
      return;
    }

    const deltaSeconds = Math.min(0.05, elapsed / 1000);
    lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);

    ctx!.clearRect(0, 0, viewWidth, viewHeight);
    updateNodes(deltaSeconds, timestamp);
    drawGlowField();
    drawConnections();
    updateAndDrawPulses(deltaSeconds, timestamp);
    drawNodes(timestamp);

    animationId = requestAnimationFrame(render);
  }

  function handlePointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const insideCanvas =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!insideCanvas) {
      pointer.active = false;
      return;
    }

    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  }

  function handlePointerLeave() {
    pointer.active = false;
  }

  function start() {
    if (running) return;
    running = true;
    resizeCanvasToParent();
    nodes = createNodes(getEffectiveNodeCount(viewWidth, config.nodeCount), viewWidth, viewHeight);
    pulses.length = 0;
    lastPulseTime = performance.now();
    lastFrameTime = performance.now();
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerleave', handlePointerLeave);
    animationId = requestAnimationFrame(render);
  }

  function stop() {
    running = false;
    pointer.active = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerleave', handlePointerLeave);

    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function updateTheme(newIsDark: boolean) {
    isDark = newIsDark;
  }

  function resize() {
    resizeCanvasToParent();
    nodes = createNodes(getEffectiveNodeCount(viewWidth, config.nodeCount), viewWidth, viewHeight);
    pulses.length = 0;
  }

  return { start, stop, updateTheme, resize };
}
