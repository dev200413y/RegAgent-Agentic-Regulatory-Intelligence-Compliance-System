---
name: Tactical Amber
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#d3c5ac'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#9b8f79'
  outline-variant: '#4f4633'
  surface-tint: '#f7be1d'
  primary: '#ffd165'
  on-primary: '#3f2e00'
  primary-container: '#eab308'
  on-primary-container: '#604700'
  inverse-primary: '#785a00'
  secondary: '#c3c0ff'
  on-secondary: '#1d00a5'
  secondary-container: '#3626ce'
  on-secondary-container: '#b3b1ff'
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
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#c7e7ff'
  tertiary-fixed-dim: '#83cfff'
  on-tertiary-fixed: '#001e2e'
  on-tertiary-fixed-variant: '#004c6c'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0.05em
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.1em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 12px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin: 32px
---

## Brand & Style
The design system is engineered for mission-critical environments where data density and rapid cognitive processing are paramount. The aesthetic merges **Glassmorphism** with **High-Contrast Tactical** elements to create a sense of depth, security, and authority.

The interface evokes the feel of a high-end command center or a specialized military-grade heads-up display (HUD). It prioritizes focus through a deep, obsidian-like backdrop and utilizes glowing amber accents to draw immediate attention to status changes and primary execution paths. Surfaces are treated as semi-transparent obsidian glass, layering information without losing the context of the underlying "system" grid.

## Colors
This design system operates exclusively in a dark mode environment to maximize the "glow" effect of critical indicators and reduce eye strain in low-light operational settings.

- **Primary (Amber/Gold):** Used for "Active," "Critical," and primary action states. It should appear to emit light against the dark background.
- **Secondary (Indigo):** Used for informational accents, focus states, and secondary visual interest.
- **Background (Obsidian):** The base layer (#0c0e12). It should feature a subtle 24px geometric dot-grid or line-grid overlay at 5% opacity.
- **Surface:** Glassmorphic layers use a deep grey-black with a high backdrop-blur (20px+) to maintain legibility over complex backgrounds.
- **Borders:** All surfaces use a 1px linear-gradient border (Top-Left: `rgba(234, 179, 8, 0.2)` to Bottom-Right: `rgba(79, 70, 229, 0.1)`).

## Typography
The typography strategy employs a dual-font approach to distinguish between human-readable narrative and machine-precise data.

- **Inter** is the primary typeface for all UI controls, navigation, and body content, providing a modern and highly legible foundation.
- **JetBrains Mono** is reserved for status readouts, timestamps, coordinates, and technical labels. This monospaced font reinforces the "tactical" and "data-heavy" nature of the design system.
- **Hierarchy:** Use `label-caps` for small meta-information or category labels above headlines. Use `data-lg` for large numeric KPIs.

## Layout & Spacing
The design system utilizes a **Fluid Grid** model based on an 8px rhythm. Content should feel structured and modular, as if comprised of independent "instrumentation panels."

- **Desktop:** 12-column grid with 24px gutters. Use large 32px margins to create a "contained" HUD feel.
- **Mobile:** 4-column grid with 16px gutters. Elements stack vertically, but maintain horizontal padding of 20px.
- **Density:** High density is encouraged. Elements are packed tightly using `spacing.xs` and `spacing.sm` to allow for maximum information visibility on a single screen.

## Elevation & Depth
Depth is not communicated via traditional shadows, but through **Tonal Layering** and **Backdrop Effects**.

1.  **Base Layer:** Solid #0c0e12 with a data grid.
2.  **Surface Layer:** Semi-transparent glass (`rgba(22, 24, 29, 0.7)`) with a 20px backdrop-blur. This layer uses the 1px linear-gradient border for definition.
3.  **Active Layer:** When a component is focused or active, it gains an inner amber glow (`box-shadow: inset 0 0 8px rgba(234, 179, 8, 0.3)`) and its border opacity increases.
4.  **Overlay Layer:** Modals and tooltips use a darker, more opaque glass with a subtle outer glow of the primary color to "float" above the dashboard.

## Shapes
This design system utilizes a **Sharp (0px)** roundedness strategy to emphasize a cold, technical, and rigid architectural feel. 

- **Primary Elements:** Rectangular buttons, cards, and input fields must have strictly 90-degree corners.
- **Exceptions:** Small status pips (e.g., "Live" indicators) may be circular to stand out against the geometric grid.
- **Cut Corners:** For a more advanced tactical feel, larger cards or primary action buttons may use a 45-degree "clipped corner" (chamfer) of 8px on the top-right and bottom-left, but this should be applied sparingly.

## Components
- **Buttons:** Primary buttons are solid Amber (#eab308) with black text. Secondary buttons are ghost-style with a 1px Amber border and a subtle hover fill.
- **Data Cards:** Glassmorphic surfaces with a `label-caps` header separated by a 1px horizontal rule. Bottom corners should contain "technical coordinates" in `data-sm` typography.
- **Inputs:** Dark obsidian background with an Amber bottom-border. On focus, the 1px border surrounds the entire input with a faint outer glow.
- **Status Indicators:** "Active" is a pulsing Amber dot. "Inactive" is a hollow Grey circle. "Alert" is a flashing Red (#ef4444) box.
- **Terminal/Console:** A specialized component for scrolling logs using `jetbrainsMono` at 12px. It should feature a 10% Amber tint over the glass background.
- **Tabs:** Underline-style with Amber highlighting for the active state. Non-active tabs use Indigo-Grey text at 60% opacity.