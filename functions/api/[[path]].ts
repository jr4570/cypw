/**
 * Cloudflare Pages Functions Edge API Handler
 * Handles all /api/* routes on Cloudflare Pages edge network.
 */

const DEMO_CREDENTIALS = {
  demoMode: true,
  demoLocked: true,
  admin: {
    email: 'admin@ticket.com',
    password: 'admin123',
    name: '系統管理員 (Demo Admin)',
    phone: '0912-345-678',
    role: 'admin'
  },
  adminAlias: {
    email: 'staff@ticket.com',
    password: 'staff123',
    name: '現場主管 (Staff Lead)',
    phone: '0988-123-456',
    role: 'admin'
  },
  customer: {
    email: 'user@ticket.com',
    password: 'user123',
    name: '示範買家 (Demo Buyer)',
    phone: '0977-888-999',
    role: 'customer'
  },
  customerAlias: {
    email: 'customer@ticket.com',
    password: '123456',
    name: '測試買家 (Test Buyer)',
    phone: '0966-222-333',
    role: 'customer'
  }
};

const DEFAULT_SETTINGS = {
  systemName: "程閱安全票務管理平台",
  systemSlogan: "採用加密驗證防偽核銷的高安全智慧票務系統",
  contactPhone: "02-2777-6666",
  demoMode: true,
  demoLocked: true,
  requireApproval: false,
  bannerUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1600&auto=format&fit=crop&q=80"
};

const DEFAULT_EVENTS = [
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
  }
];

export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  const jsonHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  // 1. Settings
  if (pathname === '/api/settings') {
    return new Response(JSON.stringify(DEFAULT_SETTINGS), { status: 200, headers: jsonHeaders });
  }

  // 2. Demo credentials
  if (pathname === '/api/demo/credentials') {
    return new Response(JSON.stringify(DEMO_CREDENTIALS), { status: 200, headers: jsonHeaders });
  }

  // 3. Events
  if (pathname === '/api/events') {
    return new Response(JSON.stringify(DEFAULT_EVENTS), { status: 200, headers: jsonHeaders });
  }

  // 4. Auth login
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await request.json();
      const email = (body.email || '').toLowerCase();
      const password = body.password;
      const role = body.role || 'customer';

      if (email === DEMO_CREDENTIALS.admin.email.toLowerCase() || email === DEMO_CREDENTIALS.adminAlias.email.toLowerCase()) {
        const user = email === DEMO_CREDENTIALS.admin.email.toLowerCase() ? DEMO_CREDENTIALS.admin : DEMO_CREDENTIALS.adminAlias;
        return new Response(JSON.stringify({
          token: `token_${user.role}_demo`,
          user: { id: 'usr-admin-demo', email: user.email, name: user.name, role: user.role, phone: user.phone, createdAt: new Date().toISOString() }
        }), { status: 200, headers: jsonHeaders });
      }

      if (email === DEMO_CREDENTIALS.customer.email.toLowerCase() || email === DEMO_CREDENTIALS.customerAlias.email.toLowerCase()) {
        const user = email === DEMO_CREDENTIALS.customer.email.toLowerCase() ? DEMO_CREDENTIALS.customer : DEMO_CREDENTIALS.customerAlias;
        return new Response(JSON.stringify({
          token: 'token_customer_demo',
          user: { id: 'usr-cust-demo', email: user.email, name: user.name, role: user.role, phone: user.phone, createdAt: new Date().toISOString() }
        }), { status: 200, headers: jsonHeaders });
      }

      // Default demo login accept
      return new Response(JSON.stringify({
        token: `token_${Date.now()}`,
        user: { id: `usr_${Date.now()}`, email, name: email.split('@')[0], role, phone: '', createdAt: new Date().toISOString() }
      }), { status: 200, headers: jsonHeaders });
    } catch {
      return new Response(JSON.stringify({ error: '登入請求解析失敗' }), { status: 400, headers: jsonHeaders });
    }
  }

  // 5. Auth me
  if (pathname === '/api/auth/me') {
    const auth = request.headers.get('Authorization') || '';
    const isAdmin = auth.includes('admin');
    const user = isAdmin ? DEMO_CREDENTIALS.admin : DEMO_CREDENTIALS.customer;
    return new Response(JSON.stringify({
      id: isAdmin ? 'usr-admin-demo' : 'usr-cust-demo',
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      createdAt: new Date().toISOString()
    }), { status: 200, headers: jsonHeaders });
  }

  // Default JSON response for edge routing
  return new Response(JSON.stringify({ success: true, message: 'Cloudflare Edge API' }), { status: 200, headers: jsonHeaders });
}
