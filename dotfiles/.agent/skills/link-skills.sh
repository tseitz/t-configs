#!/usr/bin/env bash
# Generates flat symlinks in ~/.claude/skills/ pointing to each nested skill folder.
# Claude Code expects skills as direct children of ~/.claude/skills/, but we organize
# them in category subdirectories. This script bridges the gap.
#
# Usage: ./link-skills.sh
# Re-run whenever you add, remove, or rename skills.

set -euo pipefail

SKILLS_SRC="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DST="$HOME/.claude/skills"

# Ensure the destination exists (handles first-time setup)
mkdir -p "$SKILLS_DST"

# Category directories to scan (skip dotfiles, scripts, and top-level skill dirs)
is_category_dir() {
  local dir="$1"
  # A category dir contains subdirectories with SKILL.md files
  # A skill dir itself contains a SKILL.md at its root
  [[ -d "$dir" ]] && [[ ! -f "$dir/SKILL.md" ]] && [[ "$(basename "$dir")" != .* ]]
}

# Track what we link so we can report
linked=()
skipped=()
removed=()

# Clean up stale symlinks in destination that point back into our source
for link in "$SKILLS_DST"/*; do
  [[ -L "$link" ]] || continue
  target="$(readlink "$link")"
  if [[ "$target" == "$SKILLS_SRC"/* ]]; then
    # It's one of ours — remove if target no longer exists
    if [[ ! -d "$target" ]] || [[ ! -f "$target/SKILL.md" ]]; then
      rm "$link"
      removed+=("$(basename "$link")")
    fi
  fi
done

# Create symlinks for each skill
for category in "$SKILLS_SRC"/*/; do
  category="${category%/}"

  if [[ -f "$category/SKILL.md" ]]; then
    # Top-level skill (e.g., soul/) — link directly
    name="$(basename "$category")"
    if [[ ! -e "$SKILLS_DST/$name" ]]; then
      ln -s "$category" "$SKILLS_DST/$name"
      linked+=("$name")
    else
      skipped+=("$name")
    fi
    continue
  fi

  # Category directory — link each child skill
  for skill in "$category"/*/; do
    skill="${skill%/}"
    [[ -f "$skill/SKILL.md" ]] || continue
    name="$(basename "$skill")"
    if [[ ! -e "$SKILLS_DST/$name" ]]; then
      ln -s "$skill" "$SKILLS_DST/$name"
      linked+=("$name")
    else
      skipped+=("$name")
    fi
  done
done

# Report
if (( ${#removed[@]} )); then
  echo "Removed ${#removed[@]} stale: ${removed[*]}"
fi
if (( ${#linked[@]} )); then
  echo "Linked ${#linked[@]} new: ${linked[*]}"
fi
if (( ${#skipped[@]} )); then
  echo "Skipped ${#skipped[@]} (already exist): ${skipped[*]}"
fi
if (( ! ${#linked[@]} && ! ${#removed[@]} )); then
  echo "All ${#skipped[@]} skills already linked. Nothing to do."
fi
