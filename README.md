# TypeMaster Quest · 打字冒險

以 Duolingo 風格打造的美觀、互動打字練習網站。支援段落練習、即時 WPM 與準確率、等級與 XP、獎勵解鎖、深色模式，適合部署於 GitHub Pages（純前端靜態）。

## 功能特色
- 遊戲化練習：WPM、準確率、進度條、XP、升級條件
- 段落檔 `passages.json`：可自行新增繁中或英文段落
- 獎勵檔 `rewards.json`：自訂徽章、主題、貨幣或音訊獎勵
- 本機儲存：等級、XP、解鎖獎勵、最高紀錄
- RWD 與深色模式：手機亦好用

## 專案結構
```
/index.html
/style.css
/script.js
/passages.json
/rewards.json
/lib/particles.min.js
```

## 本機開啟
1. 下載或 clone 本專案
2. 直接以瀏覽器開啟 `index.html`

## 部署到 GitHub Pages
1. 建立 GitHub 儲存庫（例如 `typemaster-quest`）
2. 將上述所有檔案推上去
3. 到儲存庫 Settings → Pages：
   - Source 選擇 `Deploy from a branch`
   - Branch 選擇 `main` 與根目錄 `/`
4. 儲存後等待約 1 分鐘
5. 造訪 `https://<你的帳號>.github.io/typemaster-quest`

## 新增段落（passages.json）
- 欄位：`id`、`level`、`lang`（`zh-Hant`/`en`）、`title`、`preview`、`text`
- 範例：
```json
{
  "id": "l1-06",
  "level": 1,
  "lang": "zh-Hant",
  "title": "星光夜行",
  "preview": "抬頭是滿天星，腳下是回家的路",
  "text": "抬頭是滿天星，腳下是回家的路。夜風像一首輕歌，陪伴我跨過每個轉角。"
}
```

## 自訂獎勵（rewards.json）
```json
{
  "level1": { "type": "badge", "name": "Green Leaf", "description": "Your first sprout!" },
  "level2": { "type": "theme", "name": "Ocean Blue" }
}
```
- `type`：`badge`、`theme`、`currency`、`audio`
- 解鎖時機：升到對應等級即解鎖 `levelX` 對應項目

## 常見問題
- 若瀏覽器阻擋音效，請先點擊頁面或按下任何鍵
- 若 Pages 無法載入 JSON，請確認檔案路徑使用相對路徑（如 `./passages.json`）且位於專案根目錄

## 授權
本專案為教學示例，歡迎 fork 與修改使用。
