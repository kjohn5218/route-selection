import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { checkTerminalAccess, validateTerminalAccess, TerminalAccessRequest } from '../middleware/terminalAccess.js';

const router = Router();

const createTerminalSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(3),
  isActive: z.boolean().optional().default(true),
});

const updateTerminalSchema = createTerminalSchema.partial();

// GET /api/terminals/accessible - Get terminals accessible by current user
router.get('/accessible', authenticateToken, checkTerminalAccess, async (req: TerminalAccessRequest, res: Response) => {
  try {
    console.log('Allowed terminals for user:', req.allowedTerminals?.length);
    const terminals = await prisma.terminal.findMany({
      where: {
        id: { in: req.allowedTerminals || [] },
        isActive: true,
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });
    console.log('Returning terminals:', terminals.length);

    res.json(terminals);
  } catch (error) {
    console.error('Get accessible terminals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/terminals - Get all terminals
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query;

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const terminals = await prisma.terminal.findMany({
      where,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            employees: true,
            routes: true,
            periods: true,
          },
        },
      },
    });

    res.json(terminals);
  } catch (error) {
    console.error('Get terminals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/terminals/:id - Get single terminal
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const terminal = await prisma.terminal.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            employees: true,
            routes: true,
            periods: true,
            users: true,
          },
        },
      },
    });

    if (!terminal) {
      return res.status(404).json({ error: 'Terminal not found' });
    }

    res.json(terminal);
  } catch (error) {
    console.error('Get terminal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/terminals - Create new terminal (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = createTerminalSchema.parse(req.body);

    // Check if terminal code already exists
    const existingTerminal = await prisma.terminal.findUnique({
      where: { code: data.code },
    });

    if (existingTerminal) {
      return res.status(409).json({ error: 'Terminal with this code already exists' });
    }

    const terminal = await prisma.terminal.create({
      data,
    });

    res.status(201).json(terminal);
  } catch (error) {
    console.error('Create terminal error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/terminals/:id - Update terminal (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = updateTerminalSchema.parse(req.body);

    // Check if terminal exists
    const existingTerminal = await prisma.terminal.findUnique({
      where: { id: req.params.id },
    });

    if (!existingTerminal) {
      return res.status(404).json({ error: 'Terminal not found' });
    }

    // Check if code is being changed and if it conflicts
    if (data.code && data.code !== existingTerminal.code) {
      const conflictingTerminal = await prisma.terminal.findUnique({
        where: { code: data.code },
      });

      if (conflictingTerminal) {
        return res.status(409).json({ error: 'Terminal with this code already exists' });
      }
    }

    const terminal = await prisma.terminal.update({
      where: { id: req.params.id },
      data,
    });

    res.json(terminal);
  } catch (error) {
    console.error('Update terminal error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/terminals/:id - Delete terminal (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Check if terminal exists
    const existingTerminal = await prisma.terminal.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            employees: true,
            routes: true,
            periods: true,
            users: true,
          },
        },
      },
    });

    if (!existingTerminal) {
      return res.status(404).json({ error: 'Terminal not found' });
    }

    // Check if terminal has any associated data
    const hasData = 
      existingTerminal._count.employees > 0 ||
      existingTerminal._count.routes > 0 ||
      existingTerminal._count.periods > 0 ||
      existingTerminal._count.users > 0;

    if (hasData) {
      return res.status(409).json({ 
        error: 'Cannot delete terminal with associated data. Consider deactivating it instead.' 
      });
    }

    await prisma.terminal.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete terminal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;