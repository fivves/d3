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
  const count = await prisma.user.count();
  const first = count > 0 ? await prisma.user.findFirst({ orderBy: { id: 'asc' } }) : null;
  res.json({ initialized: count > 0, hasPin: !!first?.pinHash });
});

// First-time setup: create the single user
app.post('/api/setup', upload.single('avatar'), async (req, res) => {
  const existing = await prisma.user.findFirst();
  if (existing) return res.status(400).json({ error: 'Already set up' });
  const { firstName, lastName, username, weeklySpendCents, pin } = req.body as any;
  const weekly = Number(weeklySpendCents) || 0;
  const pinHash = pin ? await hashPin(String(pin)) : null;
  const avatarData = req.file ? req.file.buffer : undefined;
  const avatarMimeType = req.file ? req.file.mimetype : undefined;
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      username: username || null,
      weeklySpendCents: weekly,
      // Automatically set start date/time at account creation
      startDate: new Date(),
      pinHash,
      isAdmin: true,
      avatarData: avatarData as any,
      avatarMimeType,
    },
  });
  const token = signToken({ userId: user.id });
  const responseUser = { ...user, avatarUrl: `/api/users/${user.id}/avatar` } as any;
  res.json({ token, user: responseUser });
});

// Multi-user: signup and login
app.post('/api/auth/signup', upload.single('avatar'), async (req, res) => {
  const { firstName, lastName, username, weeklySpendCents, pin } = req.body as any;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  const uname = String(username).toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(uname)) return res.status(400).json({ error: 'Invalid username' });
  const exists = await prisma.user.findUnique({ where: { username: uname } });
  if (exists) return res.status(400).json({ error: 'Username already taken' });
  const weekly = Number(weeklySpendCents) || 0;
  const pinHash = pin ? await hashPin(String(pin)) : null;
  const avatarData = req.file ? req.file.buffer : undefined;
  const avatarMimeType = req.file ? req.file.mimetype : undefined;
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      username: uname,
      weeklySpendCents: weekly,
      startDate: new Date(),
      pinHash,
      isAdmin: false,
      avatarData: avatarData as any,
      avatarMimeType,
    },
  });
  const token = signToken({ userId: user.id });
  const responseUser = { ...user, avatarUrl: `/api/users/${user.id}/avatar` } as any;
  res.json({ token, user: responseUser });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, pin } = req.body as any;
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN are required' });
  const user = await prisma.user.findUnique({ where: { username: String(username).toLowerCase() } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.pinHash) return res.status(400).json({ error: 'No PIN set' });
  const ok = await comparePin(String(pin), user.pinHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ userId: user.id });
  const responseUser = { ...user, avatarUrl: user.avatarData ? `/api/users/${user.id}/avatar` : user.avatarUrl } as any;
  res.json({ token, user: responseUser });
});

// Removed unlocked login for multi-user

// Admin guard helper
async function requireAdmin(userId: number) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return !!u?.isAdmin;
}

// Admin: list users (basic info)
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  if (!(await requireAdmin(userId))) return res.status(403).json({ error: 'Admin only' });
  const users = await prisma.user.findMany({
    select: { id: true, username: true, firstName: true, lastName: true, isAdmin: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
  // Compute current points balance per user
  const userIds = users.map(u => u.id);
  let balances: Record<number, number> = {};
  if (userIds.length > 0) {
    try {
      const grouped: Array<{ userId: number; _sum: { points: number | null } }> = await (prisma as any).transaction.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _sum: { points: true },
      });
      for (const g of grouped) balances[g.userId] = g._sum.points || 0;
    } catch {
      // Fallback if groupBy not available
      balances = Object.fromEntries(await Promise.all(userIds.map(async (id:number) => {
        const txs = await prisma.transaction.findMany({ where: { userId: id } });
        const sum = txs.reduce((acc, t) => acc + t.points, 0);
        return [id, sum];
      })));
    }
  }
  const out = users.map(u => ({ ...u, balance: balances[u.id] ?? 0 }));
  res.json({ users: out });
});

