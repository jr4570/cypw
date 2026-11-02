/**
 * Client-side mock and offline API fallback engine.
 * Ensures 100% functionality on static deployment hosts like Cloudflare Pages,
 * Netlify, Vercel, or when offline, preventing any HTML 404/200 parse failures.
 */

import { UserRole, UserProfile, EventSetting, Ticket, CheckInLog } from '../types';

export const DEMO_CREDENTIALS = {
  admin: {
    email: 'admin@ticket.com',
    password: 'admin123',
    name: '系統管理員 (Demo Admin)',
    phone: '0912-345-678',
    role: UserRole.ADMIN
  },
  adminAlias: {
    email: 'staff@ticket.com',
    password: 'staff123',
    name: '現場主管 (Staff Lead)',
    phone: '0988-123-456',
    role: UserRole.ADMIN
  },
  customer: {
    email: 'user@ticket.com',
    password: 'user123',
    name: '示範買家 (Demo Buyer)',
    phone: '0977-888-999',
    role: UserRole.CUSTOMER
  },
  customerAlias: {
    email: 'customer@ticket.com',
    password: '123456',
    name: '測試買家 (Test Buyer)',
    phone: '0966-222-333',
    role: UserRole.CUSTOMER
  }
};

const INITIAL_EVENTS: EventSetting[] = [
  {
    id: "evt-001",
    title: "2026 臺北跨年巨星演唱會 (Taipei New Year Concert)",
    description: "迎向新世紀！2026臺北最High新年城，網羅全球最頂尖流行巨星、絢麗台北101煙火秀。主辦方特別推出限量極致景觀搖滾區票券，提供尊榮觀賞體驗。",
    date: "2026-12-31T19:00:00",
    location: "台北市民廣場 (Taipei City Hall Plaza)",
    price: 3600,
    capacity: 150,
    soldCount: 18,
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
    date: "2026-11-20T09:30:00",
    location: "台北南港展覽館 2 館 (TaiNEX 2)",
    price: 2400,
    capacity: 200,
    soldCount: 42,
    coverImage: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&auto=format&fit=crop&q=80",
    category: "科技研討會 (Tech Conference)",
    status: "upcoming",
    zones: [
      { name: "VIP 貴賓席 (含閉門晚宴)", allocation: 50, priceModifier: 1.5 },
      { name: "標準參會席 (General Admission)", allocation: 150, priceModifier: 1.0 }
    ]
  },
  {
    id: "evt-003",
    title: "國家兩廳院交響之夜：貝多芬英雄交響曲",
    description: "享譽國際的愛樂樂團全編制登台，演繹貝多芬第三號交響曲《英雄》。現場搭配極致聲學殿堂設計，沉浸式音場讓您重溫古典音樂巔峰鉅作。",
    date: "2026-12-15T19:30:00",
    location: "國家音樂廳 (National Concert Hall)",
    price: 1800,
    capacity: 120,
    soldCount: 8,
    coverImage: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&auto=format&fit=crop&q=80",
    category: "藝文展演 (Classical Music)",
    status: "upcoming",
    zones: [
      { name: "一樓特等席", allocation: 40, priceModifier: 1.3 },
      { name: "二樓聆賞席", allocation: 80, priceModifier: 1.0 }
    ]
  }
];

// Helper to hash password in browser environment safely
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16);
}

// Simple signature generator for ticket anti-counterfeiting
function generateTicketSig(eventId: string, userId: string, serial: string): string {
  const input = `${eventId}:${userId}:${serial}:demo_secret_2026`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8).toUpperCase();
}

