/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { UserRole, UserProfile, EventSetting, Ticket, CheckInLog, TransferHistory, AdminStats } from "./src/types.js";

const resolvedFilename = typeof import.meta !== "undefined" && import.meta.url
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== "undefined" ? __filename : "");

const resolvedDirname = resolvedFilename
  ? dirname(resolvedFilename)
  : (typeof __dirname !== "undefined" ? __dirname : "");

// Constants for encryption
const MASTER_KEY = process.env.MASTER_KEY || "secure_ticketing_applet_master_key_2026_val";
const HMAC_SECRET = process.env.HMAC_SECRET || "hmac_forgery_prevention_key_2026_val";

// Persistent Database Directory & File Path
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create local data directory, fallback will be used:", e);
}
const DATA_FILE = process.env.DATA_FILE || (
  fs.existsSync(DATA_DIR)
    ? path.join(DATA_DIR, "ticketing_database.json")
    : path.join(os.tmpdir(), "ticketing_database.json")
);

// Cryptography Helpers
function getEncryptionKey() {
  return crypto.createHash("sha256").update(MASTER_KEY).digest();
}

function encryptText(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptText(cipherText: string): string {
  if (!cipherText || !cipherText.includes(":")) return cipherText;
  try {
    const parts = cipherText.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return "[Decryption Failed]";
  }
}

function hashPassword(password: string, email: string): string {
  return crypto.createHmac("sha256", MASTER_KEY).update(password + email.toLowerCase()).digest("hex");
}

function signTicket(eventId: string, userId: string, serial: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET)
    .update(`${eventId}:${userId}:${serial}`)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();
}

// Check-in and verification log structure
interface DatabaseSchema {
  users: { [id: string]: UserProfile & { passwordHash: string } };
  events: { [id: string]: EventSetting };
  tickets: { [id: string]: Ticket };
  logs: CheckInLog[];
  transfers: TransferHistory[];
  settings?: {
    systemName: string;
    systemSlogan: string;
    contactPhone: string;
    demoMode: boolean;
    requireApproval: boolean;
    bannerUrl?: string;
  };
}

// In-Memory Database with Persistence
let db: DatabaseSchema = {
  users: {},
  events: {},
  tickets: {},
  logs: [],
  transfers: [],
  settings: {
    systemName: "程閱安全票務管理平台",
    systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
    contactPhone: "02-2777-6666",
    demoMode: true,
    requireApproval: false,
    bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
  }
};

// Demo Mode Lock Configuration:
// When deployed to managed/public demo environments (AI Studio, Cloudflare, Netlify preview), demo mode is locked ON
// to prevent public visitors from turning it off and breaking test credentials.
// For self-hosted instances, setting SELF_HOSTED=true or DEMO_LOCKED=false unlocks full freedom to toggle demo mode off.
export const isDemoLocked = process.env.DEMO_LOCKED === "true" || (process.env.SELF_HOSTED !== "true" && process.env.DEMO_LOCKED !== "false");

// Standard Demo Accounts Configuration (Guarantees predictable test access on Netlify/Cloud without server log access)
export const DEMO_CREDENTIALS = {
  admin: {
    email: "admin@ticket.com",
    password: "admin123",
    name: "系統管理員 (Demo Admin)",
    phone: "0912-345-678",
    role: UserRole.ADMIN
  },
  adminAlias: {
    email: "staff@ticket.com",
    password: "staff123",
    name: "現場主管 (Staff Lead)",
    phone: "0988-123-456",
    role: UserRole.ADMIN
  },
  customer: {
    email: "user@ticket.com",
    password: "user123",
    name: "示範買家 (Demo Buyer)",
    phone: "0977-888-999",
    role: UserRole.CUSTOMER
  },
  customerAlias: {
    email: "customer@ticket.com",
    password: "123456",
    name: "測試買家 (Test Buyer)",
    phone: "0966-222-333",
    role: UserRole.CUSTOMER
  }
};

