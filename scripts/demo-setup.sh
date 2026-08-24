#!/usr/bin/env bash
# 시연용 개발 환경을 만든다. 실제 홈 디렉터리는 건드리지 않는다.
#
# 어댑터는 host.homedir(= NodeHost에서 os.homedir())만 보고, POSIX에서 os.homedir()는
# $HOME을 따른다. 그래서 HOME만 바꿔 띄우면 앱 코드를 한 줄도 고치지 않고 격리된다.
# 스냅샷(~/.nosy)도 같이 따라오므로 드리프트 기준선까지 실제 환경과 섞이지 않는다.
#
#   ./scripts/demo-setup.sh setup    깨진 rc 파일을 만든다
#   ./scripts/demo-setup.sh drift    새 문제를 하나 추가한다 (드리프트 시연용)
#   ./scripts/demo-setup.sh clean    이 스크립트가 만든 것만 지운다

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_HOME="${NOSY_DEMO_HOME:-$REPO_ROOT/.demo-home}"
RC="$DEMO_HOME/.zshrc"

usage() {
  echo "usage: $(basename "$0") {setup|drift|clean}" >&2
  exit 64
}

cmd_setup() {
  mkdir -p "$DEMO_HOME/bin"

  # 살아있는 대상 — 어댑터가 "존재함"으로 올바르게 판정해야 하는 대조군이다.
  printf '# demo stub\n' > "$DEMO_HOME/.aliases.sh"

  cat > "$RC" <<'EOF'
# --- Nosy 시연용 환경 (scripts/demo-setup.sh가 생성) ---

# 정상: 실제로 존재하는 파일과 디렉터리
source $HOME/.aliases.sh
export PATH="$HOME/bin:/usr/bin:/bin"

# error: 예전 머신에만 있던 설정을 아직 source하고 있다
source /opt/acme-toolchain/env.sh

# warn: 같은 PATH 항목이 두 번 들어갔고, 없는 디렉터리도 하나 섞였다
export PATH="/usr/local/bin:/usr/local/bin:$HOME/.local/gone-bin"

# warn: 사내에서 제거된 CLI를 아직 가리키는 alias
alias deploy='/usr/local/bin/acme-deploy'

# warn: ll이 두 번 정의되어 뒤엣것이 앞엣것을 덮는다
alias ll='ls -la'
alias gs='git status'
alias ll='ls -lah'
EOF

  echo "생성: $RC"
  cat <<EOF

데모 홈: $DEMO_HOME

  HOME="$DEMO_HOME" pnpm --filter @nosy/pet dev

로 띄우면 펫이 이 환경을 진단한다. 그냥 'pnpm dev'로 띄우면 평소 환경을 본다.
EOF
}

cmd_drift() {
  [ -f "$RC" ] || { echo "먼저 setup을 실행하라 — $RC 가 없다" >&2; exit 1; }

  cat >> "$RC" <<'EOF'

# drift: 방금 새로 생긴 문제 (누군가 설치 스크립트를 돌리고 남긴 줄)
source /opt/homebrew/opt/nosy-demo-tool/init.sh
EOF

  echo "새 error 1건을 추가했다: $RC"
  echo "메뉴바 → '지금 진단하기'를 누르면 드리프트로 잡힌다."
}

# 재귀 삭제를 쓰지 않는다. 이 스크립트가 만든 것만 이름으로 지우고,
# 빈 디렉터리만 rmdir로 걷어낸다 — 사용자가 DEMO_HOME을 엉뚱한 곳으로 지정해도 안전하다.
cmd_clean() {
  rm -f -- "$RC" "$DEMO_HOME/.aliases.sh"
  rm -f -- "$DEMO_HOME"/.zshrc.bak.*                    # fix 실행이 남긴 백업
  rm -f -- "$DEMO_HOME/.nosy/snapshots/latest.json"

  rmdir "$DEMO_HOME/bin" "$DEMO_HOME/.nosy/snapshots" "$DEMO_HOME/.nosy" "$DEMO_HOME" 2>/dev/null || true

  if [ -d "$DEMO_HOME" ]; then
    echo "이 스크립트가 만든 파일은 지웠다. 남은 것이 있어 $DEMO_HOME 자체는 두었다:"
    ls -A "$DEMO_HOME"
  else
    echo "삭제: $DEMO_HOME"
  fi
}

case "${1:-}" in
  setup) cmd_setup ;;
  drift) cmd_drift ;;
  clean) cmd_clean ;;
  *) usage ;;
esac
