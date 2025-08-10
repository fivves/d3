import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';

export interface AuthPayload {
  userId: number;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, jwtSecret) as AuthPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = verifyToken(token);
    (req as any).userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

export async function comparePin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}