// Initial Seed Data Generator
function loadSeedData() {
  if (!db.settings) {
    db.settings = {
      systemName: "程閱安全票務管理平台",
      systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
      contactPhone: "02-2777-6666",
      demoMode: true,
      requireApproval: false,
      bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
    };
  }

  // Create primary demo admin account
  const adminId = "usr-admin-seed";
  db.users[adminId] = {
    id: adminId,
    email: DEMO_CREDENTIALS.admin.email,
    name: encryptText(DEMO_CREDENTIALS.admin.name),
    phone: encryptText(DEMO_CREDENTIALS.admin.phone),
    role: DEMO_CREDENTIALS.admin.role,
    passwordHash: hashPassword(DEMO_CREDENTIALS.admin.password, DEMO_CREDENTIALS.admin.email),
    createdAt: new Date().toISOString()
  };

  // Create admin alias account (matches legacy test fill)
  const adminAliasId = "usr-admin-alias";
  db.users[adminAliasId] = {
    id: adminAliasId,
    email: DEMO_CREDENTIALS.adminAlias.email,
    name: encryptText(DEMO_CREDENTIALS.adminAlias.name),
    phone: encryptText(DEMO_CREDENTIALS.adminAlias.phone),
    role: DEMO_CREDENTIALS.adminAlias.role,
    passwordHash: hashPassword(DEMO_CREDENTIALS.adminAlias.password, DEMO_CREDENTIALS.adminAlias.email),
    createdAt: new Date().toISOString()
  };

  // Create primary demo customer account
  const customerId = "usr-cust-seed";
  db.users[customerId] = {
    id: customerId,
    email: DEMO_CREDENTIALS.customer.email,
    name: encryptText(DEMO_CREDENTIALS.customer.name),
    phone: encryptText(DEMO_CREDENTIALS.customer.phone),
    role: DEMO_CREDENTIALS.customer.role,
    passwordHash: hashPassword(DEMO_CREDENTIALS.customer.password, DEMO_CREDENTIALS.customer.email),
    createdAt: new Date().toISOString()
  };

  // Create customer alias account (matches legacy test fill)
  const custAliasId = "usr-cust-alias";
  db.users[custAliasId] = {
    id: custAliasId,
    email: DEMO_CREDENTIALS.customerAlias.email,
    name: encryptText(DEMO_CREDENTIALS.customerAlias.name),
    phone: encryptText(DEMO_CREDENTIALS.customerAlias.phone),
    role: DEMO_CREDENTIALS.customerAlias.role,
    passwordHash: hashPassword(DEMO_CREDENTIALS.customerAlias.password, DEMO_CREDENTIALS.customerAlias.email),
    createdAt: new Date().toISOString()
  };

  // Print generated credentials securely to console log
  console.log("\n====================================================================");
  console.log("🔒 程閱票務安全核銷系統 - 演示模式測試帳號已就緒 (開源標準演示憑證)");
  console.log(`🏆 管理員 (Admin) 帳號: ${DEMO_CREDENTIALS.admin.email} | 密碼: ${DEMO_CREDENTIALS.admin.password}`);
  console.log(`🏆 管理員 (Admin Alias) 帳號: ${DEMO_CREDENTIALS.adminAlias.email} | 密碼: ${DEMO_CREDENTIALS.adminAlias.password}`);
  console.log(`👤 示範買家 (Customer) 帳號: ${DEMO_CREDENTIALS.customer.email} | 密碼: ${DEMO_CREDENTIALS.customer.password}`);
  console.log(`👤 示範買家 (Cust Alias) 帳號: ${DEMO_CREDENTIALS.customerAlias.email} | 密碼: ${DEMO_CREDENTIALS.customerAlias.password}`);
  console.log("====================================================================\n");

  // Create default events if not exists
  if (Object.keys(db.events).length === 0) {
    const events: EventSetting[] = [
      {
        id: "evt-001",
        title: "2026 臺北跨年巨星演唱會 (Taipei New Year Concert)",
        description: "迎向新世紀！2026臺北最High新年城，網羅全球最頂尖流行巨星、絢麗台北101煙火秀。主辦方特別推出限量極致景觀搖滾區票券，提供尊榮觀賞體驗。",
        date: "2026-12-31T19:00:00",
        location: "台北市民廣場 (Taipei City Hall Plaza)",
        price: 3600,
        capacity: 150,
        soldCount: 0,
        coverImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
        category: "演唱會 (Concert)",
        status: "upcoming",
        zones: [
          { name: "搖滾A區 (Rock Zone A)", allocation: 50, priceModifier: 1.2 },
          { name: "看台B區 (Grandstand B)", allocation: 100, priceModifier: 1.0 }
        ]
      },
      {
        id: "evt-002",
        title: "AI 科技創新與未來社會峰會 2026",
        description: "匯聚全球 AI 領頭羊、Google DeepMind 科學家以及頂尖科技投資人。探討生成式 AI、代理人系統(Agent)在實務、醫療與工業界的高速發展與未來趨勢。",
        date: "2026-08-15T09:00:00",
        location: "台北南港展覽館 1 館",
        price: 1500,
        capacity: 200,
        soldCount: 0,
        coverImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80",
        category: "科技論壇 (Forum)",
        status: "upcoming",
        zones: [
          { name: "貴賓特等席 (VIP Pass)", allocation: 50, priceModifier: 1.5 },
          { name: "一般專業票 (General Pass)", allocation: 150, priceModifier: 1.0 }
        ]
      },
      {
        id: "evt-003",
        title: "2026 國際精釀啤酒與美食嘉年華",
        description: "百款來自比利時、美國、日本及台灣在地的特調精釀啤酒，搭配米其林餐車星級小吃。現場樂團 Live 演出，最放鬆、最有品味的週末微醺盛宴！",
        date: "2026-09-05T14:00:00",
        location: "華山1914文創園區 華山大草原",
        price: 800,
        capacity: 300,
        soldCount: 0,
        coverImage: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80",
        category: "美食展覽 (Food Festival)",
        status: "upcoming",
        zones: [
          { name: "無限暢飲特仕組 (Unlimited Beer Pass)", allocation: 100, priceModifier: 1.8 },
          { name: "單日體驗券 (Single Entrance Pass)", allocation: 200, priceModifier: 1.0 }
        ]
      }
    ];

    events.forEach(e => {
      db.events[e.id] = e;
    });

    // Buy some default tickets for default user
    const defaultUserTickets = [
      { eventId: "evt-001", zone: "搖滾A區 (Rock Zone A)", seat: "A-12" },
      { eventId: "evt-002", zone: "一般專業票 (General Pass)", seat: "B-45" }
    ];

    defaultUserTickets.forEach((tix, idx) => {
      const evt = db.events[tix.eventId];
      if (evt) {
        const serial = String(evt.soldCount + 1).padStart(4, "0");
        const sig = signTicket(evt.id, customerId, serial);
        const ticketCode = `TIX-${evt.id}-${customerId}-${serial}-${sig}`;
        
        const finalPrice = Math.round(evt.price * (evt.zones.find(z => z.name === tix.zone)?.priceModifier || 1));
        
        const newTicket: Ticket = {
          id: `tix-${evt.id}-${serial}`,
          ticketCode,
          eventId: evt.id,
          eventTitle: evt.title,
          eventDate: evt.date,
          eventLocation: evt.location,
          userId: customerId,
          ownerEmail: DEMO_CREDENTIALS.customer.email,
          purchaserEmail: DEMO_CREDENTIALS.customer.email,
          zone: tix.zone,
          seat: tix.seat,
          price: finalPrice,
          status: "valid",
          purchasedAt: new Date(Date.now() - 3600000 * 24 * idx).toISOString(),
          isGifted: false,
          history: [`於 ${new Date().toLocaleDateString("zh-TW")} 購票成功`]
        };

        db.tickets[newTicket.id] = newTicket;
        evt.soldCount += 1;
      }
    });
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving database file:", err);
  }
}

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf8");
      db = JSON.parse(data);
      
      if (!db.settings) {
        db.settings = {
          systemName: "程閱安全票務管理平台",
          systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
          contactPhone: "02-2777-6666",
          demoMode: true,
          requireApproval: false,
          bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
        };
      }
      if (isDemoLocked) {
        db.settings.demoMode = true;
      }
      
      // Ensure demo seed accounts match current credentials
      let dbNeedsSave = false;
      if (db.users["usr-admin-alias"] && db.users["usr-admin-alias"].email !== DEMO_CREDENTIALS.adminAlias.email) {
        db.users["usr-admin-alias"].email = DEMO_CREDENTIALS.adminAlias.email;
        db.users["usr-admin-alias"].passwordHash = hashPassword(DEMO_CREDENTIALS.adminAlias.password, DEMO_CREDENTIALS.adminAlias.email);
        db.users["usr-admin-alias"].name = encryptText(DEMO_CREDENTIALS.adminAlias.name);
        db.users["usr-admin-alias"].phone = encryptText(DEMO_CREDENTIALS.adminAlias.phone);
        dbNeedsSave = true;
      }
      if (dbNeedsSave) {
        saveDatabase();
      }

      // In Demo Mode, ensure predictable demo accounts exist
      if (db.settings.demoMode !== false) {
        // Ensure admin seed accounts exist
        const hasAdmin = Object.values(db.users).some(u => u.email === DEMO_CREDENTIALS.admin.email || u.email === DEMO_CREDENTIALS.adminAlias.email);
        const hasCustomer = Object.values(db.users).some(u => u.email === DEMO_CREDENTIALS.customer.email || u.email === DEMO_CREDENTIALS.customerAlias.email);
        
        if (!hasAdmin || !hasCustomer || Object.keys(db.events).length === 0) {
          loadSeedData();
          saveDatabase();
        } else {
          console.log("\n====================================================================");
          console.log("🔒 程閱票務安全核銷系統 - 演示模式已啟動 (Demo Mode Active)");
          console.log(`🏆 管理員登入: ${DEMO_CREDENTIALS.admin.email} / ${DEMO_CREDENTIALS.admin.password}`);
          console.log(`👤 買家登入: ${DEMO_CREDENTIALS.customer.email} / ${DEMO_CREDENTIALS.customer.password}`);
          console.log("====================================================================\n");
        }
      } else {
        console.log("🔒 程閱票務系統 - 正式營運模式 (Production Mode) - 演示帳號已清空");
      }
    } else {
      loadSeedData();
      saveDatabase();
    }
  } catch (err) {
    console.error("Error reading database file, using seed data:", err);
    loadSeedData();
  }
}

