#!/usr/bin/env bash
set -euo pipefail

# Push the current project to GitHub: fivves/d3
GITHUB_USER="${GITHUB_USER:-fivves}"
REPO_NAME="${REPO_NAME:-d3}"
BRANCH="${BRANCH:-main}"
REPO_SSH="git@github.com:${GITHUB_USER}/${REPO_NAME}.git"
REPO_HTTPS="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo "Preparing to push to GitHub: ${GITHUB_USER}/${REPO_NAME} (branch: ${BRANCH})"

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed"; exit 1
fi

if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
  git add -A
  git commit -m "Initial commit for D3 home-lab deployment"
fi

if git remote | grep -q '^origin$'; then
  git remote set-url origin "$REPO_SSH" 2>/dev/null || true
else
  git remote add origin "$REPO_SSH" 2>/dev/null || {
    git remote add origin "$REPO_HTTPS";
  }
fi

echo "Fetching origin..."
git fetch origin || true

if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to push."; exit 0
fi

echo "Staging and committing changes..."
git add -A
git diff --cached --quiet || git commit -m "Update D3 for homelab deployment: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || true

echo "Pushing to origin/${BRANCH}..."
git push -u origin "$BRANCH" || {
  echo "Push failed. Please ensure SSH access to GitHub is configured and the branch exists."
  exit 1
}


