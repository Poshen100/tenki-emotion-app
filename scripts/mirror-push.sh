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

# --all 只涵蓋 refs/heads/*；tag 要另外推。兩個都做才算完整副本。
echo "推送所有分支…"
git push --all "$auth_url"
echo "推送所有 tag…"
git push --tags "$auth_url"

echo
echo "🟢 推完了。核對兩邊的 ref："
echo "   git ls-remote '$MIRROR_REMOTE'   # 需要憑證時用瀏覽器看也行"
echo "   git show-ref                     # 本機"
echo
echo "⚠️ 鏡像要**定期真的推**。沒有被推過的鏡像等於不存在。"