loadDatabase();

// Initialize Express
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("X-StarPass-Backend", "express-server");
  next();
});

// API: Setup Gemini conditionally to avoid console warnings in local setup if not provided
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    })
  : null;

// Middleware for authentication
function authenticateSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登入，請先進行身分驗證" });
  }
  const userId = authHeader.substring(7);
  const user = db.users[userId];
  if (!user) {
    return res.status(401).json({ error: "無效的安全憑證" });
  }
  req.body._user = user;
  next();
}

// REST APIs

// 0. Demo Credentials Endpoint (Allows Netlify / cloud test users to easily view & autofill valid credentials without needing server logs)
app.get("/api/demo/credentials", (req, res) => {
  const isDemo = isDemoLocked || (db.settings?.demoMode !== false);
  if (!isDemo) {
    return res.json({ demoMode: false, demoLocked: isDemoLocked });
  }
  res.json({
    demoMode: true,
    demoLocked: isDemoLocked,
    admin: {
      email: DEMO_CREDENTIALS.admin.email,
      password: DEMO_CREDENTIALS.admin.password,
      name: DEMO_CREDENTIALS.admin.name
    },
    adminAlias: {
      email: DEMO_CREDENTIALS.adminAlias.email,
      password: DEMO_CREDENTIALS.adminAlias.password
    },
    customer: {
      email: DEMO_CREDENTIALS.customer.email,
      password: DEMO_CREDENTIALS.customer.password,
      name: DEMO_CREDENTIALS.customer.name
    },
    customerAlias: {
      email: DEMO_CREDENTIALS.customerAlias.email,
      password: DEMO_CREDENTIALS.customerAlias.password
    }
  });
});

// 1. Reset Database endpoint
app.post("/api/admin/reset", (req, res) => {
  db = {
    users: {},
    events: {},
    tickets: {},
    logs: [],
    transfers: [],
    settings: {
      systemName: "程閱安全票務管理平台",
      systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
      contactPhone: "02-2777-6666",
      demoMode: true,
      requireApproval: false,
      bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
    }
  };
  loadSeedData();
  saveDatabase();
  res.json({ message: "系統展示資料已成功重置與還原！" });
});

// 1b. Clean Slate endpoint: Purge all demo accounts and enter Production Mode (非演示模式)
app.post("/api/admin/clean-slate", authenticateSession, (req, res) => {
  const admin = req.body._user;
  if (admin.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "只有系統管理員有權限執行此操作" });
  }

  if (isDemoLocked) {
    return res.status(400).json({
      error: "🔒 此線上託管演示環境已鎖定演示模式，禁止清空展示帳號。若為自託管獨立部署，請於環境變數設定 SELF_HOSTED=true 即可自由切換正式/非演示模式！"
    });
  }

  const currentAdminId = admin.id;

  // 1. Remove all demo/seed users except the currently authenticated administrator
  Object.keys(db.users).forEach(uid => {
    const u = db.users[uid];
    if (uid !== currentAdminId) {
      if (
        uid.includes("seed") || 
        uid.includes("alias") || 
        uid.includes("default") ||
        u.email.endsWith("@ticket.com") ||
        u.email === "customer@ticket.com"
      ) {
        delete db.users[uid];
      }
    }
  });

  // 2. Remove default demo events
  const demoEventIds = ["evt-001", "evt-002", "evt-003"];
  demoEventIds.forEach(eid => {
    delete db.events[eid];
  });

  // 3. Remove demo tickets
  Object.keys(db.tickets).forEach(tid => {
    const t = db.tickets[tid];
    if (demoEventIds.includes(t.eventId) || !db.users[t.userId]) {
      delete db.tickets[tid];
    }
  });

  // 4. Clear demo check-in logs
  db.logs = db.logs.filter(l => !demoEventIds.includes(l.eventId));

  // 5. Turn off demo mode
  if (!db.settings) {
    db.settings = {
      systemName: "程閱安全票務管理平台",
      systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
      contactPhone: "02-2777-6666",
      demoMode: false,
      requireApproval: false
    };
  } else {
    db.settings.demoMode = false;
  }

  saveDatabase();

  res.json({
    message: "🎉 已成功清空所有示範測試資料！系統已正式切換為「非演示正式營運模式」，您可以開始新增正式活動並開放會員註冊！",
    settings: db.settings
  });
});

// 2. Auth: Register
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, phone, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "請填寫所有必要欄位（姓名、電子郵件、密碼）" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if user already exists
  const existingUser = Object.values(db.users).find(u => u.email === normalizedEmail);
  if (existingUser) {
    return res.status(400).json({ error: "此電子郵件已被註冊" });
  }

  const userId = "usr-" + crypto.randomBytes(8).toString("hex");
  const newUser = {
    id: userId,
    email: normalizedEmail,
    name: encryptText(name), // AES encrypted
    phone: phone ? encryptText(phone) : undefined, // AES encrypted
    role: (role === UserRole.ADMIN || role === UserRole.SCANNER) ? role : UserRole.CUSTOMER,
    passwordHash: hashPassword(password, normalizedEmail),
    createdAt: new Date().toISOString()
  };

  db.users[userId] = newUser;
  saveDatabase();

  res.status(201).json({
    message: "註冊成功！",
    user: {
      id: userId,
      email: normalizedEmail,
      name, // Decrypted for response
      phone,
      role: newUser.role,
      createdAt: newUser.createdAt
    }
  });
});

