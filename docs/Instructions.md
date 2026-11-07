The correct approach is to treat this as a design-system reconstruction and frontend engineering task, not a generic landing-page redesign.

Your objective is not to make the website look more AI-generated or add more visual effects. It is to remove unnecessary design decisions, establish a consistent visual identity, and rebuild the landing page around a deliberate design system.

Use OpenDesigner for the design process and Ponytail for implementation, with strict approval gates between phases.


# 1. How I would approach this

1. Phase 1 — Project audit and visual direction

   Inspect the existing website, its components, assets, typography, visual identity, layout and codebase.

   Identify what should stay, what should be removed, and what needs restructuring.
2. Phase 2 — Color system and design tokens

   Establish a fixed color palette derived from the project's existing identity.

   Produce both light and dark themes, with a visual palette document showing every color, its purpose, shades and contrast ratios.

   Your first acceptance gate

   No implementation until I approve the palette.
3. Phase 3 — Design architecture

   Establish typography, spacing, grids, border treatments, shadows, radii, component styles and responsive behavior.

   Create a coherent visual language instead of choosing styles independently for each section.
4. Phase 4 — Landing page redesign

   Redesign the page section by section, using the approved design system.

   Every section must have a reason to exist.
5. Phase 5 — Ponytail implementation

   Implement the approved design in the existing codebase.

   Reuse components, preserve existing functionality, avoid unnecessary dependencies and maintain the project's architecture.
6. Phase 6 — Quality assurance

   Check responsiveness, accessibility, performance, visual consistency, animations, browser behavior and console errors.

   If you need more information for context read the Design System.md file created by me (Aman Sinha).

   reference: `docs/Forvique.md`