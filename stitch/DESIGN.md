# Design System: Nabdh

## 1. Visual Theme & Atmosphere
Nabdh is an Arabic-first medical appointment product for Algeria. The interface should feel calm, official, and fast: credible enough for medical decisions, light enough for repeated daily use by doctors and patients. Density is daily-app balanced, variance is restrained and predictable, motion is quiet and purposeful. The doctor surfaces should feel like a precise clinic operations tool, not a decorative healthcare dashboard.

## 2. Color Palette & Roles
- **Clinic Canvas** (#F7FAFC) - Primary app background, soft and low-fatigue.
- **White Surface** (#FFFFFF) - Appointment rows, inputs, filters, and content panels.
- **Official Ink** (#0F172A) - Primary Arabic text and high-priority labels.
- **Muted Steel** (#64748B) - Secondary copy, visit metadata, helper text, inactive tabs.
- **Quiet Border** (#D8E1EA) - 1px dividers and card outlines.
- **Nabdh Blue** (#1F7FBE) - The only main accent, used for active tabs, focused states, timestamps, and primary actions.
- **Deep Clinic Navy** (#123F57) - Header bars and official role context.
- **Success Field** (#E7F6EF) with **Success Text** (#16724B) - Completed appointment states.
- **Warning Field** (#FFF5DD) with **Warning Text** (#8A5A00) - Waiting or in-progress states.
- **Danger Field** (#FDECEC) with **Danger Text** (#B42318) - Cancelled and no-show states.

Use the accent sparingly. Never make the UI feel like a generic blue hospital template. Do not use neon, purple, glowing gradients, decorative blobs, or pure black.

## 3. Typography Rules
- **Arabic UI:** Use a clean Arabic sans such as Cairo, IBM Plex Sans Arabic, or Tajawal. Use system fallbacks only when needed.
- **Latin UI:** Use Geist or Satoshi for supporting French/Latin text.
- **Numbers and Times:** Use a tabular sans or mono-style treatment for timestamps, appointment counts, and schedule values.
- **Hierarchy:** Patient names are 15-16px bold. Status chips are compact and semibold. Metadata is 12-13px regular with relaxed line height.
- **Line Behavior:** Arabic text must be right-aligned and RTL-first. Long visit reasons wrap to two lines without overlapping time or status.

## 4. Component Stylings
* **Appointment Rows:** White surface, 1px quiet border, 8-10px radius, no decorative icons unless the icon adds meaning. Layout must prioritize scan order: patient name and status first, time and visit details second. Do not place status, time, and name on one crowded baseline.
* **Status Chips:** Text labels only, compact, soft semantic background. Never rely on color alone. No emojis or decorative symbols.
* **Time Labels:** Small, bold, blue, placed consistently so doctors can scan the schedule quickly.
* **Search Inputs:** Full-width, white surface, 44px minimum height, icon may be used only for search/filter affordance.
* **Filter Controls:** Familiar segmented controls for period filters. Advanced filters can live in a bottom sheet with Apply and Clear actions.
* **Buttons:** Clear affordance, no outer glow, no heavy gradients. Active state can use Nabdh Blue.
* **Empty States:** Quiet and useful, not playful. Explain the state in one short line.

## 5. Layout Principles
Design mobile-first for a 390-430px wide phone. Keep horizontal rhythm stable with 16px page margins. Avoid nested cards. Sections should be scannable: header, search, period filter, appointment count, appointment rows. Appointment rows should preserve clear zones for name, status, time, and metadata without overlap. Keep touch targets at least 44px.

## 6. Motion & Interaction
Motion is restrained. Use 150-220ms state transitions for bottom sheets, pressed rows, and filter selection. Animate only opacity and transform. Do not animate layout dimensions. Appointment row press feedback should be subtle opacity or background tint only.

## 7. Anti-Patterns (Banned)
- No emojis in medical workflow UI.
- No person/user symbols inside appointment rows unless explicitly requested.
- No decorative medical illustrations on operational screens.
- No neon colors, no purple glow, no gradient text.
- No pure black (#000000).
- No overlapping text, chips, badges, or icons.
- No oversized rounded cards or pill-heavy UI that makes labels look like buttons.
- No fake placeholder names like John Doe. Use Algerian Arabic names when examples are needed.
- No vague copy such as "seamless", "next-gen", "elevate", or "unlock".
- No crowded one-line appointment rows when status and metadata are both visible.
