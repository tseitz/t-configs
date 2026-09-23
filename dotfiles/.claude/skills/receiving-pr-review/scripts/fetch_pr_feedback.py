#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Fetch and categorize PR review feedback.

Usage:
    python fetch_pr_feedback.py [--pr PR_NUMBER]

If --pr is not specified, uses the PR for the current branch.

Output: JSON to stdout with categorized feedback.

Categories (using LOGAF scale - see https://develop.sentry.dev/engineering-practices/code-review/#logaf-scale):
- high: Must address before merge (h:, blocker, changes requested)
- medium: Should address (m:, standard feedback)
- low: Optional suggestions (l:, nit, style)
- bot: Informational automated comments (Codecov, Dependabot, etc.)
- resolved: Already resolved threads
- author_notes: Inline threads the PR author opened that no one has replied to
  (diff commentary, not feedback) — kept for context, not for triage.

Inline items carry the WHOLE thread, not just its opening comment:
- ``thread``: every comment in order, each flagged ``is_pr_author``
- ``full_body``/``author``: the first comment NOT by the PR author, so a thread the
  author opened is presented by the reviewer's reply rather than by the author's note
- ``awaiting_author_reply``: true when a reviewer had the last word
- ``diff_hunk``: the diff context GitHub anchored the thread to

Bot classification:
- Review bots (Sentry, Warden, Cursor, Bugbot, etc.) provide actionable code
  feedback. Their comments are categorized by content into high/medium/low with
  a ``review_bot: true`` flag — they are NOT placed in the ``bot`` bucket.
- Info bots (Codecov, Dependabot, Renovate, etc.) post status reports and are
  placed in the ``bot`` bucket for silent skipping.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from typing import Any


# Bots that provide actionable code review feedback (security issues, lint
# violations, bugs). Their comments are categorized by content, not skipped.
REVIEW_BOT_PATTERNS = [
    r"(?i)^sentry",
    r"(?i)^warden",
    r"(?i)^cursor",
    r"(?i)^bugbot",
    r"(?i)^seer",
    r"(?i)^copilot",
    r"(?i)^codex",
    r"(?i)^claude",
    r"(?i)^codeql",
]

# Bots that post informational status reports (coverage, dependency updates).
# These are placed in the ``bot`` bucket and skipped silently.
INFO_BOT_PATTERNS = [
    r"(?i)^codecov",
    r"(?i)^dependabot",
    r"(?i)^renovate",
    r"(?i)^github-actions",
    r"(?i)^mergify",
    r"(?i)^semantic-release",
    r"(?i)^sonarcloud",
    r"(?i)^snyk",
    r"(?i)bot$",
    r"(?i)\[bot\]$",
]


def run_gh(args: list[str]) -> dict[str, Any] | list[Any] | None:
    """Run a gh CLI command and return parsed JSON output."""
    try:
        result = subprocess.run(
            ["gh"] + args,
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout) if result.stdout.strip() else None
    except subprocess.CalledProcessError as e:
        print(f"Error running gh {' '.join(args)}: {e.stderr}", file=sys.stderr)
        return None
    except json.JSONDecodeError:
        return None


def get_repo_info() -> tuple[str, str] | None:
    """Get owner and repo name from current directory."""
    result = run_gh(["repo", "view", "--json", "owner,name"])
    if result:
        return result.get("owner", {}).get("login"), result.get("name")
    return None


def get_pr_info(pr_number: int | None = None) -> dict[str, Any] | None:
    """Get PR info, optionally by number or for current branch."""
    args = ["pr", "view", "--json", "number,url,headRefName,author,reviews,reviewDecision"]
    if pr_number:
        args.insert(2, str(pr_number))
    return run_gh(args)


def is_review_bot(username: str) -> bool:
    """Check if username matches a review bot that posts actionable feedback."""
    return any(re.search(p, username) for p in REVIEW_BOT_PATTERNS)


def is_info_bot(username: str) -> bool:
    """Check if username matches an informational bot (skip silently)."""
    return any(re.search(p, username) for p in INFO_BOT_PATTERNS)


def is_bot(username: str) -> bool:
    """Check if username matches any known bot pattern."""
    return is_review_bot(username) or is_info_bot(username)


def get_review_comments(owner: str, repo: str, pr_number: int) -> list[dict[str, Any]]:
    """Get inline code review comments via API."""
    result = run_gh([
        "api",
        f"repos/{owner}/{repo}/pulls/{pr_number}/comments",
        "--paginate",
    ])
    return result if isinstance(result, list) else []


def get_issue_comments(owner: str, repo: str, pr_number: int) -> list[dict[str, Any]]:
    """Get PR conversation comments (includes bot comments)."""
    result = run_gh([
        "api",
        f"repos/{owner}/{repo}/issues/{pr_number}/comments",
        "--paginate",
    ])
    return result if isinstance(result, list) else []


def get_review_threads(owner: str, repo: str, pr_number: int) -> list[dict[str, Any]]:
    """Get review threads with every comment in each thread, via GraphQL.

    Fetches the WHOLE comment chain per thread, not just the opening comment —
    replies are where a discussion is actually resolved (a reviewer conceding, an
    author answering, a follow-up question). Dropping them makes an answered
    thread look unaddressed and hides feedback that only exists as a reply.

    Threads are paginated; ``comments(first: 100)`` covers any realistic thread.
    """
    query = """
    query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              isResolved
              isOutdated
              path
              line
              originalLine
              diffSide
              comments(first: 100) {
                totalCount
                nodes {
                  id
                  body
                  url
                  diffHunk
                  createdAt
                  author { login }
                }
              }
            }
          }
        }
      }
    }
    """
    threads: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        page = _run_thread_query(query, owner, repo, pr_number, cursor)
        if page is None:
            break
        threads.extend(page.get("nodes") or [])
        page_info = page.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        cursor = page_info.get("endCursor")
        if not cursor:
            break
    return threads


def _run_thread_query(
    query: str,
    owner: str,
    repo: str,
    pr_number: int,
    cursor: str | None,
) -> dict[str, Any] | None:
    """Run one page of the review-thread query, returning the connection object."""
    args = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-F", f"owner={owner}",
        "-F", f"repo={repo}",
        "-F", f"pr={pr_number}",
    ]
    # GraphQL needs an explicit null for the first page; gh has no null literal,
    # so omit the variable entirely and let the query default it.
    if cursor:
        args += ["-f", f"cursor={cursor}"]
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
        return (
            data.get("data", {})
            .get("repository", {})
            .get("pullRequest", {})
            .get("reviewThreads", {})
        ) or None
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        stderr = getattr(e, "stderr", "") or ""
        print(f"Error fetching review threads: {stderr}", file=sys.stderr)
        return None


