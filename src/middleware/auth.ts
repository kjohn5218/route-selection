import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/auth.js';
import { AuthUser } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader || '');

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role as 'ADMIN' | 'DRIVER',
      employeeId: decoded.employeeId,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

export const requireDriver = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'DRIVER') {
    return res.status(403).json({ error: 'Driver access required' });
  }

  next();
};

export const requireAdminOrSelf = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const targetEmployeeId = req.params.employeeId || req.body.employeeId;
  
  if (req.user.role === 'ADMIN' || req.user.employeeId === targetEmployeeId) {
    next();
  } else {
    return res.status(403).json({ error: 'Access denied: can only access own data' });
  }
};