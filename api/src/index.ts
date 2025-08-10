import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { prisma } from './prisma.js';
import { authMiddleware, comparePin, hashPin, signToken } from './auth.js';
import multer from 'multer';
import dayjs from 'dayjs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(morgan('dev'));

const uploadDir = path.join(process.cwd(), 'uploads');
const upload = multer({ storage: multer.memoryStorage() });
app.use('/api/uploads', express.static(uploadDir));

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Setup status
app.get('/api/setup/status', async (_req, res) => {
  const user = await prisma.user.findFirst();
  res.json({ initialized: !!user, hasPin: !!user?.pinHash });
});

// First-time setup: create the single user
app.post('/api/setup', upload.single('avatar'), async (req, res) => {
  const existing = await prisma.user.findFirst();
  if (existing) return res.status(400).json({ error: 'Already set up' });
  const { firstName, lastName, weeklySpendCents, pin } = req.body as any;
  const weekly = Number(weeklySpendCents) || 0;
  const pinHash = pin ? await hashPin(String(pin)) : null;
  const avatarData = req.file ? req.file.buffer : undefined;
  const avatarMimeType = req.file ? req.file.mimetype : undefined;
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      weeklySpendCents: weekly,
      // Automatically set start date/time at account creation
      startDate: new Date(),
      pinHash,
      avatarData: avatarData as any,
      avatarMimeType,
    },
  });
  const token = signToken({ userId: user.id });
  const responseUser = { ...user, avatarUrl: `/api/users/${user.id}/avatar` } as any;
  res.json({ token, user: responseUser });
});

// Login with pin
app.post('/api/auth/login', async (req, res) => {
  const { pin } = req.body as any;
  const user = await prisma.user.findFirst();
  if (!user) return res.status(400).json({ error: 'Not set up' });
  if (!user.pinHash) return res.status(400).json({ error: 'No PIN set' });
  const ok = await comparePin(String(pin), user.pinHash);
  if (!ok) return res.status(401).json({ error: 'Invalid PIN' });
  const token = signToken({ userId: user.id });
  res.json({ token, user });
});

// Unlocked login if no PIN set
app.post('/api/auth/unlocked', async (_req, res) => {
  const user = await prisma.user.findFirst();
  if (!user) return res.status(400).json({ error: 'Not set up' });
  if (user.pinHash) return res.status(403).json({ error: 'PIN is set' });
  const token = signToken({ userId: user.id });
  res.json({ token, user });
});

// Authenticated routes
app.get('/api/me', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const responseUser = user ? { ...user, avatarUrl: user.avatarData ? `/api/users/${user.id}/avatar` : user.avatarUrl } : null;
  res.json({ user: responseUser });
});

app.put('/api/me', authMiddleware, upload.single('avatar'), async (req, res) => {
  const userId = (req as any).userId as number;
  const { firstName, lastName, weeklySpendCents, startDate, newPin } = req.body as any;
  const data: any = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (weeklySpendCents !== undefined) data.weeklySpendCents = Number(weeklySpendCents) || 0;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (req.file) {
    data.avatarData = req.file.buffer as any;
    data.avatarMimeType = req.file.mimetype;
  }
  if (newPin !== undefined) data.pinHash = newPin ? await hashPin(String(newPin)) : null;
  const user = await prisma.user.update({ where: { id: userId }, data });
  const responseUser = { ...user, avatarUrl: user.avatarData ? `/api/users/${user.id}/avatar` : user.avatarUrl } as any;
  res.json({ user: responseUser });
});