def detect_logaf(body: str) -> str | None:
    """Detect LOGAF scale markers in comment body.

    LOGAF scale (https://develop.sentry.dev/engineering-practices/code-review/#logaf-scale):
    - l: / [l] / low: → low priority (optional)
    - m: / [m] / medium: → medium priority (should address)
    - h: / [h] / high: → high priority (must address)

    Returns 'high', 'medium', 'low', or None if no marker found.
    """
    # Check for LOGAF markers at start of comment (with optional whitespace)
    logaf_patterns = [
        # h: or [h] or high: patterns
        (r"^\s*(?:h:|h\s*:|high:|\[h\])", "high"),
        # m: or [m] or medium: patterns
        (r"^\s*(?:m:|m\s*:|medium:|\[m\])", "medium"),
        # l: or [l] or low: patterns
        (r"^\s*(?:l:|l\s*:|low:|\[l\])", "low"),
    ]

    for pattern, level in logaf_patterns:
        if re.search(pattern, body, re.IGNORECASE):
            return level

    return None


def categorize_comment(comment: dict[str, Any], body: str) -> str:
    """Categorize a comment based on content and author.

    Uses LOGAF scale: high (must fix), medium (should fix), low (optional).
    """
    author = comment.get("author", {}).get("login", "") or comment.get("user", {}).get("login", "")

    # Info bots are skipped silently; review bots fall through to content
    # categorization so their actionable feedback is not lost.
    if is_info_bot(author) and not is_review_bot(author):
        return "bot"

    # Check for explicit LOGAF markers first
    logaf_level = detect_logaf(body)
    if logaf_level:
        return logaf_level

    # Look for high-priority (blocking) indicators
    high_patterns = [
        r"(?i)must\s+(fix|change|update|address)",
        r"(?i)this\s+(is\s+)?(wrong|incorrect|broken|buggy)",
        r"(?i)security\s+(issue|vulnerability|concern)",
        r"(?i)will\s+(break|cause|fail)",
        r"(?i)critical",
        r"(?i)blocker",
    ]

    for pattern in high_patterns:
        if re.search(pattern, body):
            return "high"

    # Look for low-priority (suggestion) indicators
    low_patterns = [
        r"(?i)nit[:\s]",
        r"(?i)nitpick",
        r"(?i)suggestion[:\s]",
        r"(?i)consider\s+",
        r"(?i)could\s+(also\s+)?",
        r"(?i)might\s+(want\s+to|be\s+better)",
        r"(?i)optional[:\s]",
        r"(?i)minor[:\s]",
        r"(?i)style[:\s]",
        r"(?i)prefer\s+",
        r"(?i)what\s+do\s+you\s+think",
        r"(?i)up\s+to\s+you",
        r"(?i)take\s+it\s+or\s+leave",
        r"(?i)fwiw",
    ]

    for pattern in low_patterns:
        if re.search(pattern, body):
            return "low"

    # Default to medium for non-bot comments without clear indicators
    return "medium"


