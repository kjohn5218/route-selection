import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/database.js';

export interface TerminalAccessRequest extends Request {
  allowedTerminals?: string[];
}

// Middleware to check terminal access
export const checkTerminalAccess = async (
  req: TerminalAccessRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        managedTerminals: {
          include: {
            terminal: true,
          },
        },
        terminal: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admins have access to all terminals
    if (user.role === 'ADMIN') {
      const allTerminals = await prisma.terminal.findMany({
        where: { isActive: true },
      });
      console.log('Admin user, found terminals:', allTerminals.length);
      req.allowedTerminals = allTerminals.map(t => t.id);
    } 
    // Managers have access to their managed terminals
    else if (user.role === 'MANAGER') {
      req.allowedTerminals = user.managedTerminals
        .filter(ut => ut.terminal.isActive)
        .map(ut => ut.terminalId);
    } 
    // Drivers have access only to their assigned terminal
    else if (user.role === 'DRIVER' && user.terminalId) {
      req.allowedTerminals = [user.terminalId];
    } 
    else {
      req.allowedTerminals = [];
    }

    next();
  } catch (error) {
    console.error('Terminal access check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to validate terminal ID in request
export const validateTerminalAccess = (
  req: TerminalAccessRequest,
  res: Response,
  next: NextFunction
) => {
  const terminalId = req.query.terminalId || req.body.terminalId || req.params.terminalId;

  if (!terminalId) {
    return res.status(400).json({ error: 'Terminal ID is required' });
  }

  if (!req.allowedTerminals || !req.allowedTerminals.includes(terminalId as string)) {
    return res.status(403).json({ error: 'Access denied to this terminal' });
  }

  next();
};