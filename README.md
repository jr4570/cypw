# 程閱安全智慧票務與防偽核銷管理系統 (ChengYue Secure Pass)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-green.svg)](https://expressjs.com/)

具備前台活動購票、親友安全贈券、多裝置資料同步、後台營運分析、相機自動掃描核銷及**防偽核銷紀錄匯出 CSV 報表**的完整全端智慧票務系統。

---

## 🌟 核心功能特色 (Key Features)

### 1. 🎫 雙重身分入口與即時多端同步
- **消費者購票錢包 (Client / Attendee Wallet)**：
  - 瀏覽熱門活動、座位分區選擇、一鍵訂票。
  - 「我的電子票夾」：支援動態防偽 QR 條碼、入場時間記錄、歷史軌跡查詢。
  - **安全贈送 / 轉贈票券**：原票券即刻作廢，系統自動為受贈人簽署全新的防偽條碼，徹底杜絕截圖重複入場（防雙花 Double-spending）。
  - **跨裝置資料同步**：帳號、票券、歷史資料儲存於雲端伺服器資料庫。在電腦買票，以同一帳號登入手機、平板或另一台瀏覽器，票券即時完整呈現，絕不遺失。
- **主辦方後台管理控制台 (Admin / Control Panel)**：
  - 儀表板總覽：總營收、票券銷量、進場核銷率、即時銷量趨勢圖。
  - 活動管理：新增活動、自訂分區配額與加權票價、活動審核機制（待審核／公開上架／封存）。
  - 使用者權限安全中心：管理員、驗票人員（Scanner）、買家角色分配與帳號管理。

---

### 2. 🛡️ 密碼學防偽核銷閘道 (Anti-Counterfeit Check-In Gate)
- **HMAC-SHA256 動態簽名票券**：
  - 條碼格式採密碼學雜湊簽章 `TIX-EVT_ID-USR_ID-SERIAL-SIG`。
  - 驗票閘口以伺服器端密鑰對條碼進行防偽驗證，若條碼遭篡改或偽造，閘口立即顯示紅色「❌ 票券核簽驗證失敗」並拒絕放行。
- **防止重複入場警報 (Duplicate Prevention)**：
  - 票券一旦核銷，狀態即時標記為 `checked_in` 並記錄時間戳。
  - 重複刷卡立即觸發醒目警報視窗「⚠️ 重複核銷警報」，顯示前次進場時間與登記持票人姓名。
- **多模式核銷相容**：
  - **相機鏡頭自動掃描**：呼叫手機後置鏡頭或外接 WebCam 自動連續辨識。
  - **圖片上傳 / 原生拍照解碼**：環境不支援相機 API 時，點擊即可拍照或上傳 QR Code 圖片直接解碼。
  - **手動輸碼核銷**：支援手動輸入票號進行補登與銷帳。

---

### 3. 📊 當前活動核銷紀錄匯出 CSV 報表 (New!)
在 `AdminScan` 驗票組件中，提供主辦方完整的離線備份與稽核報表工具：
- **活動下拉篩選**：可選擇「全部活動」或單一指定活動，即時顯示該場次的核銷進度。
- **即時指標總覽**：總驗票數、成功放行數、重複進場警報數、無效/拒絕阻擋數。
- **一鍵匯出 CSV 報表 (`.csv`)**：
  - 包含 **UTF-8 BOM (`\uFEFF`)** 編碼，直接以 Microsoft Excel、Apple Numbers 或 Google 試算表開啟**保證繁體中文絕不亂碼**。
  - 完整稽核欄位：`序號`、`核銷時間`、`活動名稱`、`活動編號`、`票券代碼`、`核銷狀態`、`持票人姓名`、`持票人信箱`、`聯絡電話`、`座位分區`、`座位編號`、`票價`、`驗票設備/閘道`、`防偽檢驗備註`。
  - 伺服器端串流下載 + 前端離線備用生成器雙軌機制，斷網或離線時依然能正常匯出！
- **即時核銷流水號審計日誌**：支援即時搜尋票號、持票人姓名或座位，一鍵快速複製票號。

---

### 4. 🔒 高安全隱私與個資防護
- **AES-256-CBC 欄位級加密**：資料庫儲存之姓名、電話等個人資訊（PII）皆經 AES-256 密碼學加密儲存，資料庫外洩亦無法讀取明文。
- **加鹽 HMAC-SHA256 密碼保護**：使用者密碼經獨有郵件鹽值雜湊處理，不儲存明文密碼。
- **7 天帳號註銷冷靜期保護**：符合個資隱私權法規，申請刪除後有 7 天冷靜期，期間重新登入自動撤銷刪除申請並復原帳號；屆滿自動硬刪除。

