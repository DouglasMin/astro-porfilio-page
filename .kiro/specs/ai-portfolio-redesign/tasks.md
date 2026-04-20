# Implementation Plan: AI Portfolio Redesign

## Overview

This plan transforms the existing Astro 5.0 portfolio into an AI-themed experience. Tasks are ordered foundations-first: global CSS theming, then reusable canvas/animation components, then page-level updates, then the chatbot widget, and finally the blog migration and image pipeline. Each task builds on the previous steps and ends with integration wiring.

## Tasks

- [x] 1. Set up AI theme foundation in global CSS and install dependencies
  - [x] 1.1 Add `sharp` and `fast-check` as dependencies, add `tsx` as a dev dependency
    - Run `npm install sharp` and `npm install -D fast-check tsx`
    - _Requirements: 11.6_

  - [x] 1.2 Add AI gradient CSS custom properties and update theme variables in `src/styles/global.css`
    - Add `--color-ai-cyan: #06b6d4`, `--color-ai-blue: #3b82f6`, `--color-ai-purple: #8b5cf6`, `--color-ai-magenta: #ec4899`
    - Add glow utility variables: `--glow-sm`, `--glow-md`, `--glow-lg`
    - Update `--color-accent` to `#06b6d4` in `:root`
    - Update `[data-theme="dark"]` background to `#0a0a1a` and accent to `#06b6d4`
    - Add `@media (prefers-reduced-motion: reduce)` rule to disable all animations
    - _Requirements: 3.1, 3.6, 3.7, 10.4_

  - [x] 1.3 Add AI gradient section title utility class in `src/styles/global.css`
    - Create a `.section-title` global style with `background-clip: text` using the AI_Gradient
    - _Requirements: 3.2_

- [x] 2. Implement Neural Network background canvas component
  - [x] 2.1 Create `src/scripts/neural-network.ts` with the `initNeuralNetwork` function
    - Implement `NeuralNode` interface and `NeuralNetworkConfig` interface
    - Animate 30-60 nodes drifting with random velocities, bouncing off edges
    - Draw semi-transparent connecting lines between nodes within 150px distance (opacity inversely proportional to distance)
    - Dark mode: nodes with glow effect `shadowBlur: 10, shadowColor: rgba(6,182,212,0.6)`
    - Light mode: nodes at opacity 0.3, lines at opacity 0.1
    - Throttle to 30fps via `requestAnimationFrame` with frame timing
    - Pause when `document.hidden` is true
    - Reduce node count to max 20 when viewport < 768px
    - Expose `start()`, `stop()`, `updateTheme(isDark)`, `resize()` methods
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 2.2 Create `src/components/NeuralBackground.astro`
    - Render a `<canvas>` element spanning full width/height of the hero section
    - Include a `<script>` tag that imports and initializes `neural-network.ts`
    - Listen for theme toggle changes to call `updateTheme()`
    - Listen for window resize to call `resize()`
    - Fall back to a static CSS gradient if Canvas API is not supported
    - _Requirements: 1.1, 1.9_

  - [ ]* 2.3 Write property test for node connection distance (Property 1)
    - **Property 1: Node connection distance invariant**
    - Use fast-check to generate random (x1, y1, x2, y2) pairs within canvas bounds
    - Assert: a line is drawn if and only if Euclidean distance ≤ 150px
    - **Validates: Requirements 1.3**

- [x] 3. Implement Particle Background component for all pages
  - [x] 3.1 Create `src/scripts/particles.ts` with the `initParticles` function
    - Implement `Particle` interface and `ParticleConfig` interface
    - Animate 15-30 particles floating upward (speed 0.2-0.5 px/frame), wrapping to bottom
    - Dark mode: cyan particles at opacity 0.1-0.3
    - Light mode: blue particles at opacity 0.05-0.15
    - Reduce to ≤10 particles when viewport < 768px
    - Pause when tab is hidden (`document.hidden`)
    - Expose `start()`, `stop()`, `updateTheme(isDark)`, `resize()` methods
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 10.2_

  - [x] 3.2 Create `src/components/ParticleBackground.astro`
    - Render a fixed-position `<canvas>` with `pointer-events: none` and `z-index: 0`
    - Include a `<script>` tag that imports and initializes `particles.ts`
    - Listen for theme toggle changes and window resize
    - _Requirements: 8.1, 8.5_

  - [x] 3.3 Add `ParticleBackground` to `src/layouts/BaseLayout.astro`
    - Import and render `<ParticleBackground />` inside `<body>` before `<Navigation />`
    - _Requirements: 8.1_

