#!/usr/bin/env bash
#
# dsh-token-usage — one-click installer
#
# Usage:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/KeFan-J/dsh-token-usage/main/install.sh)"
#   or install to a custom directory:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/KeFan-J/dsh-token-usage/main/install.sh)" - /path/to/dir
#
set -euo pipefail

REPO_URL="https://github.com/KeFan-J/dsh-token-usage.git"
INSTALL_DIR="${1:-$HOME/dsh-token-usage}"

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

say "dsh-token-usage 一键安装 / One-click install"

# 1. prerequisites
command -v dsh >/dev/null 2>&1 || die "未找到 dsh 命令 / dsh not found — install DeepSeek Harness first (npx @deepseek-ai/dsh)"
command -v git >/dev/null 2>&1 || die "git not found"
command -v pnpm >/dev/null 2>&1 || {
  say "pnpm not found, trying corepack…"
  command -v corepack >/dev/null 2>&1 && corepack enable pnpm 2>/dev/null || true
  command -v pnpm >/dev/null 2>&1 || die "pnpm not found — install with: npm install -g pnpm"
}

# 2. fetch the code (clone, or update if already present)
if [ -d "$INSTALL_DIR/.git" ]; then
  say "Directory exists, updating: $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only
else
  say "Cloning to: $INSTALL_DIR"
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi

# 3. install dependencies (none required today, kept for future use)
say "Installing dependencies…"
(cd "$INSTALL_DIR" && pnpm install --frozen-lockfile=false >/dev/null || pnpm install)

# 4. mount into the DSH web profile (bundle layer)
say "Mounting into the DSH web profile…"
if ! dsh plugin --profile web add "link:$INSTALL_DIR" 2>/dev/null; then
  dsh plugin --profile web add "$INSTALL_DIR"
fi

ok "Installation complete!"
echo ""
echo "   接下来 / Next steps:"
echo "   1. Restart DSH: Ctrl+C in the terminal, then run: npx @deepseek-ai/dsh web"
echo "   2. Hard-refresh the browser (Cmd+Shift+R)"
echo "   3. Open Settings (gear icon) → 「Token 用量」"
echo ""
echo "   更新插件 / Update: re-run this command (auto git pull + remount)"