---

### 5. 💡 演示模式 (Demo Mode) 與 正式營運模式 (Production Mode)

| 特性 | 演示模式 (Demo Mode) - 系統預設 | 非演示 / 正式營運模式 (Production Mode) |
| :--- | :--- | :--- |
| **用途** | 開源體驗、功能驗收、快速測試 | 正式活動發售、真實購票核銷營運 |
| **標題識別** | **全站頁首標題旁顯示「演示版」醒目標籤**，瀏覽器分頁標題同步標註 `(演示版)` | 移除「演示版」標籤，顯示純淨商業品牌抬頭 |
| **測試帳號** | 登入頁面提供「一鍵填入標準演示帳密」卡片 | 隱藏示範帳號，提示自訂註冊正式帳號 |
| **示範活動** | 預載跨年、AI 峰會、嘉年華示範活動數據 | 清空所有示範活動，僅顯示主辦方真實新增之活動 |
| **雲端演示鎖定** | **線上託管環境自動鎖定開啟演示模式**，防止多訪客互擾 | 需於自建環境設定 `SELF_HOSTED=true` 即可解鎖關閉 |

> 📌 **部署環境演示鎖定機制說明**：
> - **線上託管／Demo 部署（如 Cloudflare 公開演示）**：預設啟用 `demoLocked` 防護，**防止訪客關閉演示模式**或清空資料庫，確保所有造訪者均享有完整的測試帳密與票券核銷體驗。
> - **自行私有化部署 (Self-Hosted)**：在伺服器環境變數設定 `SELF_HOSTED=true` 或 `DEMO_LOCKED=false`，超級管理員控制中心即自動解鎖，您可隨心所欲自由開啟或關閉演示模式！

---

## 🔑 預設演示帳號 (Standard Demo Credentials)

演示模式啟動時（預設），系統提供以下經過安全雜湊初始化的帳號：

### 🏆 主辦管理員 (Admin)
- **帳號**：`admin@ticket.com`
- **密碼**：`admin123`
- *(工作人員主管帳號：`staff@ticket.com` / `staff123`)*

### 👤 示範買家 (Customer)
- **帳號**：`user@ticket.com`
- **密碼**：`user123`
- *(別名相容帳號：`customer@ticket.com` / `123456`)*

---

## 🛠️ 技術架構 (Technology Stack)

```
chengyue-secure-pass/
├── server.ts                  # 全端 Express API 伺服器 (AES 加密、HMAC 驗證、CSV 串流、REST API)
├── src/
│   ├── components/
│   │   ├── AdminScan.tsx      # 相機掃描核銷、防偽比對、即時審計日誌、CSV 報表匯出
│   │   ├── AdminDashboard.tsx # 營收數據、銷量趨勢、即時監控儀表板
│   │   ├── AdminEvents.tsx    # 活動建立、分區票價配額設定
│   │   ├── AdminLogin.tsx     # 主辦方登入/註冊、演示憑證一鍵填入
│   │   ├── SuperAdminSettings.tsx # 全域設定、正式模式切換、展示資料庫重置
│   │   ├── UserEvents.tsx     # 前台活動瀏覽、分區選位、購票下單
│   │   ├── UserWallet.tsx     # 我的電子票夾、QR 票券展示、安全贈券轉贈
│   │   ├── UserFavorites.tsx  # 活動收藏清單
│   │   ├── UserSettings.tsx   # 個人資料修改、密碼變更、7天冷靜期帳號註銷
│   │   └── UserLogin.tsx      # 買家會員登入/註冊、演示憑證一鍵填入
│   ├── types.ts               # TypeScript 介面定義 (Ticket, Event, CheckInLog)
│   ├── App.tsx                # 主程式控制器、跨端 Session 認證同步、導覽切換
│   └── main.tsx               # 前端進入點
├── data/                      # 永久資料庫儲存目錄 (自動建立)
│   └── ticketing_database.json # 持久化資料庫檔案
├── vite.config.ts             # Vite 建置配置
├── package.json               # 專案依賴與腳本
└── README.md                  # 專案開源說明文件
```

---

## 🚀 本機安裝與開發 (Local Installation)

