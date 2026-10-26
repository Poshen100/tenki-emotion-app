#!/usr/bin/env bash
#
# mirror-push.sh —— 把所有 ref 推到第二個 git remote（鏡像）。
#
# 為什麼需要它：2026-10-16 GitHub 帳號被停權，推送／PR／CI／Vercel 新部署
# 全斷了好幾天（docs/VENDOR-RISK.md）。當時 repo 只有一個 remote，
# 等於整個專案的可寫入副本只有一份。鏡像就是第二份。
#
# 🔴 **憑證不從命令列、也不從對話來。** 兩個值都讀環境變數，而它們應該放在
# 雲端環境的 Network secrets / 環境變數裡（session 標題列 → 環境選單 → Edit）：
#
#   MIRROR_REMOTE  鏡像 repo 的 HTTPS URL，例：https://gitlab.com/<user>/<repo>.git
#   MIRROR_TOKEN   有 write_repository 權限的 token
#
# 🔴 **GitLab 免費版要用 Personal Access Token。** 查證過的三選一：
#      Project Access Token  → GitLab.com 上限 Premium/Ultimate，免費版沒有
#      Deploy Token          → 免費版有，但 git 存取**唯讀**，推不上去
#      Personal Access Token → 免費版可用 ✅
#    ⚠️ 「Generate token」是個下拉，底下還分兩種，**兩種都推得動**：
#      Fine-grained token（建議）→ 只給指定群組/專案；**Code 權限設成 Push**
#      Legacy token             → 涵蓋該帳號所有專案；只勾 `write_repository`
#    （GitLab 對 git over HTTPS 不驗使用者名稱，所以下面的 `oauth2:` 兩種都吃。）
#    （2026-10 查的，方案內容會變；真的看得到 Project Access Token 就用它，
#     範圍更小更好。）
#    ⚠️ PAT 涵蓋該帳號所有 repo，所以**設一個到期日**。
#
# ⚠️ 這支**絕不印出 token**，也不把帶憑證的 URL 寫進 .git/config
#    （用 `git push <url>` 的一次性形式，不 `git remote add`）。
#
# ⚠️ **建鏡像 project 時若勾了 "Initialize repository with a README"**，對面的
#    `main` 上會有一顆我們沒有的 commit，跟本機歷史**沒有共同祖先**。
#    git 會在本機端直接拒絕（non-fast-forward），訊息是制式的
#    「Updates were rejected…」，看起來像憑證壞掉，其實不是。
#    下面的 preflight 會先攔下來並說清楚；要覆寫就 `MIRROR_FORCE=1`。
#    （2026-10-26 實際踩到：founder 的 GitLab project 帶了 README。）
#
# ⚠️ 本 repo 的 .git 約 300MB（歷史裡有 node_modules 與 3D 資產，詳見
#    VENDOR-RISK §2），第一次推可能很久、也可能中斷。**這支可以重跑** ——
#    git push 本身冪等，已經在對面的物件不會重傳。
#
# Run:  bash scripts/mirror-push.sh
set -euo pipefail

missing=()
[ -n "${MIRROR_REMOTE:-}" ] || missing+=("MIRROR_REMOTE")
[ -n "${MIRROR_TOKEN:-}"  ] || missing+=("MIRROR_TOKEN")