// Helper for complete user and demo data cleanup
function hardDeleteUserData(userId: string, email: string) {
  delete db.users[userId];
  
  // Clean up user tickets
  const ticketsToDelete = Object.values(db.tickets).filter(t => t.userId === userId || t.ownerEmail === email || t.purchaserEmail === email);
  ticketsToDelete.forEach(t => {
    delete db.tickets[t.id];
  });

  saveDatabase();
}

// 3. Auth: Login
app.post("/api/auth/login", (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "請提供帳號與密碼" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userRecord = Object.values(db.users).find(
    u => u.email === normalizedEmail && (u.role === role || (role === UserRole.ADMIN && u.role === UserRole.SCANNER))
  );

  if (!userRecord) {
    return res.status(401).json({ error: "電子郵件或密碼錯誤，或者帳號權限組不符" });
  }

  const calculatedHash = hashPassword(password, normalizedEmail);
  if (userRecord.passwordHash !== calculatedHash) {
    return res.status(401).json({ error: "密碼錯誤" });
  }

  // Check 7-day cooling period status
  let wasRestoredFromDeletion = false;
  if (userRecord.deletionScheduledAt) {
    const scheduledTime = new Date(userRecord.deletionScheduledAt).getTime();
    if (scheduledTime <= Date.now()) {
      // 7 days cooling period expired: execute permanent hard deletion
      hardDeleteUserData(userRecord.id, userRecord.email);
      return res.status(401).json({ error: "您的帳號已於 7 天冷靜期屆滿後徹底刪除與註銷。" });
    } else {
      // User logged in within 7-day cooling period: automatically cancel deletion and restore account!
      delete userRecord.deletionScheduledAt;
      saveDatabase();
      wasRestoredFromDeletion = true;
    }
  }

  res.json({
    message: wasRestoredFromDeletion ? "登入成功！您的帳號已自動取消刪除申請並恢復正常使用狀態！" : "登入成功",
    token: userRecord.id, // Simplistic secure token mapping to userId
    wasRestoredFromDeletion,
    user: {
      id: userRecord.id,
      email: userRecord.email,
      name: decryptText(userRecord.name), // Decrypted safely
      phone: userRecord.phone ? decryptText(userRecord.phone) : undefined,
      role: userRecord.role,
      createdAt: userRecord.createdAt,
      deletionScheduledAt: userRecord.deletionScheduledAt
    }
  });
});

// 4. API: Me Profile
app.get("/api/auth/me", authenticateSession, (req, res) => {
  const user = req.body._user;
  res.json({
    id: user.id,
    email: user.email,
    name: decryptText(user.name),
    phone: user.phone ? decryptText(user.phone) : undefined,
    role: user.role,
    createdAt: user.createdAt,
    deletionScheduledAt: user.deletionScheduledAt
  });
});

// Profile update
app.post("/api/auth/update", authenticateSession, (req, res) => {
  const user = req.body._user;
  const { name, phone } = req.body;
  if (!name) {
    return res.status(400).json({ error: "姓名不能為空" });
  }
  user.name = encryptText(name);
  if (phone !== undefined) {
    user.phone = encryptText(phone);
  }
  saveDatabase();
  res.json({
    message: "個人資料更新成功！",
    user: {
      id: user.id,
      email: user.email,
      name: decryptText(user.name),
      phone: user.phone ? decryptText(user.phone) : undefined,
      role: user.role,
      createdAt: user.createdAt,
      deletionScheduledAt: user.deletionScheduledAt
    }
  });
});

// Change password
app.post("/api/auth/change-password", authenticateSession, (req, res) => {
  const user = req.body._user;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "請填寫所有必要欄位" });
  }
  const currentHash = hashPassword(currentPassword, user.email);
  if (user.passwordHash !== currentHash) {
    return res.status(400).json({ error: "目前密碼輸入錯誤" });
  }
  user.passwordHash = hashPassword(newPassword, user.email);
  saveDatabase();
  res.json({ message: "密碼已成功變更，下次登入請使用新密碼！" });
});

// Request 7-day cooling period account deletion
app.post("/api/auth/request-delete", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.id === "usr-cust-seed" || user.id === "usr-admin-seed") {
    return res.status(400).json({ error: "系統展示預設種子帳號不開放註銷刪除，請註冊個人測試帳號體驗此功能。" });
  }

  // Set deletion date to 7 days from now
  const coolingDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  user.deletionScheduledAt = coolingDate;
  saveDatabase();

  res.json({
    message: "已成功申請刪除帳號！您的帳號已進入 7 天刪除冷靜期。在此期間只要重新登入，刪除申請將會自動取消。",
    deletionScheduledAt: coolingDate,
    user: {
      id: user.id,
      email: user.email,
      name: decryptText(user.name),
      phone: user.phone ? decryptText(user.phone) : undefined,
      role: user.role,
      createdAt: user.createdAt,
      deletionScheduledAt: coolingDate
    }
  });
});

// Cancel account deletion request
app.post("/api/auth/cancel-delete", authenticateSession, (req, res) => {
  const user = req.body._user;
  delete user.deletionScheduledAt;
  saveDatabase();

  res.json({
    message: "已為您取消帳號刪除申請，您的個人帳號與票券已成功恢復正常！",
    user: {
      id: user.id,
      email: user.email,
      name: decryptText(user.name),
      phone: user.phone ? decryptText(user.phone) : undefined,
      role: user.role,
      createdAt: user.createdAt,
      deletionScheduledAt: undefined
    }
  });
});

// System Settings APIs
app.get("/api/settings", (req, res) => {
  if (!db.settings) {
    db.settings = {
      systemName: "程閱安全票務管理平台",
      systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
      contactPhone: "02-2777-6666",
      demoMode: true,
      requireApproval: false,
      bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
    };
  }
  if (isDemoLocked) {
    db.settings.demoMode = true;
  }
  res.json({
    ...db.settings,
    demoLocked: isDemoLocked
  });
});

