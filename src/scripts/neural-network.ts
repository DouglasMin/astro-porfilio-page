export interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
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

const MOBILE_BREAKPOINT = 768;
const MAX_MOBILE_NODES = 20;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

function createNodes(count: number, width: number, height: number): NeuralNode[] {
  const nodes: NeuralNode[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 1.0,   // -0.5 to 0.5
      vy: (Math.random() - 0.5) * 1.0,   // -0.5 to 0.5
      radius: 2 + Math.random() * 2,      // 2-4px
      opacity: 0.3 + Math.random() * 0.5, // 0.3-0.8
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
  let running = false;

  // Determine effective node count based on viewport
  function getEffectiveNodeCount(): number {
    if (canvas.width < MOBILE_BREAKPOINT) {
      return Math.min(config.nodeCount, MAX_MOBILE_NODES);
    }
    return config.nodeCount;
  }

  let nodes = createNodes(getEffectiveNodeCount(), canvas.width, canvas.height);

  function updateNodes() {
    const w = canvas.width;
    const h = canvas.height;
    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;

      // Bounce off edges
      if (node.x <= 0 || node.x >= w) {
        node.vx *= -1;
        node.x = Math.max(0, Math.min(w, node.x));
      }
      if (node.y <= 0 || node.y >= h) {
        node.vy *= -1;
        node.y = Math.max(0, Math.min(h, node.y));
      }
    }
  }

  function drawNodes() {
    for (const node of nodes) {
      ctx!.beginPath();
      ctx!.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      if (isDark) {
        ctx!.shadowBlur = 10;
        ctx!.shadowColor = 'rgba(6,182,212,0.6)';
        ctx!.fillStyle = `rgba(6,182,212,${node.opacity})`;
      } else {
        ctx!.shadowBlur = 0;
        ctx!.shadowColor = 'transparent';
        ctx!.fillStyle = `rgba(6,182,212,0.3)`;
      }

      ctx!.fill();
      ctx!.closePath();
    }
    // Reset shadow after drawing nodes
    ctx!.shadowBlur = 0;
    ctx!.shadowColor = 'transparent';
  }

  function drawConnections() {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= connectionDistance) {
          // Opacity inversely proportional to distance
          const baseOpacity = 1 - dist / connectionDistance;
          const lineOpacity = isDark ? baseOpacity * 0.5 : 0.1 * baseOpacity;

          ctx!.beginPath();
          ctx!.moveTo(nodes[i].x, nodes[i].y);
          ctx!.lineTo(nodes[j].x, nodes[j].y);
          ctx!.strokeStyle = isDark
            ? `rgba(6,182,212,${lineOpacity})`
            : `rgba(59,130,246,${lineOpacity})`;
          ctx!.lineWidth = 1;
          ctx!.stroke();
          ctx!.closePath();
        }
      }
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
    updateNodes();
    drawConnections();
    drawNodes();

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
    }
    // Recreate nodes with appropriate count for new size
    nodes = createNodes(getEffectiveNodeCount(), canvas.width, canvas.height);
  }

  return { start, stop, updateTheme, resize };
}