- [x] 4. Implement Typewriter effect and redesign Hero Section
  - [x] 4.1 Create `src/scripts/typewriter.ts` with the `initTypewriter` function
    - Implement `TypewriterConfig` interface
    - Cycle through phrases: "Building with AI", "Full-Stack Developer", "Machine Learning Enthusiast"
    - Type at 50ms per character, delete at 30ms per character, pause 2000ms between phrases
    - Respect `prefers-reduced-motion` by showing static text instead
    - Expose `start()` and `stop()` methods
    - _Requirements: 2.1, 10.4_

  - [x] 4.2 Update `src/pages/index.astro` Hero Section
    - Remove the laptop/code-editor widget (`hero-visual` div and all laptop styles)
    - Add the typewriter element below the description and above the CTA buttons
    - Apply AI_Gradient as text gradient fill on "민동익" name
    - Add staggered fade-in animation with 200ms delay per element using CSS `animation-delay`
    - Add Glow_Effect on hover for CTA buttons using AI_Gradient colors
    - Import and initialize `typewriter.ts` in a client-side script
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.3 Write property test for staggered animation delay (Property 2)
    - **Property 2: Staggered animation delay formula**
    - Use fast-check to generate random element counts (1-20)
    - Assert: element at index i has animation-delay of exactly i × 200ms
    - **Validates: Requirements 2.4**

- [x] 5. Integrate Neural Background into Hero Section
  - [x] 5.1 Import and render `<NeuralBackground />` in `src/pages/index.astro` hero section
    - Position the canvas behind hero content using absolute positioning and z-index
    - Ensure hero content remains above the canvas
    - On mobile (<768px), hide the canvas and show a static AI_Gradient CSS background
    - _Requirements: 1.1, 10.1_

- [x] 6. Checkpoint
  - Ensure the site builds successfully with `npm run build`, verify no TypeScript errors. Ask the user if questions arise.

- [x] 7. Update Navigation component with AI theme
  - [x] 7.1 Update `src/components/Navigation.astro`
    - Change logo text from "Dongik's Portfolio" to "Douglas.AI"
    - Apply AI_Gradient as text gradient fill on the logo
    - In dark mode, replace the solid bottom border with an AI_Gradient glow border
    - Update the active link underline `::after` pseudo-element to use AI_Gradient colors
    - Maintain existing sticky positioning, backdrop blur, and theme toggle functionality
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 3.5_

- [x] 8. Update Skill Cards with animated gradient borders
  - [x] 8.1 Update the skills section in `src/pages/index.astro`
    - Add `@property --gradient-angle` declaration for animatable CSS custom property
    - Apply conic-gradient border cycling through AI_Gradient colors over 3 seconds using `background-clip` technique
    - On hover, increase box-shadow glow spread from 1px to 4px
    - Add a small AI-related icon (circuit/brain SVG) next to each skill category title
    - Maintain existing skillicons.dev images
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Update Project Cards with AI theme
  - [x] 9.1 Update project card styles in `src/pages/index.astro` and `src/pages/projects.astro`
    - Dark mode hover: apply AI_Gradient glow border effect
    - Light mode hover: standard box-shadow elevation without glow
    - Update tag styling to use semi-transparent AI_Gradient background instead of plain border
    - Add viewport-triggered fade-up animation using `IntersectionObserver`
    - Add "AI Project" badge with pulsing glow for cards tagged "AI" or "Machine Learning"
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 3.3, 3.4_

  - [ ]* 9.2 Write property test for AI Project badge conditional rendering (Property 4)
    - **Property 4: AI Project badge conditional rendering**
    - Use fast-check to generate random tag arrays with/without "AI"/"Machine Learning"
    - Assert: badge is displayed if and only if tags contain "AI" or "Machine Learning"
    - **Validates: Requirements 6.4**

