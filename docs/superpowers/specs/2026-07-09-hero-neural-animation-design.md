# Hero Neural Animation Design

## Goal

Improve the main-page hero AI animation using the selected Option A direction, but make it more polished than the quick visual companion mockup.

## Selected Direction

Use a refined neural mesh behind the centered Korean hero copy. Preserve the current homepage identity, gradient name treatment, typewriter area, and CTA layout. The animation should feel more premium through depth, signal motion, and subtle interaction rather than by adding new hero text or changing the page structure.

## Visual Behavior

- Keep the canvas-based neural network as the base metaphor.
- Add layered depth: faint background nodes, primary foreground nodes, and occasional signal pulses moving along connections.
- Add a soft radial glow field behind the hero content so the animation frames the text without reducing readability.
- Add pointer influence on desktop: nearby nodes should gently lean away from the cursor and connections should brighten subtly.
- Use the existing cyan, blue, purple, and magenta palette; cyan remains dominant and magenta appears only as accent pulses.
- Avoid heavy decorative blobs, badges, or new hero labels.

## Performance And Accessibility

- Keep animation requestAnimationFrame based and throttled.
- Respect `prefers-reduced-motion` by using the existing no-canvas fallback.
- Keep mobile lighter than desktop by reducing node count and interaction cost.
- Resize cleanly without stretched or blurry canvas rendering.

## Implementation Boundaries

- Modify `src/scripts/neural-network.ts` for animation behavior.
- Modify `src/components/NeuralBackground.astro` only for configuration or fallback presentation.
- Do not change hero copy, navigation, project cards, or section order.
- Do not add runtime dependencies.

## Acceptance Criteria

- The main page loads with no framework overlay or console errors.
- Desktop hero shows a richer layered neural field with animated connection pulses and a readable text center.
- Pointer movement subtly affects the mesh on desktop.
- Mobile and reduced-motion paths remain lightweight.
- Build succeeds.
