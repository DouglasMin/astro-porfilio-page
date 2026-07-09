# Hero Neural Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the homepage hero AI canvas from a uniform node network into a layered, pointer-aware neural mesh with signal pulses and stronger visual polish.

**Architecture:** Keep the existing Astro component boundary. `NeuralBackground.astro` owns canvas setup/configuration and fallback styling; `src/scripts/neural-network.ts` owns simulation, rendering, pointer state, theme updates, resize, start, and stop.

**Tech Stack:** Astro 5, TypeScript, Canvas 2D, CSS fallback gradients, npm scripts.

---

### Task 1: Define Richer Neural State

**Files:**
- Modify: `src/scripts/neural-network.ts`

- [ ] **Step 1: Extend `NeuralNode`**

Add stable per-node metadata:

```ts
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
}
```

- [ ] **Step 2: Add pulse and pointer state**

Add `SignalPulse` and pointer state near the interfaces:

```ts
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
```

- [ ] **Step 3: Run type check**

Run: `npx astro check`
Expected: Type errors until node creation/rendering is updated in Task 2.

### Task 2: Implement Layered Simulation And Rendering

**Files:**
- Modify: `src/scripts/neural-network.ts`

- [ ] **Step 1: Replace uniform node creation**

Update `createNodes` so each node has base position, layer, hue, radius, opacity, and slower movement for background layers.

- [ ] **Step 2: Add pointer-aware motion**

Update `updateNodes` so nodes drift around their base position, bounce softly, and lean away from the pointer when active.

- [ ] **Step 3: Add background glow rendering**

Before connections, draw subtle radial gradients in dark and light mode using existing palette colors.

- [ ] **Step 4: Upgrade connection rendering**

Draw connections with layer-aware opacity, cyan/blue gradients, and pointer proximity brightening.

- [ ] **Step 5: Add signal pulse rendering**

Create and recycle a small number of pulses that travel between nearby node pairs. Draw them as short luminous strokes and small moving points.

- [ ] **Step 6: Upgrade node rendering**

Draw nodes with layer-aware size, glow, and color. Keep light mode restrained so it does not overpower black text.

### Task 3: Wire Pointer Lifecycle And Resize

**Files:**
- Modify: `src/scripts/neural-network.ts`
- Modify: `src/components/NeuralBackground.astro`

- [ ] **Step 1: Register pointer listeners in `start`**

Listen on the canvas for `pointermove` and `pointerleave`. Convert client coordinates into canvas coordinates.

- [ ] **Step 2: Remove pointer listeners in `stop`**

Remove all listeners so Astro page transitions cannot leak work.

- [ ] **Step 3: Preserve configuration from Astro**

Keep `nodeCount`, `connectionDistance`, and colors in `NeuralBackground.astro`, adjusting only values needed for the richer field.

- [ ] **Step 4: Improve fallback gradient**

Make `.neural-fallback` visually closer to the upgraded mesh by adding layered radial gradients, while keeping it static.

### Task 4: Verify Rendered UI

**Files:**
- Verify: `src/pages/index.astro`
- Verify: `src/components/NeuralBackground.astro`
- Verify: `src/scripts/neural-network.ts`

- [ ] **Step 1: Run build checks**

Run: `npm run build`
Expected: Astro check and build pass.

- [ ] **Step 2: Start local dev server**

Run: `npm run dev -- --host 127.0.0.1`
Expected: local Astro dev server URL is printed.

- [ ] **Step 3: Capture desktop screenshot**

Use Browser plugin if available; otherwise use Playwright fallback. Check homepage first viewport at desktop width.

- [ ] **Step 4: Capture mobile screenshot**

Use Browser plugin if available; otherwise use Playwright fallback. Check homepage first viewport at mobile width.

- [ ] **Step 5: Interaction proof**

Move pointer over the hero in the browser automation path and verify the page remains error-free and visibly nonblank.

- [ ] **Step 6: Compare visual target**

Use `view_image` on the selected Option A companion reference and latest implementation screenshot. Confirm the final render is more polished than the quick mockup while preserving the selected direction.
