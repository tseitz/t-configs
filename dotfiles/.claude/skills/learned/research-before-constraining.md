# Research Physical Constraints Before Coding Geometry

**Extracted:** 2026-04-12
**Context:** When building CAD/geometry systems that model real-world objects (speaker enclosures, mechanical assemblies, etc.)

## Problem

When translating an acoustic/mathematical model into physical geometry, it's tempting to
add constraints that seem "obvious" (e.g., "the driver must mount on a fold divider")
without checking how real builders handle the problem. This leads to over-constrained
geometry with ugly workarounds (dead space, sealing shelves, unequal legs).

## Solution

Before coding any geometric constraint:

1. **Research how practitioners actually build it** — forums (diyAudio, AVS Forum),
   reference builds (Danley, Brian Steele), build photos, spreadsheets
2. **Identify which constraints are acoustic vs. structural** — acoustic constraints
   (path length, cross-sectional area profile, tap position) are non-negotiable.
   Structural constraints (fold positions, board placement) are flexible.
3. **Check if the constraint you're adding is real** — "driver must be on a divider"
   sounded right but is wrong. Builders routinely mount drivers on separate baffles.
4. **Build the simplest geometry first** — equal legs, uniform spacing. Add complexity
   only when a real constraint demands it, not when an assumption suggests it.

## When to Use

- Building a CAD system from acoustic/simulation parameters
- Adding a geometric constraint that makes the code significantly more complex
- When you find yourself adding "sealing shelves" or "dead space fillers" to fix
  problems created by your own constraints — that's a code smell for an over-constrained model
- Any time the geometry looks wrong in the CAD viewer and the fix isn't obvious