// Logs and points
app.post('/api/logs/daily', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { date, used, context, paid, amountCents } = req.body as any;
  const d = date ? dayjs(date).startOf('day').toDate() : dayjs().startOf('day').toDate();
  const existing = await prisma.dailyLog.findFirst({ where: { userId, date: d } });
  if (existing) return res.status(400).json({ error: 'Already logged for this date' });

  const log = await prisma.dailyLog.create({
    data: {
      userId,
      date: d,
      used: Boolean(used),
      context: context || null,
      paid: used ? Boolean(paid) : null,
      amountCents: used && paid ? Number(amountCents) || 0 : null,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const txs: any[] = [];
  const moneyEvents: any[] = [];

  if (!user) return res.status(500).json({ error: 'User missing' });

  if (!log.used) {
    txs.push({ userId, points: 10, type: 'earn', note: 'Clean day', relatedLogId: log.id });
    const perDay = Math.round((user.weeklySpendCents || 0) / 7);
    if (perDay > 0) moneyEvents.push({ userId, amountCents: perDay, type: 'saved', note: 'Clean day savings', relatedLogId: log.id });
  } else {
    txs.push({ userId, points: -20, type: 'deduct', note: 'Use day', relatedLogId: log.id });
    if (log.paid && log.amountCents && log.amountCents > 0) {
      moneyEvents.push({ userId, amountCents: -Math.abs(log.amountCents), type: 'spent', note: 'THC purchase', relatedLogId: log.id });
    }
  }

  await prisma.$transaction([
    ...txs.map((t) => prisma.transaction.create({ data: t })),
    ...moneyEvents.map((m) => prisma.moneyEvent.create({ data: m })),
  ]);

  res.json({ log });
});

app.get('/api/logs', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const logs = await prisma.dailyLog.findMany({ where: { userId }, orderBy: { date: 'desc' } });
  res.json({ logs });
});

// Bank
app.get('/api/bank/summary', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const transactions = await prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' } });
  const balance = transactions.reduce((acc, t) => acc + t.points, 0);
  const earned = transactions.filter(t => t.points > 0).reduce((a, t) => a + t.points, 0);
  const spent = transactions.filter(t => t.points < 0).reduce((a, t) => a + Math.abs(t.points), 0);
  res.json({ balance, totals: { earned, spent }, transactions });
});

// Savings
app.get('/api/savings', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const events = await prisma.moneyEvent.findMany({ where: { userId }, orderBy: { date: 'desc' } });
  const saved = events.filter(e => e.amountCents > 0).reduce((a, e) => a + e.amountCents, 0);
  const spent = events.filter(e => e.amountCents < 0).reduce((a, e) => a + Math.abs(e.amountCents), 0);
  const net = saved - spent;
  res.json({ saved, spent, net, events });
});

// Prizes
app.get('/api/prizes', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const prizes = await prisma.prize.findMany({ where: { userId }, include: { purchases: true }, orderBy: { createdAt: 'desc' } });
  const withUrls = prizes.map(p => ({
    ...p,
    imageUrl: p.imageData ? `/api/prizes/${p.id}/image` : p.imageUrl,
  }));
  res.json({ prizes: withUrls });
});

app.post('/api/prizes', authMiddleware, upload.single('image'), async (req, res) => {
  const userId = (req as any).userId as number;
  const { name, description, costPoints } = req.body as any;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const cost = Number(costPoints);
  if (Number.isNaN(cost)) return res.status(400).json({ error: 'costPoints must be a number' });
  const data: any = { userId, name, description, costPoints: cost || 0 };
  if (req.file) {
    data.imageData = req.file.buffer as any;
    data.imageMimeType = req.file.mimetype;
  }
  const prize = await prisma.prize.create({ data });
  const responsePrize = { ...prize, imageUrl: prize.imageData ? `/api/prizes/${prize.id}/image` : prize.imageUrl } as any;
  res.json({ prize: responsePrize });
});

app.post('/api/prizes/:id/purchase', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  const prize = await prisma.prize.findFirst({ where: { id, userId } });
  if (!prize) return res.status(404).json({ error: 'Not found' });
  if (!prize.active) return res.status(400).json({ error: 'Already purchased; restock to buy again' });
  const transactions = await prisma.transaction.findMany({ where: { userId } });
  const balance = transactions.reduce((acc, t) => acc + t.points, 0);
  if (balance < prize.costPoints) return res.status(400).json({ error: 'Insufficient points' });
  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({ data: { userId, prizeId: prize.id } });
    await tx.transaction.create({ data: { userId, points: -Math.abs(prize.costPoints), type: 'spend', note: `Purchased ${prize.name}`, relatedPrizeId: prize.id } });
    const updated = await tx.prize.update({ where: { id: prize.id }, data: { active: false } });
    return { purchase, prize: updated };
  });
  res.json(result);
});

