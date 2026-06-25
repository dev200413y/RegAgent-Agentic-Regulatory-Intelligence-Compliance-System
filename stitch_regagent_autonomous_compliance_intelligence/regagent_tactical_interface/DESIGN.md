---
name: RegAgent Tactical Interface
colors:
  surface: '#0e1322'
  surface-dim: '#0e1322'
  surface-bright: '#343949'
  surface-container-lowest: '#090e1c'
  surface-container-low: '#161b2b'
  surface-container: '#1a1f2f'
  surface-container-high: '#25293a'
  surface-container-highest: '#2f3445'
  on-surface: '#dee1f7'
  on-surface-variant: '#d3c5ac'
  inverse-surface: '#dee1f7'
  inverse-on-surface: '#2b3040'
  outline: '#9b8f79'
  outline-variant: '#4f4633'
  surface-tint: '#f7be1d'
  primary: '#ffd165'
  on-primary: '#3f2e00'
  primary-container: '#eab308'
  on-primary-container: '#604700'
  inverse-primary: '#785a00'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#6be7ff'
  on-tertiary: '#00363e'
  tertiary-container: '#0dcde8'
  on-tertiary-container: '#00535f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdf9a'
  primary-fixed-dim: '#f7be1d'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5a4300'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#a2eeff'
  tertiary-fixed-dim: '#2fd9f4'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#0e1322'
  on-background: '#dee1f7'
  surface-variant: '#2f3445'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-display:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is engineered to evoke a sense of high-stakes precision and unwavering security. It targets compliance officers and legal analysts who operate within high-security banking environments. The aesthetic is a refined **Glassmorphism** executed within a "Dark Ops" framework.

The interface utilizes deep obsidian voids and midnight navy depths to create a sense of infinite digital space. Elements appear as suspended glass panes with high-end optical properties: frosted textures, subtle internal glows, and razor-thin light-trapping borders. This approach transforms dense regulatory data into a sophisticated, futuristic workspace that feels both authoritative and technologically advanced.

## Colors
The palette is built on a foundation of **Obsidian (#020617)** and **Midnight Navy (#0A0F1E)** to provide maximum depth for glass effects. 

- **Regulatory Gold (#EAB308)**: Reserved for primary actions, high-level certifications, and "Authoritative" states.
- **Security Blue (#3B82F6)**: Used for system-level feedback, secondary navigation, and trusted data streams.
- **Cyber-cyan (#22D3EE)**: Applied to active agent processes, live telemetry, and interactive data points.
- **Functional Colors**: **Risk Red (#EF4444)** is utilized exclusively for critical compliance breaches, while **Compliance Green (#10B981)** signals successful audits and cleared entities.

## Typography
The typography system prioritizes legibility within dense information environments. **Inter** provides a modern, neutral foundation for all UI copy and structural headings.

To reinforce the technical nature of compliance auditing, **JetBrains Mono** is utilized for all data-heavy components, including transaction IDs, timestamps, and regulatory codes. This monospaced font ensures that numerical data aligns perfectly in tables and logs. All small labels should use uppercase JetBrains Mono with increased letter spacing to achieve a "tactical HUD" aesthetic.

## Layout & Spacing
The layout follows a rigid 12-column grid system with 16px gutters to maintain an organized, systematic feel. 

- **Desktop**: 12-columns, 24px margins. Content is typically structured in a "Dashboard" layout with a fixed 280px left navigation sidebar.
- **Tablet**: 8-columns, 16px margins. Sidebar collapses into an icon-only rail or hamburger menu.
- **Mobile**: 4-columns, 16px margins. Cards stack vertically, and glass effects are simplified (reduced blur radius) to maintain performance.

Spacing follows a 4px base unit, with 16px being the standard rhythm for component grouping and 32px for section separation.

## Elevation & Depth
Depth is achieved through **Backdrop Refraction** rather than traditional drop shadows.

1.  **Level 0 (Base)**: Solid `#020617` background.
2.  **Level 1 (Panels)**: Surface color `rgba(15, 23, 42, 0.6)` with a `backdrop-filter: blur(12px)`. Borders are `1px solid rgba(255, 255, 255, 0.05)`.
3.  **Level 2 (Active Cards/Modals)**: Surface color `rgba(30, 41, 59, 0.7)` with `backdrop-filter: blur(20px)`. Borders use a linear gradient: `top-left: rgba(255, 255, 255, 0.15)` to `bottom-right: rgba(255, 255, 255, 0)`.
4.  **Interaction Glow**: Hovering over interactive elements triggers a subtle outer glow (box-shadow) using the element’s primary accent color at 20% opacity with a 20px blur radius.

## Shapes
The shape language is "Professional-Soft." We avoid sharp, aggressive corners to prevent the UI from feeling hostile, but we also avoid high-radius "pill" shapes that feel too casual.

- **Standard Elements (Buttons, Inputs)**: 0.25rem (4px) corner radius.
- **Containers (Cards, Modals)**: 0.75rem (12px) corner radius for a distinct "glass pane" look.
- **Status Pills**: 2rem (32px) for high-contrast status tags only.

## Components
- **Glass Cards**: The primary container. Features a 1px top-down gradient border and a subtle internal noise texture (2% opacity) to enhance the glass feel.
- **Buttons**:
    - *Primary*: Solid `Regulatory Gold` with black text. No glass effect for maximum prominence.
    - *Secondary/Ghost*: Glass background with `Security Blue` borders and text. 
- **Data Tables**: Rows use alternating glass transparency. Headers are `Label-Caps` style in `JetBrains Mono`. Borders between columns are omitted; only horizontal dividers at 5% white opacity are used.
- **Technical Indicators**: Circular progress rings for "Risk Scores" use `Cyber-cyan` for active segments and a dim `rgba(255,255,255,0.1)` for the track.
- **Input Fields**: Darker than the card background (`rgba(0,0,0,0.3)`) with a `Cyber-cyan` bottom-border focus state that "glows" slightly when active.
- **Agent Feed**: A specialized list component using monospaced text for live compliance logs, where each entry is prefixed by a micro-chip indicating the "Agent ID."