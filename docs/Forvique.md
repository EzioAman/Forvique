# FORVIQUE

## Project identity

Brand: Forvique

Business: Software development services.

Primary audience:

- Startup founders
- Small and medium-sized businesses
- Developers and technical teams

Scope: Entire website and shared design system.

## Business positioning

Forvique primarily provides software development services like web-development, attendance tracker, AI-development, CRM etc.

The website must communicate both offerings clearly.

Primary conversion paths:

1. Project enquiries and service enquiries.
2. SaaS product discovery and purchase.
3. A dashboard which includes its own routing protected by RBAC (Like organisation, 1. super admin that is the ceo, he invites other member and give them roles, default is employee) -> this features like a custom CRM for Forvique creators (Aman, Abhishek, Ankit & Aryan)

Do not assume an existing checkout, authentication or product delivery system without inspecting the project. Explicitly tell the tradeoffs for using custom vs available components and systems like - already avaiable buttons on the xyz website, you (agent) can change the design, if I (Aman) like.

## Design principles

- Meaningful visual hierarchy.
- Clear typography and consistent spacing.
- Restrained use of color.
- Strong content hierarchy.
- Purposeful interaction design.
- Consistent light and dark themes.
- Responsive layouts.
- Authentic product presentation.

Remove generic AI-generated design patterns, unnecessary visual effects, decorative clutter, repetitive cards, arbitrary gradients and meaningless animations.

Do not sacrifice usability for aesthetics.

## Project discovery

Inspect the existing Forvique website and codebase.

Do not claim to have inspected inaccessible pages.

Identify:

- Existing pages and routes.
- Framework and styling architecture.
- Existing components and dependencies.
- Brand assets and typography.
- Actual services and products.
- Existing forms and conversion flows.
- Functionality that must be preserved.
- Content that needs revision or removal.

The portfolio is new. Do not fabricate clients, testimonials, case studies, statistics or product capabilities. Only seed database, when asked.

## Phase 1 — Understand Design.md

Deliver only after going fully discussing & asking me for visual designs.:

- A visual HTML palette,
- Complete shade scales.
- Semantic color tokens.
- HEX values.
- Surface and background hierarchy.
- Text hierarchy.
- Border and interactive states.
- Accessibility contrast measurements.

HARD STOP: Obtain explicit user approval of the visual palette. (you can take an example from [sitepeel.dev/design-md/linear.app](https://sitepeel.dev/design-md/linear.app/) if you don't understand what to do there, ask me.)

Do not implement or modify production styling before approval.

## Phase 2 — Design system

After approval, establish typography, spacing, grid, responsive breakpoints, radii, borders, elevation and reusable component variants. The OpenDesigner skill will help.

## Phase 3 — Website architecture

Audit the current information architecture and propose a coherent page structure.

Ensure services and SaaS products have distinct, understandable conversion paths.

## Phase 4 — Visual design

Design the full website using the approved design system.

Do not introduce arbitrary colors, inconsistent typography or decorative effects.

## Phase 5 — Ponytail implementation

Inspect the existing codebase before modifying it.

Implement the approved design using the existing architecture.

Preserve working functionality, avoid unnecessary dependencies and keep components maintainable.

## Phase 5 — Quality assurance

Test:

- Desktop, tablet and mobile.
- Light and dark themes.
- Navigation and conversion paths.
- Forms and interactions.
- CRM Dashboard.
- Accessibility.
- Performance.
- Browser console errors.
- Visual consistency.

## Execution discipline

Work one phase at a time.

Present deliverables for review.

Never silently skip an acceptance gate.

Never invent missing information.

Do not begin the next phase until the current phase has been explicitly accepted.
