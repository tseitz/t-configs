#!/usr/bin/env bash
input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total_in=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
total_out=$(echo "$input" | jq -r '.context_window.total_output_tokens // empty')

# Shorten home directory to ~
home="$HOME"
short_cwd="${cwd/#$home/\~}"

SEP="$(printf '\033[0;90m|\033[0m')"

parts=()

# Directory
[ -n "$short_cwd" ] && parts+=("$(printf '\033[1;36m%s\033[0m' "$short_cwd")")

# Git branch (run in cwd if available)
if [ -n "$cwd" ] && command -v git &>/dev/null; then
  branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null)
  if [ -n "$branch" ]; then
    parts+=("$(printf '\033[0;33m\ue0a0 %s\033[0m' "$branch")")
  fi
fi

# Model
[ -n "$model" ] && parts+=("$(printf '\033[0;35m%s\033[0m' "$model")")

# Context usage with progress bar
if [ -n "$used" ] && [ "$used" != "null" ]; then
  used_int=${used%.*}

  # Pick color based on usage level
  if [ "$used_int" -ge 80 ]; then
    bar_color='\033[0;31m'
  elif [ "$used_int" -ge 50 ]; then
    bar_color='\033[0;33m'
  else
    bar_color='\033[0;32m'
  fi

  # Build a 10-char progress bar
  bar_width=10
  filled=$(( used_int * bar_width / 100 ))
  empty=$(( bar_width - filled ))
  bar_filled=""
  bar_empty=""
  for ((i=0; i<filled; i++)); do bar_filled="${bar_filled}█"; done
  for ((i=0; i<empty; i++)); do bar_empty="${bar_empty}░"; done

  bar_str="$(printf "${bar_color}%s\033[0;90m%s\033[0m" "$bar_filled" "$bar_empty")"
  label="$(printf "${bar_color}%d%%\033[0m" "$used_int")"
  parts+=("ctx: ${bar_str} ${label}")
fi

# Total session token usage
if [ -n "$total_in" ] && [ "$total_in" != "null" ] && [ -n "$total_out" ] && [ "$total_out" != "null" ]; then
  # Format with K suffix for readability
  fmt_tokens() {
    local n=$1
    if [ "$n" -ge 1000 ]; then
      printf "%.1fk" "$(echo "scale=1; $n / 1000" | bc)"
    else
      printf "%d" "$n"
    fi
  }
  in_fmt=$(fmt_tokens "$total_in")
  out_fmt=$(fmt_tokens "$total_out")
  parts+=("$(printf '\033[0;90min:%s out:%s\033[0m' "$in_fmt" "$out_fmt")")
fi

# Join parts with separator
result=""
for part in "${parts[@]}"; do
  if [ -z "$result" ]; then
    result="$part"
  else
    result="$result $SEP $part"
  fi
done

printf "%s" "$result"