app.post("/api/settings", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "只有系統管理員可以修改系統設定" });
  }
  const { systemName, systemSlogan, contactPhone, demoMode, requireApproval, bannerUrl } = req.body;
  
  if (isDemoLocked && demoMode === false) {
    return res.status(400).json({
      error: "🔒 此線上託管演示環境已鎖定演示模式，以防止公共展示帳號與活動資料被關閉。若為私有化自建部署，請於環境變數設定 SELF_HOSTED=true 或 DEMO_LOCKED=false 即可自由關閉演示模式。"
    });
  }

  db.settings = {
    systemName: systemName || "程閱安全票務管理平台",
    systemSlogan: systemSlogan || "採用加密驗證防偽核銷的高安全智慧票務系統",
    contactPhone: contactPhone || "02-2777-6666",
    demoMode: isDemoLocked ? true : (demoMode === true),
    requireApproval: requireApproval === true,
    bannerUrl: bannerUrl || ""
  };
  
  saveDatabase();
  res.json({
    message: "系統設定已更新！",
    settings: {
      ...db.settings,
      demoLocked: isDemoLocked
    }
  });
});

// Approve Event (Admin only)
app.post("/api/events/:id/approve", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "無管理員權限" });
  }
  const event = db.events[req.params.id];
  if (!event) {
    return res.status(404).json({ error: "找不到該活動" });
  }
  event.status = "upcoming";
  saveDatabase();
  res.json({ message: "活動審核通過，已上架公開！", event });
});

// Reject/Cancel Event (Admin only)
app.post("/api/events/:id/reject", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "無管理員權限" });
  }
  const event = db.events[req.params.id];
  if (!event) {
    return res.status(404).json({ error: "找不到該活動" });
  }
  event.status = "cancelled";
  saveDatabase();
  res.json({ message: "活動審核未通過，已取消上架。", event });
});

// Change User Role (Admin only)
app.post("/api/admin/users/:userId/role", authenticateSession, (req, res) => {
  const adminUser = req.body._user;
  if (adminUser.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "拒絕訪問，無管理權限" });
  }
  const { userId } = req.params;
  const { role } = req.body;
  if (userId === adminUser.id || userId === "usr-admin-seed") {
    return res.status(400).json({ error: "無法修改目前登入或系統種子管理員的權限角色" });
  }
  const targetUser = db.users[userId];
  if (!targetUser) {
    return res.status(404).json({ error: "找不到該使用者" });
  }
  if (role !== UserRole.ADMIN && role !== UserRole.CUSTOMER && role !== UserRole.SCANNER) {
    return res.status(400).json({ error: "無效的角色" });
  }
  targetUser.role = role;
  saveDatabase();
  res.json({ message: "角色權限更新成功！", user: { id: userId, email: targetUser.email, role } });
});

// 5. Events: List All
app.get("/api/events", (req, res) => {
  const isDemoMode = db.settings?.demoMode !== false;
  let list = Object.values(db.events);
  if (!isDemoMode) {
    // Filter out seed/demo events if not in demo mode
    list = list.filter(e => e.id !== "evt-001" && e.id !== "evt-002" && e.id !== "evt-003");
  }
  res.json(list);
});

// 6. Events: Create (Admin Only)
app.post("/api/events", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "只有系統管理員有權限執行此操作" });
  }

  const { title, description, date, location, price, capacity, coverImage, category, zones, requireSeatSelection } = req.body;
  if (!title || !date || !location || isNaN(price) || isNaN(capacity)) {
    return res.status(400).json({ error: "請填寫完整的活動設定與必要數據" });
  }

  const eventId = "evt-" + crypto.randomBytes(4).toString("hex");
  const parsedPrice = Number(price);
  const parsedCapacity = Number(capacity);

  const defaultZones = zones || [
    { name: "一般票 (General)", allocation: parsedCapacity, priceModifier: 1.0 }
  ];

  const newEvent: EventSetting = {
    id: eventId,
    title,
    description: description || "即將推出的精彩活動。",
    date,
    location,
    price: parsedPrice,
    capacity: parsedCapacity,
    soldCount: 0,
    coverImage: coverImage || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&auto=format&fit=crop&q=80",
    category: category || "其他",
    status: db.settings?.requireApproval ? "pending" : "upcoming",
    zones: defaultZones,
    requireSeatSelection: requireSeatSelection !== undefined ? requireSeatSelection : true
  };

  db.events[eventId] = newEvent;
  saveDatabase();

  res.status(201).json({
    message: "活動成功建立！",
    event: newEvent
  });
});

// 7. Purchase Ticket
app.post("/api/tickets/purchase", authenticateSession, (req, res) => {
  const user = req.body._user;
  const { eventId, zoneName, quantity } = req.body;

  if (!eventId || !zoneName) {
    return res.status(400).json({ error: "購票參數不完整" });
  }

  const event = db.events[eventId];
  if (!event) {
    return res.status(404).json({ error: "找不到該活動資訊" });
  }

  const count = Number(quantity) || 1;
  if (event.soldCount + count > event.capacity) {
    return res.status(400).json({ error: "購票失敗，該活動名額已售罄" });
  }

  const zone = event.zones.find(z => z.name === zoneName);
  if (!zone) {
    return res.status(400).json({ error: "不正確的票券區域" });
  }

  const finalPrice = Math.round(event.price * zone.priceModifier);
  const createdTickets: Ticket[] = [];

  for (let i = 0; i < count; i++) {
    const serial = String(event.soldCount + 1).padStart(4, "0");
    const sig = signTicket(event.id, user.id, serial);
    
    // Cryptographically bound secure code
    const ticketCode = `TIX-${event.id}-${user.id.substring(4, 9)}-${serial}-${sig}`;
    const isSeatRequired = event.requireSeatSelection !== false;
    const seatNumber = isSeatRequired 
      ? `${zoneName.substring(0, 1)}-${Math.floor(Math.random() * 20) + 1}-${Math.floor(Math.random() * 50) + 1}`
      : "自由座 (General Admission)";

    const newTicket: Ticket = {
      id: "tix-" + crypto.randomBytes(12).toString("hex"),
      ticketCode,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      userId: user.id,
      ownerEmail: user.email,
      purchaserEmail: user.email,
      zone: zoneName,
      seat: seatNumber,
      price: finalPrice,
      status: "valid",
      purchasedAt: new Date().toISOString(),
      isGifted: false,
      history: [`於 ${new Date().toLocaleString("zh-TW")} 購票成功，交易經雜湊與簽章認證`]
    };

    db.tickets[newTicket.id] = newTicket;
    event.soldCount += 1;
    createdTickets.push(newTicket);
  }

  saveDatabase();

  res.status(201).json({
    message: `成功訂購 ${count} 張票券！`,
    tickets: createdTickets
  });
});