app.post('/api/prizes/:id/restock', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  const prize = await prisma.prize.findFirst({ where: { id, userId } });
  if (!prize) return res.status(404).json({ error: 'Not found' });
  const updated = await prisma.prize.update({ where: { id }, data: { active: true } });
  res.json({ prize: updated });
});

// Delete prize (and its purchases)
app.delete('/api/prizes/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  const prize = await prisma.prize.findFirst({ where: { id, userId } });
  if (!prize) return res.status(404).json({ error: 'Not found' });
  await prisma.$transaction([
    prisma.purchase.deleteMany({ where: { prizeId: id, userId } }),
    prisma.prize.delete({ where: { id } })
  ]);
  res.json({ ok: true });
});

// Motivation quotes
const fallbackQuotes = [
  { text: 'Discipline is choosing what you want most over what you want now.', author: 'Abraham Lincoln' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', author: 'Will Durant' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'The only way to achieve the impossible is to believe it is possible and work for it daily.', author: 'Unknown' },
  { text: 'Motivation gets you going, but discipline keeps you growing.', author: 'John C. Maxwell' },
  { text: 'Suffer the pain of discipline or the pain of regret.', author: 'Jim Rohn' },
  { text: 'Tiny gains, remarkable results.', author: 'James Clear' },
  { text: 'The only way out is through.', author: 'Robert Frost' },
  { text: 'Action is the antidote to anxiety.', author: 'Naval Ravikant' },
  { text: 'Fall in love with the process and the results will come.', author: 'Eric Thomas' },
  { text: 'Hard choices, easy life. Easy choices, hard life.', author: 'Jerzy Gregorek' },
  { text: 'First we form habits, then they form us.', author: 'John Dryden' },
  { text: 'The secret of your future is hidden in your daily routine.', author: 'Mike Murdock' },
  { text: 'Discipline equals freedom.', author: 'Jocko Willink' },
  { text: 'Mood follows action.', author: 'Rich Roll' },
  { text: 'What you practice grows stronger.', author: 'Shauna Shapiro' },
  { text: 'Cravings are waves—learn to surf them.', author: 'Urge Surfing' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
];

app.get('/api/motivation/quotes', async (_req, res) => {
  const all = await prisma.motivationQuote.findMany({ orderBy: { id: 'asc' } });
  const pool = all.length > 0 ? all : fallbackQuotes;
  const todayIndex = dayjs().diff(dayjs().startOf('year'), 'day');
  const size = Math.min(6, pool.length);
  const start = pool.length > 0 ? (todayIndex % pool.length) : 0;
  const quotes: any[] = [];
  for (let i = 0; i < size; i++) {
    quotes.push(pool[(start + i) % pool.length]);
  }
  res.json({ quotes });
});

app.get('/api/motivation/random', async (_req, res) => {
  const count = await prisma.motivationQuote.count();
  const skip = Math.max(0, Math.floor(Math.random() * count));
  const one = await prisma.motivationQuote.findFirst({ skip });
  res.json({ quote: one });
});

// Motivation: Make it Obvious checklist scoring (+5 complete, -5 missed)
app.post('/api/motivation/checklist/score', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { status, date } = req.body as any;
  if (status !== 'complete' && status !== 'missed') return res.status(400).json({ error: 'Invalid status' });
  const points = status === 'complete' ? 5 : -5;
  const note = status === 'complete' ? 'Checklist complete' : 'Checklist missed';
  const when = date ? new Date(date) : new Date();
  const tx = await prisma.transaction.create({ data: { userId, points, type: status === 'complete' ? 'earn' : 'deduct', note, date: when } });
  res.json({ transaction: tx });
});

// Journal: get today's entry (if any)
app.get('/api/journal/today', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const today = dayjs().startOf('day').toDate();
  const log = await prisma.dailyLog.findFirst({ where: { userId, date: today } });
  res.json({ log });
});

// Journal: upsert today's entry (editable only today)
app.put('/api/journal/today', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { journal, mood } = req.body as any;
  const today = dayjs().startOf('day').toDate();
  // Only allow editing for today
  const existing = await prisma.dailyLog.findFirst({ where: { userId, date: today } });
  const moodInt = mood === null || mood === undefined ? null : Number(mood);
  const data: any = { journal: journal ?? null, mood: moodInt ?? null };
  let log;
  if (existing) {
    log = await prisma.dailyLog.update({ where: { id: existing.id }, data });
  } else {
    log = await prisma.dailyLog.create({ data: { userId, date: today, used: false, context: null, paid: null, amountCents: null, ...data } });
  }
  res.json({ log });
});