def extract_feedback_item(
    body: str,
    author: str,
    path: str | None = None,
    line: int | None = None,
    url: str | None = None,
    is_resolved: bool = False,
    is_outdated: bool = False,
    review_bot: bool = False,
) -> dict[str, Any]:
    """Create a standardized feedback item."""
    # Truncate long bodies for summary
    summary = body[:200] + "..." if len(body) > 200 else body
    summary = summary.replace("\n", " ").strip()

    item = {
        "author": author,
        "body": summary,
        "full_body": body,
    }

    if path:
        item["path"] = path
    if line:
        item["line"] = line
    if url:
        item["url"] = url
    if is_resolved:
        item["resolved"] = True
    if is_outdated:
        item["outdated"] = True
    if review_bot:
        item["review_bot"] = True

    return item


def build_thread_item(thread: dict[str, Any], pr_author: str) -> dict[str, Any] | None:
    """Turn a review thread into a feedback item carrying its whole comment chain.

    ``full_body`` is the comment being *responded to* — the first one not written by
    the PR author, so a thread the author opened as diff commentary is presented by
    the reviewer's reply rather than by the author's own note. ``thread`` holds every
    comment in order, including the author's, so the reply reads in context.
    """
    comments = (thread.get("comments") or {}).get("nodes") or []
    comments = [c for c in comments if (c.get("body") or "").strip()]
    if not comments:
        return None

    chain = [
        {
            "author": (c.get("author") or {}).get("login", "") or "unknown",
            "body": c.get("body", ""),
            "created_at": c.get("createdAt"),
            "url": c.get("url"),
        }
        for c in comments
    ]
    for entry in chain:
        entry["is_pr_author"] = entry["author"] == pr_author

    # The actionable comment is the first one from someone other than the author.
    actionable = next((e for e in chain if not e["is_pr_author"]), None)
    opener = chain[0]

    item = extract_feedback_item(
        body=(actionable or opener)["body"],
        author=(actionable or opener)["author"],
        path=thread.get("path"),
        line=thread.get("line") or thread.get("originalLine"),
        url=(actionable or opener).get("url"),
        is_resolved=bool(thread.get("isResolved")),
        is_outdated=bool(thread.get("isOutdated")),
    )
    item["thread_id"] = thread.get("id")
    item["thread"] = chain
    item["comment_count"] = len(chain)
    item["started_by_pr_author"] = opener["is_pr_author"]
    item["has_reviewer_comment"] = actionable is not None
    item["last_comment_by"] = chain[-1]["author"]
    item["awaiting_author_reply"] = not chain[-1]["is_pr_author"]

    diff_hunk = comments[0].get("diffHunk")
    if diff_hunk:
        item["diff_hunk"] = diff_hunk

    return item