// Admin: set a user's points balance (creates an adjustment transaction)
app.post('/api/admin/users/:id/set-points', authMiddleware, async (req, res) => {
  const actorId = (req as any).userId as number;
  if (!(await requireAdmin(actorId))) return res.status(403).json({ error: 'Admin only' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' });
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: 'User not found' });
  const desired = Number((req.body as any)?.points);
  if (!Number.isFinite(desired)) return res.status(400).json({ error: 'points must be a number' });
  const txs = await prisma.transaction.findMany({ where: { userId: id } });
  const current = txs.reduce((acc, t) => acc + t.points, 0);
  const delta = Math.round(desired - current);
  if (delta === 0) return res.json({ userId: id, balance: current, delta: 0, transaction: null });
  const note = `Admin adjustment to ${desired} (delta ${delta > 0 ? '+' : ''}${delta})`;
  const t = await prisma.transaction.create({
    data: { userId: id, points: delta, type: delta >= 0 ? 'earn' : 'deduct', note, date: new Date() }
  });
  res.json({ userId: id, previous: current, balance: current + delta, delta, transaction: t });
});

// Admin: reset/set a user's PIN
app.post('/api/admin/users/:id/reset-pin', authMiddleware, async (req, res) => {
  const actorId = (req as any).userId as number;
  if (!(await requireAdmin(actorId))) return res.status(403).json({ error: 'Admin only' });
  const id = Number(req.params.id);
  const { newPin } = req.body as any;
  const data: any = {};
  if (newPin !== undefined && newPin !== null && String(newPin).length > 0) {
    data.pinHash = await hashPin(String(newPin));
  } else {
    data.pinHash = null;
  }
  const updated = await prisma.user.update({ where: { id }, data });
  res.json({ user: { id: updated.id, username: updated.username, hasPin: !!updated.pinHash } });
});

