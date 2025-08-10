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
app.use(express.json());
app.use(morgan('dev'));

const uploadDir = path.join(process.cwd(), 'uploads');
const upload = multer({ dest: uploadDir });
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
  const { firstName, lastName, weeklySpendCents, startDate, pin } = req.body as any;
  const weekly = Number(weeklySpendCents) || 0;
  const pinHash = pin ? await hashPin(String(pin)) : null;
  const avatarUrl = req.file ? `/api/uploads/${req.file.filename}` : undefined;
  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      weeklySpendCents: weekly,
      startDate: startDate ? new Date(startDate) : null,
      pinHash,
      avatarUrl,
    },
  });
  const token = signToken({ userId: user.id });
  res.json({ token, user });
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
  res.json({ user });
});

app.put('/api/me', authMiddleware, upload.single('avatar'), async (req, res) => {
  const userId = (req as any).userId as number;
  const { firstName, lastName, weeklySpendCents, startDate, newPin } = req.body as any;
  const data: any = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (weeklySpendCents !== undefined) data.weeklySpendCents = Number(weeklySpendCents) || 0;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (req.file) data.avatarUrl = `/api/uploads/${req.file.filename}`;
  if (newPin !== undefined) data.pinHash = newPin ? await hashPin(String(newPin)) : null;
  const user = await prisma.user.update({ where: { id: userId }, data });
  res.json({ user });
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
  res.json({ prizes });
});

app.post('/api/prizes', authMiddleware, upload.single('image'), async (req, res) => {
  const userId = (req as any).userId as number;
  const { name, description, costPoints } = req.body as any;
  const imageUrl = req.file ? `/api/uploads/${req.file.filename}` : null;
  const prize = await prisma.prize.create({ data: { userId, name, description, costPoints: Number(costPoints) || 0, imageUrl } });
  res.json({ prize });
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

// Motivation quotes
app.get('/api/motivation/quotes', async (_req, res) => {
  const quotes = await prisma.motivationQuote.findMany({ orderBy: { id: 'asc' } });
  res.json({ quotes });
});

app.get('/api/motivation/random', async (_req, res) => {
  const count = await prisma.motivationQuote.count();
  const skip = Math.max(0, Math.floor(Math.random() * count));
  const one = await prisma.motivationQuote.findFirst({ skip });
  res.json({ quote: one });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});