- [x] 10. Update Experience Timeline with AI theme
  - [x] 10.1 Update timeline styles in `src/pages/experience.astro`
    - Replace the solid gradient timeline line with an animated dashed line pulsing with AI_Gradient colors
    - Replace circular timeline markers with diamond-shaped markers (rotated 45deg square) with Glow_Effect
    - On hover of a timeline entry, increase the corresponding marker's glow intensity
    - Maintain existing content structure (title, company, period, role, body)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. Checkpoint
  - Ensure the site builds successfully with `npm run build`, verify all visual components render. Ask the user if questions arise.

- [ ] 12. Implement AI Chatbot widget
  - [ ] 12.1 Create `src/scripts/chatbot.ts` with the `initChatbot` function
    - Implement `ChatMessage`, `ChatbotConfig`, and `FAQEntry` interfaces
    - Manage conversation state: store messages in memory, limit context to 10 most recent messages
    - Implement `sendMessage()`: POST to API endpoint, handle response, display in chat
    - Implement typing indicator animation while waiting for API response
    - Implement 10-second timeout with error message: "죄송합니다, 응답을 가져오는 데 문제가 발생했습니다. 다시 시도해 주세요."
    - Implement FAQ mode: match user input against predefined keyword patterns, return static responses for skills, projects, contact info
    - Expose `open()`, `close()`, `sendMessage()`, `getMessages()` methods
    - _Requirements: 5.4, 5.5, 5.6, 5.9, 5.10_

  - [ ] 12.2 Create FAQ data in `src/scripts/chatbot.ts` or a separate data file
    - Define FAQ entries with Korean keyword patterns for: skills/tech stack, projects, contact info, experience, education
    - _Requirements: 5.10_

  - [ ] 12.3 Create `src/components/ChatbotWidget.astro`
    - Render a floating action button in the bottom-right corner with `aria-label="AI 채팅 열기"`
    - On click, open a 380×500px chat panel with `role="dialog"` and `aria-label="AI 어시스턴트 채팅"`
    - Display initial greeting: "안녕하세요! 저는 Douglas의 AI 어시스턴트입니다. 프로젝트, 기술 스택, 경력에 대해 물어보세요!"
    - Style with AI_Gradient border glow in dark mode
    - Close on click outside or close button with slide-down animation
    - Ensure keyboard navigability (focus trap in dialog, Escape to close)
    - Import and initialize `chatbot.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.7, 5.8, 10.5, 10.6_

  - [ ] 12.4 Add `ChatbotWidget` to `src/layouts/BaseLayout.astro`
    - Import and render `<ChatbotWidget />` before the closing `</body>` tag
    - _Requirements: 5.1_

  - [ ]* 12.5 Write property test for chat context window limit (Property 3)
    - **Property 3: Chat context window limit**
    - Use fast-check to generate random message arrays (length 1-50)
    - Assert: for N > 10, exactly 10 most recent messages are sent; for N ≤ 10, all N messages are sent
    - **Validates: Requirements 5.9**

- [x] 13. Migrate blog to notion-astro-loader
  - [x] 13.1 Update `src/content/config.ts` to use `notionLoader` for the blog collection
    - Import `notionLoader` from `notion-astro-loader`
    - Configure with `auth: import.meta.env.NOTION_TOKEN`, `database_id: import.meta.env.NOTION_DATABASE_ID`
    - Add filter for `Published` checkbox equals true
    - Add sort by `Published Date` descending
    - Keep projects and experience collections unchanged
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 13.2 Update `src/pages/blog/index.astro` to use Astro content collections
    - Replace `getNotionBlogPosts()` import with `getCollection('blog')`
    - Map notion-astro-loader entry properties to the existing template variables
    - Maintain the same URL structure (`/blog`) and pagination
    - _Requirements: 12.6_

  - [x] 13.3 Update `src/pages/blog/[id].astro` to use Astro content collections
    - Replace `getNotionBlogPosts()` with `getCollection('blog')` in `getStaticPaths`
    - Use `entry.render()` for HTML output instead of manual `marked.parse()`
    - Maintain the same URL structure (`/blog/[id]`) using Notion page ID as slug
    - Preserve existing features: TOC, progress bar, code copy, mermaid support
    - _Requirements: 12.4, 12.6_

  - [x] 13.4 Update `src/pages/blog/page/[page].astro` if it exists for paginated blog pages
    - Apply the same collection-based approach as the blog index
    - _Requirements: 12.6_

  - [x] 13.5 Remove `src/lib/notion.ts` after migration is verified
    - Delete the file and remove any remaining imports
    - _Requirements: 12.5_

- [x] 14. Implement image optimization pipeline
  - [x] 14.1 Create `scripts/sync-notion-images.ts`
    - Query Notion database for published posts
    - Extract all image URLs from page blocks
    - Check `.image-cache.json` — skip if hash matches existing entry
    - Download images, resize with `sharp` to 720px max width (maintain aspect ratio), convert to WebP
    - Save to `public/images/blog/{pageId}/{filename}.webp`
    - Update `.image-cache.json` with new entries
    - Handle errors: log and skip failed images, continue with others
    - _Requirements: 11.2, 11.3, 11.4, 11.6, 11.7_

  - [ ]* 14.2 Write property test for image resize aspect ratio (Property 6)
    - **Property 6: Image resize preserves aspect ratio**
    - Use fast-check to generate random (W, H) dimensions (1-5000)
    - Assert: if W > 720, output is (720, round(H × 720 / W)); if W ≤ 720, output equals input
    - **Validates: Requirements 11.3**

  - [x] 14.3 Create a rehype plugin or post-processing step to replace Notion image URLs with local paths
    - During build, scan rendered HTML for Notion image URLs
    - Replace with corresponding local `/images/blog/{pageId}/{filename}.webp` paths from the cache
    - _Requirements: 11.5_

  - [ ]* 14.4 Write property test for URL replacement completeness (Property 7)
    - **Property 7: Notion image URL replacement completeness**
    - Use fast-check to generate random HTML strings with embedded Notion URLs and a matching URL map
    - Assert: output contains zero Notion URLs and exactly N local paths
    - **Validates: Requirements 11.5**

  - [ ]* 14.5 Write property test for image cache skip logic (Property 8)
    - **Property 8: Image cache skip for unchanged images**
    - Use fast-check to generate random cache states and image hashes
    - Assert: when hash matches, image is skipped and cache entry is unchanged
    - **Validates: Requirements 11.7**

- [x] 15. Update deploy script and package.json scripts
  - [x] 15.1 Update `package.json` scripts to include image sync in the build pipeline
    - Add `"sync:images": "tsx scripts/sync-notion-images.ts"`
    - Update `"build"` to `"npm run sync:images && astro check && astro build"`
    - The existing `"deploy"` script calls `npm run build` internally via `deploy-amplify.sh`
    - _Requirements: 11.1_

  - [x] 15.2 Add `.image-cache.json` to `.gitignore`
    - Prevent the cache file from being committed
    - _Requirements: 11.7_

- [ ] 16. Accessibility and reduced motion compliance
  - [ ] 16.1 Verify and enforce accessibility across all new components
    - Ensure all interactive elements (chatbot button, chat panel, theme toggle, nav links) are keyboard-navigable
    - Verify `prefers-reduced-motion` media query disables: canvas animations (neural network, particles), typewriter effect, animated gradient borders
    - Verify ARIA labels on chatbot: `aria-label="AI 채팅 열기"` on button, `role="dialog"` and `aria-label="AI 어시스턴트 채팅"` on panel
    - Verify text contrast ratio ≥ 4.5:1 for all AI theme colors against backgrounds in both modes
    - _Requirements: 10.3, 10.4, 10.5, 10.6_

  - [ ]* 16.2 Write property test for WCAG contrast ratio (Property 5)
    - **Property 5: WCAG contrast ratio compliance**
    - Enumerate all text/background color pairs from the AI theme CSS custom properties
    - Assert: each pair has a contrast ratio ≥ 4.5:1
    - **Validates: Requirements 10.3**

- [x] 17. Final checkpoint
  - Run `npm run build` to verify the full build pipeline (image sync → astro check → astro build) completes without errors. Ensure all tests pass. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all scripts and components use TypeScript