// Admin: permanently delete a user and all associated data
app.delete('/api/admin/users/:id', authMiddleware, async (req, res) => {
  const actorId = (req as any).userId as number;
  if (!(await requireAdmin(actorId))) return res.status(403).json({ error: 'Admin only' });
  const id = Number(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      const prizes = await tx.prize.findMany({ where: { userId: id }, select: { id: true } });
      const prizeIds = prizes.map(p => p.id);
      if (prizeIds.length > 0) {
        await tx.purchase.deleteMany({ where: { prizeId: { in: prizeIds } } });
      }
      await tx.purchase.deleteMany({ where: { userId: id } });
      await tx.transaction.deleteMany({ where: { userId: id } });
      await tx.moneyEvent.deleteMany({ where: { userId: id } });
      await tx.dailyLog.deleteMany({ where: { userId: id } });
      // @ts-ignore breathDaily exists in schema
      await (tx as any).breathDaily.deleteMany({ where: { userId: id } });
      await tx.prize.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
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

  let log = await prisma.dailyLog.findFirst({ where: { userId, date: d } });
  const desiredUsed = Boolean(used);
  const desiredPaid = desiredUsed ? Boolean(paid) : null;
  const desiredAmount = desiredUsed && paid ? Number(amountCents) || 0 : null;

  if (log) {
    // Update existing daily log for this date
    log = await prisma.dailyLog.update({
      where: { id: log.id },
      data: {
        used: desiredUsed,
        context: context || null,
        paid: desiredPaid,
        amountCents: desiredAmount,
      },
    });

    // If already awarded/deducted points for this log, prevent duplicate
    const existingTx = await prisma.transaction.findFirst({ where: { userId, relatedLogId: log.id } });
    if (existingTx) {
      return res.status(200).json({ log, alreadyLogged: true });
    }
  } else {
    // Create new daily log
    log = await prisma.dailyLog.create({
      data: {
        userId,
        date: d,
        used: desiredUsed,
        context: context || null,
        paid: desiredPaid,
        amountCents: desiredAmount,
      },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(500).json({ error: 'User missing' });

  const txs: any[] = [];
  const moneyEvents: any[] = [];

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

  // Update longest streak if applicable (only when clean day)
  if (!log.used) {
    try {
      const logs = await prisma.dailyLog.findMany({ where: { userId }, orderBy: { date: 'desc' } });
      let current = 0;
      for (const l of logs) {
        if (l.used) break;
        current += 1;
      }
      const u2 = await prisma.user.findUnique({ where: { id: userId } });
      const longest = Math.max(u2?.longestStreakDays || 0, current);
      if (longest !== (u2?.longestStreakDays || 0)) {
        await prisma.user.update({ where: { id: userId }, data: { longestStreakDays: longest } });
      }
    } catch {}
  }

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

// Update prize
app.put('/api/prizes/:id', authMiddleware, upload.single('image'), async (req, res) => {
  const userId = (req as any).userId as number;
  const id = Number(req.params.id);
  const prize = await prisma.prize.findFirst({ where: { id, userId } });
  if (!prize) return res.status(404).json({ error: 'Not found' });
  const { name, description, costPoints } = req.body as any;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (costPoints !== undefined) {
    const cost = Number(costPoints);
    if (Number.isNaN(cost)) return res.status(400).json({ error: 'costPoints must be a number' });
    data.costPoints = cost;
  }
  if (req.file) {
    data.imageData = req.file.buffer as any;
    data.imageMimeType = req.file.mimetype;
  }
  const updated = await prisma.prize.update({ where: { id }, data });
  const responsePrize = { ...updated, imageUrl: updated.imageData ? `/api/prizes/${updated.id}/image` : updated.imageUrl } as any;
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
  const points = status === 'complete' ? 1 : -5;
  const note = status === 'complete' ? 'Checklist complete (+1)' : 'Checklist missed (-5)';
  const when = date ? new Date(date) : new Date();
  const tx = await prisma.transaction.create({ data: { userId, points, type: status === 'complete' ? 'earn' : 'deduct', note, date: when } });
  res.json({ transaction: tx });
});

// Checklist daily state
app.get('/api/motivation/checklist/status', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const dateStr = (req.query.date as string) || '';
  const today = dateStr ? dayjs(dateStr).startOf('day').toDate() : dayjs().startOf('day').toDate();
  const row = await (prisma as any).checklistDaily.findFirst({ where: { userId, date: today } });
  const checked = row?.checked || [];
  const scored = row?.scored || '';
  res.json({ date: today, checked, scored });
});

app.put('/api/motivation/checklist/status', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { checked, scored, date } = req.body as any;
  const dateStr = (req.query.date as string) || date || '';
  const today = dateStr ? dayjs(dateStr).startOf('day').toDate() : dayjs().startOf('day').toDate();
  const row = await (prisma as any).checklistDaily.upsert({
    where: { userId_date: { userId, date: today } as any },
    create: { userId, date: today, checked: checked || [], scored: scored || null },
    update: { checked: checked || [], scored: scored || null },
  });
  res.json({ date: row.date, checked: row.checked, scored: row.scored || '' });
});

// Motivation: Urge surfing completion (+1 per full 15-min session)
app.post('/api/motivation/urge/complete', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const tx = await prisma.transaction.create({ data: { userId, points: 1, type: 'earn', note: 'Breathing complete (+1)', date: new Date() } });
  res.json({ transaction: tx });
});

// Breathing (1-min sessions): get today's status
app.get('/api/motivation/breath/status', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const dateStr = (req.query.date as string) || '';
  const today = dateStr ? dayjs(dateStr).startOf('day').toDate() : dayjs().startOf('day').toDate();
  const row = await prisma.breathDaily.findFirst({ where: { userId, date: today } });
  res.json({ date: today, count: row?.count || 0, scored: !!row?.scored });
});

// Breathing (1-min sessions): record one session, award +1 on 3rd (server-side)
app.post('/api/motivation/breath/record', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const dateStr = (req.query.date as string) || (req.body?.date as string) || '';
  const today = dateStr ? dayjs(dateStr).startOf('day').toDate() : dayjs().startOf('day').toDate();
  try {
    const existing = await prisma.breathDaily.upsert({
      where: { userId_date: { userId, date: today } as any },
      create: { userId, date: today, count: 0, scored: false },
      update: {},
    });
    const nextCount = existing.count + 1;
    let awarded = false;
    if (nextCount >= 3 && !existing.scored) {
      await prisma.$transaction([
        prisma.transaction.create({ data: { userId, points: 1, type: 'earn', note: 'Breathing complete (+1)', date: new Date() } }),
        prisma.breathDaily.update({ where: { id: existing.id }, data: { count: { increment: 1 }, scored: true } }),
      ]);
      awarded = true;
    } else {
      await prisma.breathDaily.update({ where: { id: existing.id }, data: { count: { increment: 1 } } });
    }
    const row = await prisma.breathDaily.findUnique({ where: { id: existing.id } });
    res.json({ date: today, count: row?.count || 0, scored: !!row?.scored, awarded });
  } catch (e) {
    res.status(500).json({ error: 'Failed to record session' });
  }
});

// Journal: get today's entry (if any)
app.get('/api/journal/today', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const dateStr = (req.query.date as string) || '';
  const today = dateStr ? dayjs(dateStr).startOf('day').toDate() : dayjs().startOf('day').toDate();
  const log = await prisma.dailyLog.findFirst({ where: { userId, date: today } });
  res.json({ log });
});