def main():
    parser = argparse.ArgumentParser(description="Fetch and categorize PR feedback")
    parser.add_argument("--pr", type=int, help="PR number (defaults to current branch PR)")
    args = parser.parse_args()

    # Get repo info
    repo_info = get_repo_info()
    if not repo_info:
        print(json.dumps({"error": "Could not determine repository"}))
        sys.exit(1)
    owner, repo = repo_info

    # Get PR info
    pr_info = get_pr_info(args.pr)
    if not pr_info:
        print(json.dumps({"error": "No PR found for current branch"}))
        sys.exit(1)

    pr_number = pr_info["number"]
    pr_author = pr_info.get("author", {}).get("login", "")

    # Get review decision
    review_decision = pr_info.get("reviewDecision", "")

    # Categorized feedback using LOGAF scale
    feedback = {
        "high": [],           # Must address before merge
        "medium": [],         # Should address
        "low": [],            # Optional suggestions
        "bot": [],
        "resolved": [],
        "author_notes": [],   # PR author's own inline threads, no reviewer reply yet
    }

    # Process reviews for overall status
    reviews = pr_info.get("reviews", [])
    for review in reviews:
        if review.get("state") == "CHANGES_REQUESTED":
            author = review.get("author", {}).get("login", "")
            body = review.get("body", "")
            if body and author != pr_author:
                item = extract_feedback_item(body, author)
                item["type"] = "changes_requested"
                feedback["high"].append(item)

    # Get review threads (inline comments with resolution status)
    threads = get_review_threads(owner, repo, pr_number)
    seen_thread_ids = set()

    for thread in threads:
        item = build_thread_item(thread, pr_author)
        if item is None:
            continue

        author = item["author"]
        body = item["full_body"]

        # Skip empty or very short comments
        if len(body.strip()) < 3:
            continue

        thread_id = item.get("thread_id")
        if thread_id:
            seen_thread_ids.add(thread_id)

        # A thread with no comment from anyone but the PR author is the author's own
        # inline diff commentary, not feedback. It is kept in its own bucket rather
        # than dropped: the walkthrough needs it as context, and once a reviewer
        # replies the thread moves into the priority buckets on the reply.
        if not item["has_reviewer_comment"]:
            feedback["author_notes"].append(item)
            continue

        if item.get("resolved"):
            feedback["resolved"].append(item)
        elif is_review_bot(author):
            category = categorize_comment({"author": {"login": author}}, body)
            item["review_bot"] = True
            feedback[category].append(item)
        elif is_info_bot(author):
            feedback["bot"].append(item)
        else:
            category = categorize_comment({"author": {"login": author}}, body)
            feedback[category].append(item)

    # Get issue comments (general PR conversation)
    issue_comments = get_issue_comments(owner, repo, pr_number)

    for comment in issue_comments:
        author = comment.get("user", {}).get("login", "")
        body = comment.get("body", "")

        # Skip if author is PR author
        if author == pr_author:
            continue

        # Skip empty comments
        if not body or len(body.strip()) < 3:
            continue

        item = extract_feedback_item(
            body=body,
            author=author,
            url=comment.get("html_url"),
        )

        if is_review_bot(author):
            category = categorize_comment(comment, body)
            item["review_bot"] = True
            feedback[category].append(item)
        elif is_info_bot(author):
            feedback["bot"].append(item)
        else:
            category = categorize_comment(comment, body)
            feedback[category].append(item)

    # Count review bot items across priority buckets
    review_bot_count = sum(
        1 for bucket in ("high", "medium", "low")
        for item in feedback[bucket]
        if item.get("review_bot")
    )

    # Build output
    output = {
        "pr": {
            "number": pr_number,
            "url": pr_info.get("url", ""),
            "author": pr_author,
            "review_decision": review_decision,
        },
        "summary": {
            "high": len(feedback["high"]),
            "medium": len(feedback["medium"]),
            "low": len(feedback["low"]),
            "bot_comments": len(feedback["bot"]),
            "resolved": len(feedback["resolved"]),
            "author_notes": len(feedback["author_notes"]),
            "review_bot_feedback": review_bot_count,
            "needs_attention": len(feedback["high"]) + len(feedback["medium"]),
            "with_replies": sum(
                1 for bucket in ("high", "medium", "low", "resolved")
                for item in feedback[bucket]
                if item.get("comment_count", 1) > 1
            ),
        },
        "feedback": feedback,
    }

    # Add actionable summary based on LOGAF priorities
    if feedback["high"]:
        output["action_required"] = "Address high-priority feedback before merge"
    elif feedback["medium"]:
        output["action_required"] = "Address medium-priority feedback"
    elif feedback["low"]:
        output["action_required"] = "Review low-priority suggestions - ask user which to address"
    else:
        output["action_required"] = None

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