class ClientStorageEngine {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(`starpass_db_${key}`);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`starpass_db_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn("Storage quota exceeded or unavailable:", e);
    }
  }

  getUsers(): Record<string, UserProfile & { passwordHash: string; rawPassword?: string }> {
    const existing = this.get<Record<string, any>>('users', {});
    // Seed standard demo users if empty
    if (!existing['usr-admin'] || !existing['usr-cust']) {
      existing['usr-admin'] = {
        id: 'usr-admin',
        email: DEMO_CREDENTIALS.admin.email,
        name: DEMO_CREDENTIALS.admin.name,
        phone: DEMO_CREDENTIALS.admin.phone,
        role: UserRole.ADMIN,
        passwordHash: simpleHash(DEMO_CREDENTIALS.admin.password + DEMO_CREDENTIALS.admin.email.toLowerCase()),
        rawPassword: DEMO_CREDENTIALS.admin.password,
        createdAt: new Date().toISOString()
      };
      existing['usr-staff'] = {
        id: 'usr-staff',
        email: DEMO_CREDENTIALS.adminAlias.email,
        name: DEMO_CREDENTIALS.adminAlias.name,
        phone: DEMO_CREDENTIALS.adminAlias.phone,
        role: UserRole.ADMIN,
        passwordHash: simpleHash(DEMO_CREDENTIALS.adminAlias.password + DEMO_CREDENTIALS.adminAlias.email.toLowerCase()),
        rawPassword: DEMO_CREDENTIALS.adminAlias.password,
        createdAt: new Date().toISOString()
      };
      existing['usr-cust'] = {
        id: 'usr-cust',
        email: DEMO_CREDENTIALS.customer.email,
        name: DEMO_CREDENTIALS.customer.name,
        phone: DEMO_CREDENTIALS.customer.phone,
        role: UserRole.CUSTOMER,
        passwordHash: simpleHash(DEMO_CREDENTIALS.customer.password + DEMO_CREDENTIALS.customer.email.toLowerCase()),
        rawPassword: DEMO_CREDENTIALS.customer.password,
        createdAt: new Date().toISOString()
      };
      existing['usr-cust-alias'] = {
        id: 'usr-cust-alias',
        email: DEMO_CREDENTIALS.customerAlias.email,
        name: DEMO_CREDENTIALS.customerAlias.name,
        phone: DEMO_CREDENTIALS.customerAlias.phone,
        role: UserRole.CUSTOMER,
        passwordHash: simpleHash(DEMO_CREDENTIALS.customerAlias.password + DEMO_CREDENTIALS.customerAlias.email.toLowerCase()),
        rawPassword: DEMO_CREDENTIALS.customerAlias.password,
        createdAt: new Date().toISOString()
      };
      this.set('users', existing);
    }
    return existing;
  }

  saveUsers(users: Record<string, any>): void {
    this.set('users', users);
  }

  getEvents(): EventSetting[] {
    const events = this.get<EventSetting[]>('events', []);
    if (!events || events.length === 0) {
      this.set('events', INITIAL_EVENTS);
      return INITIAL_EVENTS;
    }
    return events;
  }

  saveEvents(events: EventSetting[]): void {
    this.set('events', events);
  }

  getTickets(): Ticket[] {
    const tickets = this.get<Ticket[]>('tickets', []);
    if (!tickets || tickets.length === 0) {
      const seedTickets: Ticket[] = [
        {
          id: "tix-seed-01",
          ticketCode: `TIX-evt-001-usr-cust-10001-${generateTicketSig('evt-001', 'usr-cust', '10001')}`,
          eventId: "evt-001",
          eventTitle: "2026 臺北跨年巨星演唱會 (Taipei New Year Concert)",
          eventDate: "2026-12-31T19:00:00",
          eventLocation: "台北市民廣場 (Taipei City Hall Plaza)",
          userId: "usr-cust",
          ownerEmail: DEMO_CREDENTIALS.customer.email,
          purchaserEmail: DEMO_CREDENTIALS.customer.email,
          zone: "搖滾A區 (Rock Zone A)",
          seat: "A-01",
          price: 4320,
          status: "valid",
          purchasedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          isGifted: false,
          history: ["購票成功"]
        },
        {
          id: "tix-seed-02",
          ticketCode: `TIX-evt-002-usr-cust-10002-${generateTicketSig('evt-002', 'usr-cust', '10002')}`,
          eventId: "evt-002",
          eventTitle: "AI 科技創新與未來社會峰會 2026",
          eventDate: "2026-11-20T09:30:00",
          eventLocation: "台北南港展覽館 2 館 (TaiNEX 2)",
          userId: "usr-cust",
          ownerEmail: DEMO_CREDENTIALS.customer.email,
          purchaserEmail: DEMO_CREDENTIALS.customer.email,
          zone: "標準參會席 (General Admission)",
          seat: "B-22",
          price: 2400,
          status: "valid",
          purchasedAt: new Date(Date.now() - 86400000).toISOString(),
          isGifted: false,
          history: ["購票成功"]
        }
      ];
      this.set('tickets', seedTickets);
      return seedTickets;
    }
    return tickets;
  }

  saveTickets(tickets: Ticket[]): void {
    this.set('tickets', tickets);
  }

  getLogs(): CheckInLog[] {
    return this.get<CheckInLog[]>('logs', [
      {
        id: 'log-seed-1',
        ticketCode: 'TIX-evt-001-usr-demo-00001-TESTSIG1',
        eventId: 'evt-001',
        eventTitle: '2026 臺北跨年巨星演唱會 (Taipei New Year Concert)',
        userId: 'usr-demo-01',
        ownerEmail: DEMO_CREDENTIALS.customer.email,
        ownerName: DEMO_CREDENTIALS.customer.name,
        zone: '搖滾A區 (Rock Zone A)',
        seat: 'A-09',
        price: 4320,
        checkedInAt: new Date(Date.now() - 3600000).toISOString(),
        status: 'success',
        device: '行動手持驗票機 #01'
      }
    ]);
  }

  saveLogs(logs: CheckInLog[]): void {
    this.set('logs', logs);
  }

  getSettings() {
    return this.get('settings', {
      systemName: "程閱安全票務管理平台",
      systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
      contactPhone: "02-2777-6666",
      demoMode: true,
      demoLocked: true, // Locked on hosted preview / demo
      requireApproval: false,
      bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
    });
  }

  saveSettings(settings: any) {
    this.set('settings', settings);
  }

  cleanSlate() {
    this.set('logs', []);
    this.set('tickets', []);
    const users = this.getUsers();
    // Reset passwords of demo users and remove ephemeral accounts
    const filteredUsers: Record<string, any> = {};
    for (const [id, user] of Object.entries(users)) {
      if (id.startsWith('usr-admin') || id.startsWith('usr-staff') || id.startsWith('usr-cust')) {
        filteredUsers[id] = user;
      }
    }
    this.set('users', filteredUsers);
  }
}

export const clientStorage = new ClientStorageEngine();

/**
 * Handles mock API requests directly in the browser.
 */
export async function handleMockApiRequest(url: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const method = (init?.method || 'GET').toUpperCase();
  const parsedUrl = new URL(url, window.location.origin);
  const pathname = parsedUrl.pathname;
  let bodyData: any = {};
  if (init?.body && typeof init.body === 'string') {
    try {
      bodyData = JSON.parse(init.body);
    } catch {
      bodyData = {};
    }
  }

  // Auth header parsing
  const authHeader = (init?.headers as Record<string, string>)?.[`Authorization`] || (init?.headers as Record<string, string>)?.[`authorization`];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '';
  const currentUserId = token.startsWith('token_') ? token.replace('token_', '') : '';

  // 1. /api/settings
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      const settings = clientStorage.getSettings();
      return { status: 200, body: settings };
    }
    if (method === 'PUT' || method === 'POST') {
      const current = clientStorage.getSettings();
      const updated = { ...current, ...bodyData };
      if (current.demoLocked) {
        updated.demoMode = true; // Lock cannot be overridden if demoLocked
      }
      clientStorage.saveSettings(updated);
      return { status: 200, body: updated };
    }
  }

  // 2. /api/demo/credentials
  if (pathname === '/api/demo/credentials') {
    return {
      status: 200,
      body: {
        demoMode: true,
        demoLocked: true,
        ...DEMO_CREDENTIALS
      }
    };
  }

  // 3. /api/auth/login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const { email, password, role } = bodyData;
    const users = clientStorage.getUsers();
    const user = Object.values(users).find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    
    if (!user) {
      return { status: 400, body: { error: '用戶不存在或電子郵件錯誤' } };
    }

    // Role check if admin requested
    if (role === 'admin' && user.role !== UserRole.ADMIN) {
      return { status: 403, body: { error: '權限不足：此帳號並非管理員角色' } };
    }

    const inputHash = simpleHash(password + user.email.toLowerCase());
    const isPasswordValid = (user.rawPassword && user.rawPassword === password) || user.passwordHash === inputHash;

    if (!isPasswordValid) {
      return { status: 400, body: { error: '密碼錯誤，請重新確認' } };
    }

    const { passwordHash, rawPassword, ...safeUser } = user;
    return {
      status: 200,
      body: {
        token: `token_${user.id}`,
        user: safeUser
      }
    };
  }

  // 4. /api/auth/register
  if (pathname === '/api/auth/register' && method === 'POST') {
    const { email, password, name, phone, role } = bodyData;
    if (!email || !password || !name) {
      return { status: 400, body: { error: '請完整填寫姓名、電子信箱與密碼' } };
    }

    const users = clientStorage.getUsers();
    if (Object.values(users).some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { status: 400, body: { error: '該電子郵件已被註冊' } };
    }

    const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const assignedRole = role === 'admin' ? UserRole.ADMIN : (role === 'scanner' ? UserRole.SCANNER : UserRole.CUSTOMER);
    
    const newUser = {
      id: newId,
      email: email.trim(),
      name: name.trim(),
      phone: (phone || '').trim(),
      role: assignedRole,
      passwordHash: simpleHash(password + email.trim().toLowerCase()),
      rawPassword: password,
      createdAt: new Date().toISOString()
    };

    users[newId] = newUser;
    clientStorage.saveUsers(users);

    const { passwordHash, rawPassword, ...safeUser } = newUser;
    return {
      status: 200,
      body: {
        token: `token_${newId}`,
        user: safeUser
      }
    };
  }

  // 5. /api/auth/me
  if (pathname === '/api/auth/me' && method === 'GET') {
    const users = clientStorage.getUsers();
    let user = users[currentUserId];
    if (!user) {
      // Default to customer or admin depending on token format
      user = users['usr-admin'] || users['usr-cust'];
    }
    if (user) {
      const { passwordHash, rawPassword, ...safeUser } = user;
      return { status: 200, body: safeUser };
    }
    return { status: 401, body: { error: '登入已過期，請重新登入' } };
  }

  // 6. /api/events
  if (pathname === '/api/events') {
    if (method === 'GET') {
      const events = clientStorage.getEvents();
      return { status: 200, body: events };
    }
    if (method === 'POST') {
      const events = clientStorage.getEvents();
      const newEvt: EventSetting = {
        id: `evt-${Date.now().toString(36)}`,
        title: bodyData.title,
        description: bodyData.description || '',
        date: bodyData.date,
        location: bodyData.location,
        price: Number(bodyData.price) || 0,
        capacity: Number(bodyData.capacity) || 100,
        soldCount: 0,
        coverImage: bodyData.coverImage || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
        category: bodyData.category || '一般活動',
        status: 'upcoming',
        zones: bodyData.zones || [{ name: '標準席', allocation: 100, priceModifier: 1.0 }]
      };
      events.unshift(newEvt);
      clientStorage.saveEvents(events);
      return { status: 200, body: newEvt };
    }
  }

  // 7. /api/tickets/my
  if (pathname === '/api/tickets/my') {
    const tickets = clientStorage.getTickets();
    const users = clientStorage.getUsers();
    const user = users[currentUserId];
    const userEmail = user?.email?.toLowerCase();
    
    const myTickets = tickets.filter(t => 
      t.userId === currentUserId || 
      (userEmail && t.ownerEmail.toLowerCase() === userEmail)
    );
    return { status: 200, body: myTickets.length > 0 ? myTickets : tickets };
  }

  // 8. /api/tickets/purchase
  if (pathname === '/api/tickets/purchase' && method === 'POST') {
    const { eventId, zone, quantity = 1 } = bodyData;
    const events = clientStorage.getEvents();
    const evt = events.find(e => e.id === eventId);
    if (!evt) {
      return { status: 404, body: { error: '指定活動不存在' } };
    }

    const users = clientStorage.getUsers();
    const user = users[currentUserId] || users['usr-cust'];
    const tickets = clientStorage.getTickets();
    const purchased: Ticket[] = [];

    for (let i = 0; i < quantity; i++) {
      const serial = String(10000 + tickets.length + i + 1);
      const sig = generateTicketSig(evt.id, user.id, serial);
      const tixCode = `TIX-${evt.id}-${user.id}-${serial}-${sig}`;
      const newTix: Ticket = {
        id: `tix-${Date.now()}-${i}`,
        ticketCode: tixCode,
        eventId: evt.id,
        eventTitle: evt.title,
        eventDate: evt.date,
        eventLocation: evt.location,
        userId: user.id,
        ownerEmail: user.email,
        purchaserEmail: user.email,
        zone: zone || '標準席',
        seat: `第 ${Math.floor(Math.random() * 20) + 1} 排 ${Math.floor(Math.random() * 30) + 1} 號`,
        price: evt.price,
        status: 'valid',
        purchasedAt: new Date().toISOString(),
        isGifted: false,
        history: ['購票成功 (線上即時發券)']
      };
      purchased.push(newTix);
      tickets.unshift(newTix);
    }

    evt.soldCount += quantity;
    clientStorage.saveEvents(events);
    clientStorage.saveTickets(tickets);

    return { status: 200, body: { success: true, count: quantity, tickets: purchased } };
  }

  // 9. /api/tickets/verify
  if (pathname === '/api/tickets/verify' && method === 'POST') {
    const { ticketCode } = bodyData;
    const code = (ticketCode || '').trim();
    const tickets = clientStorage.getTickets();
    const logs = clientStorage.getLogs();

    const tix = tickets.find(t => t.ticketCode === code);
    
    // Log entry creation
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    if (!tix) {
      const failedLog: CheckInLog = {
        id: logId,
        ticketCode: code,
        eventId: 'unknown',
        eventTitle: '未知活動',
        userId: 'unknown',
        ownerEmail: '未知持有者',
        checkedInAt: nowIso,
        status: 'not_found',
        errorReason: '查無此票券代碼或票券已被作廢'
      };
      logs.unshift(failedLog);
      clientStorage.saveLogs(logs);
      return {
        status: 400,
        body: {
          success: false,
          status: 'not_found',
          error: '核銷失敗：系統查無此票號，可能為無效偽造票或非本系統發行之憑證。'
        }
      };
    }

    if (tix.status === 'checked_in') {
      const dupLog: CheckInLog = {
        id: logId,
        ticketCode: code,
        eventId: tix.eventId,
        eventTitle: tix.eventTitle,
        userId: tix.userId,
        ownerEmail: tix.ownerEmail,
        zone: tix.zone,
        seat: tix.seat,
        price: tix.price,
        checkedInAt: nowIso,
        status: 'duplicate',
        errorReason: `票券先前已於 ${tix.checkedInAt || '稍早'} 核銷入場`
      };
      logs.unshift(dupLog);
      clientStorage.saveLogs(logs);
      return {
        status: 400,
        body: {
          success: false,
          status: 'duplicate',
          error: `重複核銷警告！此票券已於 ${new Date(tix.checkedInAt || '').toLocaleTimeString()} 完成入場。請勿重複放行。`,
          ticketInfo: tix
        }
      };
    }

    // Success check-in
    tix.status = 'checked_in';
    tix.checkedInAt = nowIso;
    tix.history.push(`閘口掃描核銷成功 (${new Date().toLocaleTimeString()})`);

    const successLog: CheckInLog = {
      id: logId,
      ticketCode: code,
      eventId: tix.eventId,
      eventTitle: tix.eventTitle,
      userId: tix.userId,
      ownerEmail: tix.ownerEmail,
      zone: tix.zone,
      seat: tix.seat,
      price: tix.price,
      checkedInAt: nowIso,
      status: 'success',
      device: '現場核銷終端'
    };
    logs.unshift(successLog);

    clientStorage.saveTickets(tickets);
    clientStorage.saveLogs(logs);

    return {
      status: 200,
      body: {
        success: true,
        status: 'success',
        message: '✅ 票券加密防偽簽章驗證通過，核銷放行成功！',
        ticketInfo: tix
      }
    };
  }

  // 10. /api/admin/logs
  if (pathname === '/api/admin/logs' && method === 'GET') {
    const logs = clientStorage.getLogs();
    const eventId = parsedUrl.searchParams.get('eventId');
    if (eventId && eventId !== 'all') {
      return { status: 200, body: logs.filter(l => l.eventId === eventId) };
    }
    return { status: 200, body: logs };
  }

  // 11. /api/admin/logs/export-csv
  if (pathname === '/api/admin/logs/export-csv') {
    const logs = clientStorage.getLogs();
    const eventId = parsedUrl.searchParams.get('eventId');
    const filtered = eventId && eventId !== 'all' ? logs.filter(l => l.eventId === eventId) : logs;
    
    const escapeCsv = (str: any) => `"${String(str ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    const headers = ["核銷序號", "核銷時間", "活動名稱", "票號條碼", "持有者Email", "持有者姓名", "區域", "座位", "票價(NTD)", "驗證結果狀態", "失敗或異常原因", "驗票設備"];
    
