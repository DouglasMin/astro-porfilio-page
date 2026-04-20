# Requirements Document

## Introduction

This feature transforms Dongik Min's (Douglas) existing personal developer portfolio into an AI-themed portfolio. The redesign introduces AI-inspired visual design elements (neural network patterns, particle animations, glowing node effects), an interactive AI chatbot for visitor engagement, and restructured content that highlights AI/ML capabilities. The site retains its Astro 5.0 static-site architecture, Notion-powered blog, light/dark theme toggle, and AWS Amplify deployment while layering on a cohesive AI aesthetic and new interactive functionality.

## Glossary

- **Portfolio_Site**: The Astro 5.0 static portfolio website for Dongik Min (Douglas), deployed to AWS Amplify
- **Neural_Background**: A full-viewport animated canvas element that renders interconnected nodes and edges resembling a neural network graph
- **AI_Chatbot**: A client-side chat widget that uses a large language model API to answer visitor questions about the portfolio owner's skills, projects, and experience
- **Particle_System**: A lightweight canvas-based animation that renders floating particles with subtle connecting lines, used as ambient background decoration
- **Hero_Section**: The primary landing area of the home page containing the headline, description, and call-to-action buttons
- **Code_Editor_Widget**: The animated code editor visual currently displayed in the hero section
- **Theme_Toggle**: The existing light/dark mode switch in the navigation header
- **Visitor**: Any person viewing the portfolio website in a browser
- **Content_Collection**: Astro's file-based content system used to manage projects, blog posts, and experience entries
- **Skill_Card**: A UI card component displaying a skill category with associated technologies
- **Project_Card**: A UI card component displaying a portfolio project with image, description, and tags
- **Timeline_Component**: The vertical timeline UI used on the experience and about pages
- **AI_Gradient**: A color gradient palette using cyan (#06b6d4), electric blue (#3b82f6), purple (#8b5cf6), and magenta (#ec4899) to evoke an AI/tech aesthetic
- **Glow_Effect**: A CSS box-shadow or text-shadow using semi-transparent accent colors to create a neon-like luminous appearance
- **Typewriter_Effect**: A text animation that reveals characters sequentially, simulating real-time typing

## Requirements

### Requirement 1: AI-Themed Neural Network Background Animation

**User Story:** As a Visitor, I want to see an animated neural network pattern in the background of the hero section, so that the site immediately communicates an AI-focused identity.

#### Acceptance Criteria

1. WHEN the home page loads, THE Neural_Background SHALL render an HTML canvas element spanning the full width and height of the Hero_Section
2. THE Neural_Background SHALL animate a minimum of 30 and a maximum of 60 nodes that drift slowly across the canvas
3. WHEN two nodes are within 150 pixels of each other, THE Neural_Background SHALL draw a semi-transparent connecting line between the two nodes
4. THE Neural_Background SHALL use colors from the AI_Gradient palette for nodes and connecting lines
5. WHILE the Theme_Toggle is set to dark mode, THE Neural_Background SHALL render nodes with a Glow_Effect using rgba(6, 182, 212, 0.6)
6. WHILE the Theme_Toggle is set to light mode, THE Neural_Background SHALL render nodes with reduced opacity (0.3) and connecting lines with opacity 0.1
7. THE Neural_Background SHALL maintain a frame rate of 30 frames per second or higher on devices with a screen width of 1024 pixels or greater
8. WHEN the viewport width is less than 768 pixels, THE Neural_Background SHALL reduce the node count to a maximum of 20 nodes
9. IF the Visitor's browser does not support the HTML Canvas API, THEN THE Neural_Background SHALL degrade gracefully by displaying a static CSS gradient background using the AI_Gradient colors

### Requirement 2: AI-Styled Hero Section Redesign

**User Story:** As a Visitor, I want the hero section to feature AI-themed visuals and animations, so that the portfolio feels modern and technology-forward.

#### Acceptance Criteria

1. THE Hero_Section SHALL replace the current Code_Editor_Widget with a Typewriter_Effect that cycles through AI-related phrases: "Building with AI", "Full-Stack Developer", "Machine Learning Enthusiast"
2. THE Hero_Section SHALL display the owner's name "민동익" using the AI_Gradient as a text gradient fill
3. THE Hero_Section SHALL render call-to-action buttons with a Glow_Effect on hover using the AI_Gradient colors
4. WHEN the home page loads, THE Hero_Section SHALL animate content elements with a staggered fade-in, where each element appears 200 milliseconds after the previous element
5. THE Hero_Section SHALL position the Typewriter_Effect text below the main description and above the call-to-action buttons

### Requirement 3: AI Color Palette and Glow Effects Across All Pages

**User Story:** As a Visitor, I want the entire site to use a cohesive AI-inspired color scheme, so that every page feels part of the same AI-themed experience.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL define the AI_Gradient colors as CSS custom properties: --color-ai-cyan (#06b6d4), --color-ai-blue (#3b82f6), --color-ai-purple (#8b5cf6), --color-ai-magenta (#ec4899)
2. THE Portfolio_Site SHALL apply the AI_Gradient to all section titles as a background-clip text gradient
3. WHILE the Theme_Toggle is set to dark mode, THE Portfolio_Site SHALL apply a subtle Glow_Effect (0 0 20px rgba(6, 182, 212, 0.15)) to all card components on hover
4. WHILE the Theme_Toggle is set to light mode, THE Portfolio_Site SHALL apply a standard box-shadow elevation to card components on hover without the Glow_Effect
5. THE Portfolio_Site SHALL update the navigation logo gradient to use the AI_Gradient colors
6. THE Portfolio_Site SHALL update the dark mode background color to #0a0a1a to provide deeper contrast for glow effects
7. THE Portfolio_Site SHALL update the accent color CSS custom property (--color-accent) to use --color-ai-cyan (#06b6d4) as the primary accent

### Requirement 4: AI-Themed Skill Cards with Animated Borders

**User Story:** As a Visitor, I want the skill cards to have animated glowing borders, so that the technology stack presentation feels dynamic and AI-inspired.

#### Acceptance Criteria

1. THE Skill_Card SHALL display an animated border that cycles through the AI_Gradient colors over a 3-second loop
2. WHEN a Visitor hovers over a Skill_Card, THE Skill_Card SHALL increase the border glow intensity by changing the box-shadow spread from 1px to 4px
3. THE Skill_Card SHALL display a small AI-related icon (such as a circuit or brain icon) next to each skill category title
4. THE Skill_Card SHALL maintain the existing skill icon images from skillicons.dev

### Requirement 5: Interactive AI Chatbot Widget

**User Story:** As a Visitor, I want to interact with an AI chatbot on the portfolio site, so that I can ask questions about the portfolio owner's skills and experience in a conversational way.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL render a floating action button in the bottom-right corner of every page
2. WHEN a Visitor clicks the floating action button, THE AI_Chatbot SHALL open a chat panel with a width of 380 pixels and a height of 500 pixels
3. THE AI_Chatbot SHALL display an initial greeting message: "안녕하세요! 저는 Douglas의 AI 어시스턴트입니다. 프로젝트, 기술 스택, 경력에 대해 물어보세요!"
4. WHEN a Visitor submits a message, THE AI_Chatbot SHALL send the message to a configured large language model API endpoint and display the response within the chat panel
5. WHILE the AI_Chatbot is waiting for an API response, THE AI_Chatbot SHALL display a typing indicator animation
6. IF the API request fails or times out after 10 seconds, THEN THE AI_Chatbot SHALL display the message: "죄송합니다, 응답을 가져오는 데 문제가 발생했습니다. 다시 시도해 주세요."
7. THE AI_Chatbot SHALL style the chat panel using the AI_Gradient colors and apply a Glow_Effect to the chat panel border in dark mode
8. WHEN the Visitor clicks outside the chat panel or clicks a close button, THE AI_Chatbot SHALL close the chat panel with a slide-down animation
9. THE AI_Chatbot SHALL limit the conversation context to the most recent 10 messages to manage API token usage
10. IF no API key is configured, THEN THE AI_Chatbot SHALL operate in a static FAQ mode, responding to predefined questions about skills, projects, and contact information

### Requirement 6: AI-Themed Project Cards

**User Story:** As a Visitor, I want project cards to have an AI-inspired visual treatment, so that the portfolio projects feel cohesive with the overall AI theme.

#### Acceptance Criteria

1. WHEN a Visitor hovers over a Project_Card, THE Project_Card SHALL display a Glow_Effect border using the AI_Gradient colors in dark mode
2. THE Project_Card SHALL display project tags with a semi-transparent AI_Gradient background instead of the current plain border style
3. THE Project_Card SHALL animate into view with a fade-up animation when the card enters the viewport during scrolling
4. WHEN a Project_Card contains the tag "AI" or "Machine Learning", THE Project_Card SHALL display a special "AI Project" badge with a pulsing Glow_Effect

### Requirement 7: AI-Themed Experience Timeline

**User Story:** As a Visitor, I want the experience timeline to use AI-inspired visual elements, so that the career history presentation matches the overall site aesthetic.

#### Acceptance Criteria

1. THE Timeline_Component SHALL replace the current solid gradient timeline line with an animated dashed line that pulses with the AI_Gradient colors
2. THE Timeline_Component SHALL replace the current circular timeline markers with diamond-shaped markers that have a Glow_Effect
3. WHEN a Visitor hovers over a timeline entry, THE Timeline_Component SHALL highlight the corresponding timeline marker with an increased Glow_Effect intensity
4. THE Timeline_Component SHALL maintain the existing content structure including title, company, period, role, and body content

### Requirement 8: Ambient Particle Background on All Pages

**User Story:** As a Visitor, I want subtle particle animations across all pages, so that the entire site maintains a consistent AI atmosphere.

#### Acceptance Criteria

1. THE Particle_System SHALL render a canvas element fixed to the viewport background on all pages
2. THE Particle_System SHALL animate between 15 and 30 particles that float upward at a speed of 0.2 to 0.5 pixels per frame
3. WHILE the Theme_Toggle is set to dark mode, THE Particle_System SHALL render particles with opacity between 0.1 and 0.3 using the --color-ai-cyan color
4. WHILE the Theme_Toggle is set to light mode, THE Particle_System SHALL render particles with opacity between 0.05 and 0.15 using the --color-ai-blue color
5. THE Particle_System SHALL not interfere with page content interaction by setting pointer-events to none on the canvas element
6. THE Particle_System SHALL pause animation when the browser tab is not visible to conserve resources

### Requirement 9: AI-Themed Navigation Header

**User Story:** As a Visitor, I want the navigation to reflect the AI theme, so that the site identity is consistent from the first element the Visitor sees.

#### Acceptance Criteria

1. THE Navigation SHALL update the logo text to "Douglas.AI" using the AI_Gradient as a text gradient fill
2. WHILE the Theme_Toggle is set to dark mode, THE Navigation SHALL apply a bottom border with a subtle AI_Gradient glow instead of the current solid border
3. THE Navigation SHALL update the active link underline animation to use the AI_Gradient colors
4. THE Navigation SHALL maintain the existing sticky positioning, backdrop blur, and theme toggle functionality

### Requirement 10: Responsive and Accessible AI Theme

**User Story:** As a Visitor, I want the AI-themed design to work on all devices and remain accessible, so that the experience is inclusive regardless of device or ability.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768 pixels, THE Portfolio_Site SHALL disable the Neural_Background canvas and display a static AI_Gradient background instead
2. WHEN the viewport width is less than 768 pixels, THE Particle_System SHALL reduce particle count to 10 or fewer
3. THE Portfolio_Site SHALL ensure all text content maintains a contrast ratio of 4.5:1 or higher against background colors in both light and dark modes
4. WHEN a Visitor has enabled the "prefers-reduced-motion" operating system setting, THE Portfolio_Site SHALL disable all canvas animations, the Typewriter_Effect, and the animated gradient borders
5. THE Portfolio_Site SHALL ensure all interactive elements (buttons, links, chat widget) are reachable and operable using keyboard navigation alone
6. THE AI_Chatbot SHALL include appropriate ARIA labels: aria-label="AI 채팅 열기" on the floating button and role="dialog" with aria-label="AI 어시스턴트 채팅" on the chat panel

### Requirement 11: Notion Blog Sync with Image Optimization

**User Story:** As the site owner, I want a single command that syncs my Notion blog posts and optimizes images, so that I can publish updates without manual image processing or multiple steps.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL provide a single CLI command (`npm run deploy`) that fetches Notion posts, downloads and resizes images, builds the site, and deploys to Amplify
2. WHEN syncing blog posts, THE system SHALL download all images referenced in Notion posts to a local directory
3. THE system SHALL resize downloaded images to a maximum width of 720 pixels while maintaining aspect ratio
4. THE system SHALL convert downloaded images to WebP format for reduced file size
5. THE system SHALL replace Notion image URLs in the rendered HTML with paths to the locally optimized images
6. THE system SHALL use the `sharp` Node.js library for image processing during the sync step
7. IF a previously synced image has not changed, THEN THE system SHALL skip re-downloading and re-processing that image to speed up subsequent syncs

### Requirement 12: Migrate Blog to notion-astro-loader

**User Story:** As the site owner, I want my Notion blog to use Astro's native content layer via `notion-astro-loader`, so that blog content is managed consistently with other content collections and benefits from built-in caching.

#### Acceptance Criteria

1. THE blog Content_Collection SHALL use `notion-astro-loader` as its loader instead of the custom `src/lib/notion.ts` implementation
2. THE blog collection SHALL query the Notion database filtered by the "Published" checkbox property
3. THE blog collection SHALL sort posts by "Published Date" in descending order
4. THE blog pages SHALL render Notion content using the loader's built-in markdown conversion, including support for callout blocks, toggle blocks, and mermaid code blocks
5. THE system SHALL remove the manual `src/lib/notion.ts` file after migration is complete
6. THE blog listing page and detail page SHALL maintain the same URL structure (`/blog` and `/blog/[id]`)
