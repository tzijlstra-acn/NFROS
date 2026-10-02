// Motion timing and easing constants for V2.2
// All values are in seconds unless noted.

export const MOTION_TOKENS = {
  // Durations
  duration: {
    instant:    0.05,
    fast:       0.15,
    standard:   0.25,
    emphasis:   0.35,
    complex:    0.4,
  },

  // Easing curves
  ease: {
    // Enter: content arriving
    enter:     [0.0, 0.0, 0.2, 1.0] as const,
    // Exit: content leaving
    exit:      [0.4, 0.0, 1.0, 1.0] as const,
    // Emphasis: drawing attention
    emphasis:  [0.4, 0.0, 0.6, 1.0] as const,
    // Standard: neutral transitions
    standard:  [0.4, 0.0, 0.2, 1.0] as const,
  },

  // Stagger
  stagger: {
    tight:    0.04,
    standard: 0.08,
    loose:    0.12,
  },

  // Offsets
  offset: {
    slideX:   40,    // px: horizontal slide-in
    revealY:  16,    // px: vertical reveal
    subtle:   8,     // px: subtle shift
  },
} as const;

// Reduced motion: pass as variants override when prefers-reduced-motion is active
export const REDUCED_MOTION_VARIANTS = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.001 } },
  exit:     { opacity: 0, transition: { duration: 0.001 } },
};