// 9. Get User's Tickets
app.get("/api/tickets/my", authenticateSession, (req, res) => {
  const user = req.body._user;
  const userTickets = Object.values(db.tickets).filter(
    t => t.ownerEmail === user.email && t.status !== "transferred"
  );
  res.json(userTickets);
});

// 10. Gift / Transfer Ticket (兌換送人功能)
app.post("/api/tickets/transfer", authenticateSession, (req, res) => {
  const user = req.body._user;
  const { ticketId, receiverEmail } = req.body;

  if (!ticketId || !receiverEmail) {
    return res.status(400).json({ error: "請提供票券代碼與接收者的電子郵件" });
  }

  const targetEmail = receiverEmail.trim().toLowerCase();
  if (targetEmail === user.email) {
    return res.status(400).json({ error: "不可將票券轉贈給自己" });
  }

  const ticket = db.tickets[ticketId];
  if (!ticket || ticket.ownerEmail !== user.email || ticket.status !== "valid") {
    return res.status(404).json({ error: "找不到有效的票券，或您非此票券之所有人" });
  }

  // Find receiver user inside DB to verify they exist
  const receiverUser = Object.values(db.users).find(u => u.email === targetEmail);
  if (!receiverUser) {
    return res.status(404).json({ error: `電子郵件「${targetEmail}」在系統中尚未註冊，請先請親友註冊帳號。` });
  }

  // Revoke old ticket details for sender
  ticket.status = "transferred";
  ticket.history.push(`於 ${new Date().toLocaleString("zh-TW")} 轉贈予 ${targetEmail}`);

  // Create a brand new cryptographically secure ticket for receiver to prevent duplicate double-spend
  const event = db.events[ticket.eventId];
  const serial = String(event.soldCount + 1).padStart(4, "0");
  const sig = signTicket(ticket.eventId, receiverUser.id, serial);
  const newTicketCode = `TIX-${ticket.eventId}-${receiverUser.id.substring(4, 9)}-${serial}-${sig}`;

  const transferredTicket: Ticket = {
    id: "tix-" + crypto.randomBytes(12).toString("hex"),
    ticketCode: newTicketCode,
    eventId: ticket.eventId,
    eventTitle: ticket.eventTitle,
    eventDate: ticket.eventDate,
    eventLocation: ticket.eventLocation,
    userId: receiverUser.id,
    ownerEmail: receiverUser.email,
    purchaserEmail: ticket.purchaserEmail, // Preserve original purchaser trace
    zone: ticket.zone,
    seat: ticket.seat,
    price: ticket.price,
    status: "valid",
    purchasedAt: ticket.purchasedAt,
    isGifted: true,
    history: [
      ...ticket.history,
      `於 ${new Date().toLocaleString("zh-TW")} 由 ${user.email} 贈送接收成功，票號更新為 ${newTicketCode}`
    ]
  };

  db.tickets[transferredTicket.id] = transferredTicket;
  
  // Record Transfer Log
  const transferLog: TransferHistory = {
    id: "tx-" + crypto.randomBytes(8).toString("hex"),
    ticketCode: ticket.ticketCode,
    eventId: ticket.eventId,
    eventTitle: ticket.eventTitle,
    senderEmail: user.email,
    receiverEmail: targetEmail,
    transferredAt: new Date().toISOString(),
    secureHash: crypto.createHash("sha256").update(ticket.ticketCode + user.email + targetEmail).digest("hex").slice(0, 16)
  };

  db.transfers.push(transferLog);
  saveDatabase();

  res.json({
    message: "票券已成功安全贈送！接收者可在「我的電子票夾」即時查看！",
    newTicket: transferredTicket
  });
});