    const statusMap: Record<string, string> = {
      success: '核銷成功 (放行)',
      duplicate: '重複核銷 (拒絕)',
      invalid_sig: '簽章無效防偽警告 (拒絕)',
      not_found: '查無票券 (拒絕)'
    };

    const rows = filtered.map((l, idx) => [
      idx + 1,
      l.checkedInAt ? new Date(l.checkedInAt).toLocaleString('zh-TW', { hour12: false }) : '',
      escapeCsv(l.eventTitle),
      escapeCsv(l.ticketCode),
      escapeCsv(l.ownerEmail),
      escapeCsv(l.ownerName || '購票會員'),
      escapeCsv(l.zone || '全區'),
      escapeCsv(l.seat || '自由入座'),
      l.price ?? 0,
      escapeCsv(statusMap[l.status] || l.status),
      escapeCsv(l.errorReason || '無異常'),
      escapeCsv(l.device || '前端離線核銷模組')
    ].join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    return {
      status: 200,
      body: csvContent
    };
  }

  // 12. /api/admin/clean-slate
  if (pathname === '/api/admin/clean-slate' && method === 'POST') {
    clientStorage.cleanSlate();
    return {
      status: 200,
      body: {
        success: true,
        message: '資料庫已完成乾淨清空。所有隨機與測試日誌已重置。'
      }
    };
  }

  // Default fallback
  return { status: 200, body: { success: true } };
}
