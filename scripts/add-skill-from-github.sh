#!/usr/bin/env bash
# Add or update an agent skill by copying a directory from a GitHub repo.
# Uses sparse checkout so only the requested path is downloaded.
#
# Usage:
#   ./scripts/add-skill-from-github.sh <github-tree-url> [skill-name]
#
# Examples:
#   ./scripts/add-skill-from-github.sh "https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices"
#   ./scripts/add-skill-from-github.sh "https://github.com/anthropics/skills/tree/main/skills/webapp-testing"
#   ./scripts/add-skill-from-github.sh "https://github.com/anthropics/skills/tree/main/skills/webapp-testing" my-custom-name
#
# The skill name defaults to the last segment of the URL path (e.g. react-best-practices).
# Pass a second argument to override.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_DIR/dotfiles/.agent/skills"
FETCH_DIR="$REPO_DIR/.tmp/skills-fetch-$$"

cleanup() { rm -rf "$FETCH_DIR"; }
trap cleanup EXIT

parse_github_url() {
  local url="$1"
  local path_part="${url#https://}"
  path_part="${path_part#http://}"
  path_part="${path_part#github.com/}"
  # path_part = owner/repo/tree/branch/path/in/repo
  if [[ "$path_part" =~ ^([^/]+)/([^/]+)/tree/([^/]+)/(.*)$ ]]; then
    OWNER="${BASH_REMATCH[1]}"
    REPO="${BASH_REMATCH[2]}"
    BRANCH="${BASH_REMATCH[3]}"
    PATH_IN_REPO="${BASH_REMATCH[4]}"
    return 0
  fi
  return 1
}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <github-tree-url> [skill-name]"
  echo ""
  echo "Example:"
  echo "  $0 \"https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices\""
  echo ""
  echo "The skill name defaults to the last path segment (e.g. react-best-practices)."
  echo "Pass a second argument to override."
  exit 1
fi

URL="$1"
SKILL_NAME_OVERRIDE="${2:-}"

if ! parse_github_url "$URL"; then
  echo "Error: could not parse GitHub URL. Expected form:" >&2
  echo "  https://github.com/owner/repo/tree/branch/path/to/skill" >&2
  exit 1
fi

REPO="$OWNER/$REPO"
SKILL_NAME="${SKILL_NAME_OVERRIDE:-$(basename "$PATH_IN_REPO")}"
TARGET="$SKILLS_DIR/$SKILL_NAME"

echo "Fetching $PATH_IN_REPO from https://github.com/$REPO (branch: $BRANCH) into .agent/skills/$SKILL_NAME ..."
mkdir -p "$FETCH_DIR"
cd "$FETCH_DIR"

git clone --depth 1 --filter=blob:none --sparse --branch "$BRANCH" "https://github.com/$REPO.git" repo
cd repo
git sparse-checkout set "$PATH_IN_REPO"

if [[ ! -d "$PATH_IN_REPO" ]]; then
  echo "Error: path $PATH_IN_REPO not found in repo." >&2
  exit 1
fi

mkdir -p "$SKILLS_DIR"
rm -rf "$TARGET"
cp -R "$PATH_IN_REPO" "$TARGET"
echo "Done. Added/updated: dotfiles/.agent/skills/$SKILL_NAME"