// 11. Real-time scanning & Verification with check-in log (QR Code Scanning API)
app.post("/api/tickets/verify", authenticateSession, (req, res) => {
  const admin = req.body._user;
  if (admin.role !== UserRole.ADMIN && admin.role !== UserRole.SCANNER) {
    return res.status(403).json({ error: "只有授權的驗票人員可以進行核銷" });
  }

  const { ticketCode } = req.body;
  if (!ticketCode) {
    return res.status(400).json({ error: "無效的掃描條碼" });
  }

  // Cryptographic Signature Validation
  // Format is: TIX-EVT_ID-USR_ID_SUB-SERIAL-SIG
  const parts = ticketCode.split("-");
  if (parts.length < 5 || parts[0] !== "TIX") {
    // Record invalid check-in attempt
    const errLog: CheckInLog = {
      id: "log-" + crypto.randomBytes(8).toString("hex"),
      ticketCode,
      eventId: "unknown",
      eventTitle: "非系統核發票券",
      userId: "unknown",
      ownerEmail: "unknown",
      checkedInAt: new Date().toISOString(),
      status: "invalid_sig",
      device: req.headers["user-agent"] || "Scanner Web"
    };
    db.logs.unshift(errLog);
    saveDatabase();
    return res.status(400).json({
      success: false,
      status: "invalid_sig",
      error: "❌ 驗票防偽簽章驗證失敗：此條碼格式不符或疑似偽造！"
    });
  }

  const eventId = parts[1];
  const serial = parts[3];
  const signature = parts[4];

  // Look up ticket inside DB
  const ticket = Object.values(db.tickets).find(t => t.ticketCode === ticketCode);
  
  if (!ticket) {
    const errLog: CheckInLog = {
      id: "log-" + crypto.randomBytes(8).toString("hex"),
      ticketCode,
      eventId,
      eventTitle: "找不到票券實體",
      userId: "unknown",
      ownerEmail: "unknown",
      checkedInAt: new Date().toISOString(),
      status: "not_found"
    };
    db.logs.unshift(errLog);
    saveDatabase();
    return res.status(404).json({
      success: false,
      status: "not_found",
      error: "❌ 驗票失敗：此票券在資料庫中不存在或已被註銷！"
    });
  }

  // Check if ticket is already checked in
  if (ticket.status === "checked_in") {
    const ticketUser = db.users[ticket.userId];
    const decryptedName = ticketUser ? decryptText(ticketUser.name) : "未登記姓名";
    const decryptedPhone = ticketUser && ticketUser.phone ? decryptText(ticketUser.phone) : "";

    const duplicateLog: CheckInLog = {
      id: "log-" + crypto.randomBytes(8).toString("hex"),
      ticketCode,
      eventId: ticket.eventId,
      eventTitle: ticket.eventTitle,
      userId: ticket.userId,
      ownerEmail: ticket.ownerEmail,
      ownerName: decryptedName,
      ownerPhone: decryptedPhone,
      zone: ticket.zone,
      seat: ticket.seat,
      price: ticket.price,
      checkedInAt: new Date().toISOString(),
      status: "duplicate",
      device: "Admin Scanner Panel",
      errorReason: `該票券已於 ${new Date(ticket.checkedInAt || "").toLocaleString("zh-TW")} 核銷進場過`
    };
    db.logs.unshift(duplicateLog);
    saveDatabase();
    return res.status(400).json({
      success: false,
      status: "duplicate",
      error: `⚠️ 重複核銷警報！該票券已於 ${new Date(ticket.checkedInAt || "").toLocaleTimeString("zh-TW")} 進行過核銷進場！`,
      ticketInfo: {
        eventTitle: ticket.eventTitle,
        ownerEmail: ticket.ownerEmail,
        ownerName: decryptedName,
        ownerPhone: decryptedPhone,
        zone: ticket.zone,
        seat: ticket.seat,
        price: ticket.price,
        checkedInAt: ticket.checkedInAt
      }
    });
  }

  // If ticket is transferred, it cannot be used
  if (ticket.status === "transferred") {
    return res.status(400).json({
      success: false,
      status: "invalid_sig",
      error: "❌ 驗票失敗：此票券已被轉贈，其原始核銷條碼已失效作廢！"
    });
  }

  // Success Check-in
  const checkInTime = new Date().toISOString();
  ticket.status = "checked_in";
  ticket.checkedInAt = checkInTime;
  ticket.history.push(`於 ${new Date().toLocaleString("zh-TW")} 由 ${admin.email} 核銷進場`);

  // Find user details to show decrypt name
  const ticketUser = db.users[ticket.userId];
  const decryptedName = ticketUser ? decryptText(ticketUser.name) : "未知觀看者";
  const decryptedPhone = ticketUser && ticketUser.phone ? decryptText(ticketUser.phone) : "無電話";

  // Log successful check-in with complete details for CSV reports & audit
  const successLog: CheckInLog = {
    id: "log-" + crypto.randomBytes(8).toString("hex"),
    ticketCode,
    eventId: ticket.eventId,
    eventTitle: ticket.eventTitle,
    userId: ticket.userId,
    ownerEmail: ticket.ownerEmail,
    ownerName: decryptedName,
    ownerPhone: decryptedPhone,
    zone: ticket.zone,
    seat: ticket.seat,
    price: ticket.price,
    checkedInAt: checkInTime,
    status: "success",
    device: "主通道手持式掃描器 A"
  };
  db.logs.unshift(successLog);
  saveDatabase();

  res.json({
    success: true,
    status: "success",
    message: "✅ 驗票核銷成功！請放行進場！",
    ticketInfo: {
      eventTitle: ticket.eventTitle,
      ownerName: decryptedName,
      ownerEmail: ticket.ownerEmail,
      ownerPhone: decryptedPhone,
      zone: ticket.zone,
      seat: ticket.seat,
      price: ticket.price,
      checkedInAt: checkInTime
    }
  });
});

// 12. Get Admin Logs Feed (supports filtering by eventId and scanner authorization)
app.get("/api/admin/logs", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SCANNER) {
    return res.status(403).json({ error: "拒絕訪問，無驗票權限" });
  }

  const { eventId, limit } = req.query;
  let filteredLogs = db.logs;
  if (eventId && eventId !== "all") {
    filteredLogs = filteredLogs.filter(l => l.eventId === eventId);
  }

  const maxCount = limit ? Math.min(Number(limit), 200) : 100;
  res.json(filteredLogs.slice(0, maxCount));
});