### 環境需求
- [Node.js](https://nodejs.org/) v18.0.0 或更高版本
- npm 或 yarn 或 bun

### 步驟 1：複製儲存庫
```bash
git clone https://github.com/your-username/chengyue-secure-pass.git
cd chengyue-secure-pass
```

### 步驟 2：安裝相依套件
```bash
npm install
```

### 步驟 3：設定環境變數 (選用)
複製 `.env.example` 為 `.env`：
```bash
cp .env.example .env
```
主要參數說明：
- `SELF_HOSTED`：設為 `"true"` 解除線上託管演示鎖定，允許管理員於後台自由關閉演示模式或清空示範資料。
- `DEMO_LOCKED`：設為 `"false"` 強制解除演示模式鎖定（或設為 `"true"` 強制鎖定）。
- `PORT`：服務通訊埠（預設 3000）
- `DATA_DIR`：資料庫儲存目錄（預設 `./data`）
- `DATA_FILE`：指定資料庫 JSON 檔案路徑
- `MASTER_KEY`：AES-256-CBC 個資加密主密鑰
- `HMAC_SECRET`：票券防偽簽署密鑰
- `GEMINI_API_KEY`：Google Gemini AI 撰稿輔助 API 金鑰（選用）

### 步驟 4：啟動本機開發伺服器
```bash
npm run dev
```
瀏覽器開啟：`http://localhost:3000`

---

## 📦 生產環境建置與部署 (Production Deployment)

### 1. 全端生產打包 (Fullstack Build)
```bash
npm run build
```
此指令會：
1. 編譯前端 React SPA 至 `dist/`。
2. 以 esbuild 打包後端 `server.ts` 為 `dist/server.cjs`。

啟動正式服務：
```bash
npm run start
```

### 2. 容器化 Docker 部署 (推薦)
在專案根目錄建立 `Dockerfile`：
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
VOLUME ["/app/data"]
CMD ["npm", "run", "start"]
```
建置並執行：
```bash
docker build -t chengyue-pass .
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name chengyue-ticket-app chengyue-pass
```

### 3. 雲端平台一鍵部署
- **Render / Railway / Fly.io / Heroku**：
  - Build Command: `npm run build`
  - Start Command: `npm run start`
  - 勾選 Persistent Disk 掛載至 `/app/data` 確保資料重啟時不流失。
- **Cloudflare Pages & Workers**：
  - 前端靜態頁面：將專案連接至 Cloudflare Pages，設定 Build command 為 `npm run build`，Build output directory 為 `dist`。
  - 後端 API 與持久化：搭配 Cloudflare Workers / Node.js 容器執行 `dist/server.cjs`。
  - **預設狀態**：搭建部署完畢時**預設即為演示模式**，並自動鎖定防止被其他訪客關閉。
  - **解鎖自訂**：若為自己獨立部署，在 Cloudflare Pages / Workers 的 Environment Variables 中新增 `SELF_HOSTED=true`，後台即會解鎖開關，允許自由關閉演示模式。
- **Netlify / Vercel**：
  - 若採純靜態前端託管，建置輸出目錄設定為 `dist`。
  - 後端 API 可反向代理至獨立 Node 伺服器，或利用 Netlify Functions。

---

## 📋 常用操作指引

### Q1：如何將系統切換為「非演示正式營運模式」？
1. 若處於自己部署的環境，請確認環境變數已設定 `SELF_HOSTED=true`（託管演示版預設鎖定防止關閉）。
2. 以管理員身分登入後台。
3. 進入上方導覽列「超級管理員系統控制中心 (⚙️)」標籤。
4. 點擊「清空展示資料並切換非演示正式模式」按鈕，或切換演示模式開關為關閉。
5. 系統將清空所有 `@ticket.com` 測試帳號、示範活動與票券，保留您的管理員帳號，開啟乾淨的正式營運環境。

### Q2：如何匯出驗票核銷 CSV 報表？
1. 以管理員或驗票員身分進入「核銷驗票 (QR Code)」頁面。
2. 上方選單選擇想稽核的活動（例如「2026 臺北跨年巨星演唱會」）或「全部活動」。
3. 點擊右上角綠色的 **「匯出核銷報表 (CSV)」** 按鈕。
4. 瀏覽器將自動下載包含 UTF-8 BOM 編碼的 CSV 檔案，可直接使用 Excel 開啟分析。

### Q3：換裝置或更換手機，我的帳號與票券會遺失嗎？
不會！系統將所有註冊帳戶、購買的票券、贈券鏈以及核銷進場狀態儲存於中央資料庫。在任何新裝置上開啟本平台，使用相同 Email 與密碼登入，所有票券、核銷狀態即刻完整載入。

---

## 📄 開源授權協議 (License)

本專案基於 [Apache-2.0 License](LICENSE) 授權條款開源發布。您可以自由修改、商業化應用及二次分發，但請保留原始版權聲明。
