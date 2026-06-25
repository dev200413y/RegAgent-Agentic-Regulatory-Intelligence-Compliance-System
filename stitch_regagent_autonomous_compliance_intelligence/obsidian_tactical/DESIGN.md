---
name: Obsidian Tactical
colors:
  surface: '#111417'
  surface-dim: '#111417'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#191c1f'
  surface-container: '#1d2023'
  surface-container-high: '#282a2e'
  surface-container-highest: '#323539'
  on-surface: '#e1e2e7'
  on-surface-variant: '#d3c5ac'
  inverse-surface: '#e1e2e7'
  inverse-on-surface: '#2e3134'
  outline: '#9b8f79'
  outline-variant: '#4f4633'
  surface-tint: '#f7be1d'
  primary: '#ffd165'
  on-primary: '#3f2e00'
  primary-container: '#eab308'
  on-primary-container: '#604700'
  inverse-primary: '#785a00'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#adddff'
  on-tertiary: '#00344c'
  tertiary-container: '#60c5ff'
  on-tertiary-container: '#005072'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9a'
  primary-fixed-dim: '#f7be1d'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5a4300'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#c7e7ff'
  tertiary-fixed-dim: '#83cfff'
  on-tertiary-fixed: '#001e2e'
  on-tertiary-fixed-variant: '#004c6c'
  background: '#111417'
  on-background: '#e1e2e7'
  surface-variant: '#323539'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin: 32px
  container-max: 1440px
---

## Brand & Style

The design system embodies a **Tactical Glassmorphism** aesthetic tailored for mission-critical regulatory environments. It projects an aura of high-tech authority and sophisticated precision. The interface feels "air-gapped" and secure, utilizing deep obsidian layers and ethereal glass surfaces to organize complex data streams. 

The visual narrative is driven by high-transparency containers that float over a dark, atmospheric void, creating a sense of depth and focus. This is a "pro-tool" environment where every pixel serves a functional purpose, balancing the raw efficiency of an aerospace HUD with the refined elegance of a premium enterprise platform.

## Colors

The palette is anchored in **#05070a (Obsidian)**, providing a profound sense of depth.
- **Primary Amber (#eab308):** Used for critical calls to action, active indicators, and high-priority warnings.
- **Deep Indigo (#6366f1):** Used for secondary interactive elements and decorative mesh gradients in the background.
- **Cyber-Safe Green (#22c55e):** Reserved strictly for healthy status, compliant states, and successful validations.
- **Regulatory Red (#ef4444):** Used for penalties, violations, and system-level alerts.

Backgrounds should feature subtle, ultra-dark mesh gradients combining the Primary Amber and Deep Indigo at extremely low opacities (2-5%) to prevent visual fatigue while maintaining a premium feel.

## Typography

This design system utilizes **Inter** for all UI prose to ensure maximum legibility and a modern, neutral tone. Letter spacing is tightened across headlines to create a "locked-in" tactical appearance. 

**JetBrains Mono** is introduced as a secondary functional font for "Monospace Data" accents. This is applied to all numerical values, coordinates, timestamps, and regulatory IDs. This contrast between the humanist Inter and the technical JetBrains Mono reinforces the high-tech, data-driven nature of the interface. Labels use uppercase Inter with increased tracking for a clean, structural feel.

## Layout & Spacing

The layout follows a **Rigid Fluid Grid** philosophy. While the overall container is fluid to accommodate wide-screen monitoring stations, internal components adhere to a strict 4px baseline grid. 

- **Desktop:** 12-column grid with 24px gutters.
- **Tablet:** 8-column grid with 16px gutters.
- **Mobile:** 4-column grid with 12px gutters.

Spacing between cards should be generous to allow the background mesh gradients and "scanning line" animations to breathe. Content within glass cards should use internal padding of 24px (6 units) to maintain a premium, spacious feel despite the dense data.

## Elevation & Depth

Depth is achieved through **Tactical Glassmorphism** rather than traditional drop shadows. 

1.  **Surfaces:** Cards use `backdrop-filter: blur(24px)` with a semi-transparent fill of `#0f1218` at 60% opacity.
2.  **Borders:** Every glass container features a 1px solid border. The border uses a linear gradient (Top-Left to Bottom-Right) ranging from `white/10` to `white/0` to simulate a subtle light catch on a glass edge.
3.  **Layers:** 
    - **Level 0 (Background):** Obsidian with data-grid patterns (1px lines every 40px at 3% opacity).
    - **Level 1 (Surface):** Standard data cards.
    - **Level 2 (Overlay):** Modals and dropdowns, increasing backdrop-blur to 40px and adding a subtle inner glow.

## Shapes

The shape language is **Soft yet Precise**. A subtle `0.25rem` (4px) corner radius is applied to most UI components to suggest high-end manufacturing and precision. Larger glass containers may use `rounded-lg` (8px) to soften the overall composition, but sharp, technical corners are preferred over organic, circular ones to maintain the "Tactical" narrative.

## Components

### Buttons
Primary buttons are solid **Amber (#eab308)** with black text for maximum contrast. Secondary buttons are "Ghost Glass"—transparent with a 1px white/20 border that brightens on hover. Use a subtle horizontal scanning line animation across the surface of the primary button on hover.

### Glass Cards
The foundation of the UI. Must include the 1px gradient border and 24px backdrop-blur. For "Active" or "Alert" cards, the border gradient should shift from white to the status color (e.g., Amber or Red).

### Input Fields
Inputs are dark, recessed wells (`rgba(0,0,0,0.4)`) with a bottom-only 1px border. When focused, the border expands to the full perimeter in Primary Amber with a soft 4px outer glow.

### Status Indicators
Use "Cyber-Safe" Green and "Regulatory Red" for status dots. These dots should have a subtle "pulse" animation (0.5s duration) to indicate a live, air-gapped data stream.

### Data Grid Patterns
Incorporate a subtle overlay on the background consisting of a 40px square grid. Periodically, a horizontal "scanning line" (a 2px high gradient of Primary Amber at 5% opacity) should translate from the top to the bottom of the viewport.