// 12-CSV. Export Check-In Logs to CSV report (with UTF-8 BOM for Excel / Numbers compatibility)
app.get("/api/admin/logs/export-csv", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SCANNER) {
    return res.status(403).json({ error: "拒絕訪問，無驗票權限" });
  }

  const { eventId } = req.query;
  let targetLogs = db.logs;
  let eventName = "全部活動";

  if (eventId && eventId !== "all") {
    targetLogs = targetLogs.filter(l => l.eventId === eventId);
    const evt = db.events[String(eventId)];
    if (evt) eventName = evt.title;
  }

  const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '""';
    const clean = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${clean}"`;
  };

  const headers = [
    "序號",
    "核銷時間",
    "活動名稱",
    "活動編號",
    "票券代碼",
    "核銷狀態",
    "持票人姓名",
    "持票人信箱",
    "持票人電話",
    "座位分區",
    "座位編號",
    "票價(TWD)",
    "驗票通道/裝置",
    "防偽檢驗/異常原因"
  ];

  const rows = targetLogs.map((log, idx) => {
    // Resolve ticket / user details if missing in log
    const ticket = Object.values(db.tickets).find(t => t.ticketCode === log.ticketCode);
    const userObj = log.userId ? db.users[log.userId] : null;
    const resolvedName = log.ownerName || (userObj ? decryptText(userObj.name) : "未登記");
    const resolvedPhone = log.ownerPhone || (userObj && userObj.phone ? decryptText(userObj.phone) : "");
    const resolvedZone = log.zone || (ticket ? ticket.zone : "未指定");
    const resolvedSeat = log.seat || (ticket ? ticket.seat : "未指定");
    const resolvedPrice = log.price !== undefined ? log.price : (ticket ? ticket.price : 0);

    let statusLabel = "驗證成功 (准予進場)";
    if (log.status === "duplicate") statusLabel = "重複核銷警報 (重複入場)";
    else if (log.status === "invalid_sig") statusLabel = "防偽核簽失敗 (格式/篡改無效)";
    else if (log.status === "not_found") statusLabel = "查無票券 (資料庫不存在)";

    return [
      idx + 1,
      escapeCsv(new Date(log.checkedInAt).toLocaleString("zh-TW")),
      escapeCsv(log.eventTitle),
      escapeCsv(log.eventId),
      escapeCsv(log.ticketCode),
      escapeCsv(statusLabel),
      escapeCsv(resolvedName),
      escapeCsv(log.ownerEmail),
      escapeCsv(resolvedPhone),
      escapeCsv(resolvedZone),
      escapeCsv(resolvedSeat),
      resolvedPrice,
      escapeCsv(log.device || "閘門掃描器"),
      escapeCsv(log.errorReason || (log.status === "success" ? "安全簽章比對一致" : ""))
    ].join(",");
  });

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel
  const csvData = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const filename = `核銷紀錄報表_${eventName.replace(/[\/\\:*?"<>|]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(csvData);
});

// 12a. DELETE: Single Admin Log (Record removal)
app.delete("/api/admin/logs/:logId", authenticateSession, (req, res) => {
  const admin = req.body._user;
  if (admin.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "拒絕訪問" });
  }
  const { logId } = req.params;
  const logIndex = db.logs.findIndex(l => l.id === logId);
  if (logIndex === -1) {
    return res.status(404).json({ error: "找不到該筆核銷紀錄" });
  }

  const log = db.logs[logIndex];
  
  // Revert corresponding ticket to 'valid' and remove checkedInAt
  const ticket = Object.values(db.tickets).find(t => t.ticketCode === log.ticketCode);
  if (ticket && ticket.status === "checked_in") {
    ticket.status = "valid";
    delete ticket.checkedInAt;
    ticket.history.push(`於 ${new Date().toLocaleString("zh-TW")} 由管理員手動移除核銷紀錄，票券重置為未進場狀態`);
  }

  // Delete log
  db.logs.splice(logIndex, 1);
  saveDatabase();

  res.json({ message: "已成功移除該核銷紀錄，對應票券已恢復為未進場狀態。" });
});

// 12b. POST: Purge All Logs & Reset Tickets (Batch record removal)
app.post("/api/admin/clear-logs", authenticateSession, (req, res) => {
  const admin = req.body._user;
  if (admin.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "拒絕訪問" });
  }

  // Revert all checked_in tickets to valid
  Object.values(db.tickets).forEach(t => {
    if (t.status === "checked_in") {
      t.status = "valid";
      delete t.checkedInAt;
      t.history.push(`於 ${new Date().toLocaleString("zh-TW")} 批次清除系統核銷紀錄，票券重置為未進場狀態`);
    }
  });

  // Empty logs
  db.logs = [];
  saveDatabase();

  res.json({ message: "所有核銷記錄已成功清空，受影響票券均已恢復為未進場狀態！" });
});

// 12c. GET: List Registered Users for Admin (Account removal view helper)
app.get("/api/admin/users", authenticateSession, (req, res) => {
  const admin = req.body._user;
  if (admin.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "拒絕訪問" });
  }
  const usersList = Object.values(db.users).map(u => ({
    id: u.id,
    email: u.email,
    name: decryptText(u.name),
    phone: u.phone ? decryptText(u.phone) : undefined,
    role: u.role,
    createdAt: u.createdAt
  }));
  res.json(usersList);
});

// 12d. DELETE: Delete User Account by Admin (Account removal)
app.delete("/api/admin/users/:userId", authenticateSession, (req, res) => {
  const admin = req.body._user;
  if (admin.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "拒絕訪問" });
  }
  const { userId } = req.params;
  if (userId === admin.id || userId === "usr-admin-seed") {
    return res.status(400).json({ error: "無法刪除目前登入的管理員或系統管理員種子帳號" });
  }
  
  if (!db.users[userId]) {
    return res.status(404).json({ error: "找不到該使用者帳號" });
  }

  const targetUser = db.users[userId];

  // Delete user from db
  delete db.users[userId];

  // Also remove this user's tickets to maintain database integrity
  const ticketsToDelete = Object.values(db.tickets).filter(t => t.userId === userId || t.ownerEmail === targetUser.email);
  ticketsToDelete.forEach(t => {
    delete db.tickets[t.id];
  });

  saveDatabase();
  res.json({ message: "帳號及相關門票資料已成功徹底移除！" });
});

// 12e. DELETE: Customer self-deletion (Account removal)
app.delete("/api/auth/delete-me", authenticateSession, (req, res) => {
  const user = req.body._user;
  const userId = user.id;

  if (userId === "usr-cust-seed") {
    return res.status(400).json({ error: "系統種子買家帳號不開放註銷，請註冊新帳號進行測試。" });
  }

  // Delete user from db
  delete db.users[userId];

  // Also remove tickets
  const ticketsToDelete = Object.values(db.tickets).filter(t => t.userId === userId || t.ownerEmail === user.email);
  ticketsToDelete.forEach(t => {
    delete db.tickets[t.id];
  });

  saveDatabase();
  res.json({ message: "您的帳號與門票資料已成功徹底註銷與移除，登出程序已完成。" });
});

// 13. Reporting & Analytics Statistics
app.get("/api/admin/stats", authenticateSession, (req, res) => {
  const user = req.body._user;
  if (user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "拒絕訪問" });
  }

  // Compute stats
  let totalRevenue = 0;
  let totalTicketsSold = 0;

  const ticketsList = Object.values(db.tickets);
  ticketsList.forEach(t => {
    if (t.status !== "refunded" && t.status !== "transferred") {
      totalRevenue += t.price;
      totalTicketsSold += 1;
    }
  });

  const totalEventsCount = Object.keys(db.events).length;
  const totalCheckedIn = ticketsList.filter(t => t.status === "checked_in").length;

  // Build simple timeline (last 7 days of sales)
  const salesTimelineMap: { [key: string]: { count: number; revenue: number } } = {};
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    salesTimelineMap[dateStr] = { count: 0, revenue: 0 };
  }

  ticketsList.forEach(t => {
    if (t.status !== "refunded" && t.status !== "transferred") {
      const dateStr = t.purchasedAt.split("T")[0];
      if (salesTimelineMap[dateStr]) {
        salesTimelineMap[dateStr].count += 1;
        salesTimelineMap[dateStr].revenue += t.price;
      }
    }
  });

  const salesTimeline = Object.entries(salesTimelineMap).map(([date, val]) => ({
    date: date.substring(5), // MM-DD
    count: val.count,
    revenue: val.revenue
  }));

  // Build rates by event
  const checkInRatesByEvent = Object.values(db.events).map(evt => {
    const eventTickets = ticketsList.filter(t => t.eventId === evt.id && t.status !== "transferred");
    const checkedIn = eventTickets.filter(t => t.status === "checked_in").length;
    return {
      eventId: evt.id,
      title: evt.title.substring(0, 15) + (evt.title.length > 15 ? "..." : ""),
      checkedIn,
      total: eventTickets.length
    };
  });

  const responseData: AdminStats = {
    totalRevenue,
    totalTicketsSold,
    totalEventsCount,
    totalCheckedIn,
    salesTimeline,
    checkInRatesByEvent,
    recentLogs: db.logs.slice(0, 15)
  };

  res.json(responseData);
});

// Serve frontend assets via Vite in development, static in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Secure ticketing system backend running on http://localhost:${PORT}`);
  });
}

startServer();