// Journal: list all entries with journal content (newest first)
app.get('/api/journal', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const logs = await prisma.dailyLog.findMany({ where: { userId, NOT: { journal: null } }, orderBy: { date: 'desc' } });
  res.json({ logs });
});

// Admin: reset database (keep quotes)
app.post('/api/admin/reset', authMiddleware, async (_req, res) => {
  await prisma.$transaction([
    prisma.purchase.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.moneyEvent.deleteMany({}),
    prisma.dailyLog.deleteMany({}),
    prisma.prize.deleteMany({}),
    prisma.user.deleteMany({})
  ]);
  res.json({ ok: true });
});

// Admin: backup/restore
app.get('/api/admin/backup', authMiddleware, async (_req, res) => {
  const [users, logs, txs, prizes, purchases, moneyEvents, quotes] = await Promise.all([
    prisma.user.findMany({}),
    prisma.dailyLog.findMany({}),
    prisma.transaction.findMany({}),
    prisma.prize.findMany({}),
    prisma.purchase.findMany({}),
    prisma.moneyEvent.findMany({}),
    prisma.motivationQuote.findMany({}),
  ]);
  // Convert binary to base64
  const usersOut = users.map((u:any) => ({
    ...u,
    avatarData: u.avatarData ? Buffer.from(u.avatarData as any).toString('base64') : null,
  }));
  const prizesOut = prizes.map((p:any) => ({
    ...p,
    imageData: p.imageData ? Buffer.from(p.imageData as any).toString('base64') : null,
  }));
  res.json({ users: usersOut, logs, transactions: txs, prizes: prizesOut, purchases, moneyEvents, quotes });
});

app.post('/api/admin/restore', authMiddleware, async (req, res) => {
  const { users = [], logs = [], transactions = [], prizes = [], purchases = [], moneyEvents = [], quotes = [] } = req.body || {};
  // Wipe current data (keep quotes will be replaced below)
  await prisma.$transaction([
    prisma.purchase.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.moneyEvent.deleteMany({}),
    prisma.dailyLog.deleteMany({}),
    prisma.prize.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.motivationQuote.deleteMany({}),
  ]);

  // Re-create with explicit IDs
  const usersData = (users as any[]).map(u => ({
    ...u,
    avatarData: u.avatarData ? Buffer.from(u.avatarData, 'base64') : null,
  }));
  for (const u of usersData) await prisma.user.create({ data: u });

  const prizesData = (prizes as any[]).map(p => ({
    ...p,
    imageData: p.imageData ? Buffer.from(p.imageData, 'base64') : null,
  }));
  for (const p of prizesData) await prisma.prize.create({ data: p });

  for (const q of quotes as any[]) await prisma.motivationQuote.create({ data: q });
  for (const l of logs as any[]) await prisma.dailyLog.create({ data: l });
  for (const t of transactions as any[]) await prisma.transaction.create({ data: t });
  for (const m of moneyEvents as any[]) await prisma.moneyEvent.create({ data: m });
  for (const pc of purchases as any[]) await prisma.purchase.create({ data: pc });

  // Advance sequences for Postgres (best-effort)
  try {
    const tables = [
      '"User"', '"DailyLog"', '"Transaction"', '"Prize"', '"Purchase"', '"MoneyEvent"', '"MotivationQuote"'
    ];
    for (const t of tables) {
      await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence(${t}, 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1));`);
    }
  } catch {}

  res.json({ ok: true });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});

// Binary image routes
app.get('/api/users/:id/avatar', async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.avatarData) return res.status(404).end();
  res.setHeader('Content-Type', user.avatarMimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(user.avatarData as any));
});

app.get('/api/prizes/:id/image', async (req, res) => {
  const id = Number(req.params.id);
  const prize = await prisma.prize.findUnique({ where: { id } });
  if (!prize || !prize.imageData) return res.status(404).end();
  res.setHeader('Content-Type', prize.imageMimeType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(prize.imageData as any));
});