// Journal: upsert today's entry (editable only today)
app.put('/api/journal/today', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const { journal, mood, date } = req.body as any;
  const dateStr = (req.query.date as string) || date || '';
  const today = dateStr ? dayjs(dateStr).startOf('day').toDate() : dayjs().startOf('day').toDate();
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
  // Award +1 point only on first non-empty journal entry of the day
  try {
    const wasEmpty = !existing || !existing.journal;
    const nowHasContent = (data.journal && String(data.journal).trim().length > 0);
    if (wasEmpty && nowHasContent) {
      await prisma.transaction.create({ data: { userId, points: 1, type: 'earn', note: 'Journal entry (+1)' } });
    }
  } catch {}
  res.json({ log });
});

// Journal: list all entries with journal content (newest first)
app.get('/api/journal', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  const logs = await prisma.dailyLog.findMany({ where: { userId, NOT: { journal: null } }, orderBy: { date: 'desc' } });
  res.json({ logs });
});

// Admin: reset database (keep quotes)
app.post('/api/admin/reset', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  if (!(await requireAdmin(userId))) return res.status(403).json({ error: 'Admin only' });
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
app.get('/api/admin/backup', authMiddleware, async (req, res) => {
  const userId = (req as any).userId as number;
  if (!(await requireAdmin(userId))) return res.status(403).json({ error: 'Admin only' });
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
  const userId = (req as any).userId as number;
  if (!(await requireAdmin(userId))) return res.status(403).json({ error: 'Admin only' });
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

// One-time bootstrap to backfill username for single-user legacy installs
(async () => {
  try {
    const count = await prisma.user.count();
    if (count === 1) {
      const u = await prisma.user.findFirst();
      if (u && !u.username) {
        const uname = 'eddie';
        const safe = uname.toLowerCase();
        const exists = await prisma.user.findUnique({ where: { username: safe } });
        if (!exists) {
          await prisma.user.update({ where: { id: u.id }, data: { username: safe, isAdmin: true } });
          console.log('Backfilled username for legacy user: eddie');
        }
      }
    }
  } catch {}
})();

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