if [ ${#missing[@]} -gt 0 ]; then
  echo "🔴 鏡像還沒設定 —— 缺少：${missing[*]}"
  echo
  echo "設定方式（不要把 token 貼進對話）："
  echo "  1. 在 GitLab 建一個空的 private project（不要勾 README/.gitignore）"
  echo "     https://gitlab.com/projects/new#blank_project"
  echo "  2. 產一個 **Personal** Access Token，scope 勾 write_repository"
  echo "     （免費版沒有 Project Access Token；Deploy Token 推不了，只能讀）"
  echo "     https://gitlab.com/-/user_settings/personal_access_tokens"
  echo "     🔴 token 只顯示一次，當場複製；記得設到期日"
  echo "  3. session 標題列的雲端環境選單 → Edit → 加這兩個變數："
  echo "       MIRROR_REMOTE = 那個 project 的 HTTPS URL"
  echo "       MIRROR_TOKEN  = 剛才那個 token"
  echo "  4. 開一個新 session（舊 session 讀不到新變數）"
  echo
  echo "詳見 docs/VENDOR-RISK.md §2 ①"
  exit 2
fi

# 把 token 塞進 URL 的 userinfo。oauth2 是 GitLab 的慣例；
# 其他家若不吃這個使用者名稱，改這一行即可。
case "$MIRROR_REMOTE" in
  https://*) auth_url="https://oauth2:${MIRROR_TOKEN}@${MIRROR_REMOTE#https://}" ;;
  *)
    echo "🔴 MIRROR_REMOTE 必須是 https:// 開頭（拿到的是另一種格式）"
    exit 2
    ;;
esac

# 🔴 只印不含憑證的那一份。
echo "→ 鏡像：${MIRROR_REMOTE}"
echo "→ 本機 ref：$(git show-ref | wc -l) 個"
echo

# ── preflight：先問對面有什麼，再決定推不推得動 ──────────────────────
#
# 兩個目的：
#   1. 這是第一個用到憑證的動作。token 錯的話**在這裡**就乾淨地失敗，
#      而不是等 300MB 傳到一半才知道。
#   2. 對面若已經有我們沒有的 commit（最常見：建 project 時勾了 README），
#      push 會被 non-fast-forward 擋下來。與其讓 git 吐制式訊息，
#      不如自己把「對面有什麼、為什麼擋住、兩條路怎麼走」講清楚。
echo "問對面現在有哪些分支…"
if ! remote_heads="$(git ls-remote --heads "$auth_url" 2>&1)"; then
  echo "🔴 連不上鏡像，或憑證不被接受。"
  # 🔴 git 的錯誤訊息會把整個 URL 印出來（因而含 token）—— 洗掉再印。
  #    用樣式比對而不是比對 token 本身，這樣 token 長什麼樣都洗得掉。
  printf '%s\n' "$remote_heads" | sed 's|oauth2:[^@]*@|oauth2:***@|g'
  echo
  echo "常見原因：token 打錯／過期／權限不足（要 write_repository 或 Code→Push）"
  exit 1
fi

force_flag=""
if [ -n "$remote_heads" ]; then
  blocked=0
  while read -r sha ref; do
    [ -n "$sha" ] || continue
    # 本機連這顆 commit 的物件都沒有 → 它**不可能**是本機任何分支的祖先，
    # 推上去必被拒。（物件有、但不是祖先的情形 git 自己也會在傳輸前擋下，
    #   訊息同樣清楚，所以這裡不重複實作祖先檢查。）
    if ! git cat-file -e "${sha}^{commit}" 2>/dev/null; then
      blocked=1
      echo "   ⚠️ 對面的 ${ref} 是 ${sha:0:8}，本機沒有這顆 commit"
    fi
  done <<EOF
$remote_heads
EOF

  if [ "$blocked" = 1 ]; then
    if [ "${MIRROR_FORCE:-}" = "1" ]; then
      echo "   → MIRROR_FORCE=1：改用 force，把鏡像對齊成本機的精確副本。"
      force_flag="--force"
    else
      echo
      echo "🔴 鏡像上有本機沒有的東西，直接推會被 non-fast-forward 擋下來。"
      echo "   （還沒送出任何物件。）"
      echo
      echo "兩條路，挑一條："
      echo "  a) 覆寫鏡像 —— 鏡像本來就該是本機的精確副本："
      echo "       MIRROR_FORCE=1 bash scripts/mirror-push.sh"
      echo "     ⚠️ 對面那些 commit 會不見。確定它們是拋棄式的（例如建 project"
      echo "        時自動產生的 README）再做。"
      echo "  b) 在鏡像上把那些 commit 砍掉／把 project 砍掉重建成空的，再重跑這支。"
      exit 3
    fi
  fi
fi

echo
# --all 只涵蓋 refs/heads/*；tag 要另外推。兩個都做才算完整副本。
echo "推送所有分支…"
# shellcheck disable=SC2086  # force_flag 是空字串時要展開成「沒有這個參數」
git push $force_flag --all "$auth_url"
echo "推送所有 tag…"
git push $force_flag --tags "$auth_url"

echo
echo "🟢 推完了。核對兩邊的 ref："
echo "   git ls-remote '$MIRROR_REMOTE'   # 需要憑證時用瀏覽器看也行"
echo "   git show-ref                     # 本機"
echo
echo "⚠️ 鏡像要**定期真的推**。沒有被推過的鏡像等於不存在。"
