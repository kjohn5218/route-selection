import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const selectionSchema = z.object({
  employeeId: z.string(),
  periodId: z.string(),
  choice1Id: z.string().nullable(),
  choice2Id: z.string().nullable(),
  choice3Id: z.string().nullable(),
  isManualEntry: z.boolean().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'POST') {
    try {
      const data = selectionSchema.parse(req.body)

      // Validate selection period is open
      const period = await prisma.selectionPeriod.findUnique({
        where: { id: data.periodId },
      })

      if (!period || period.status !== 'OPEN') {
        return res.status(400).json({ error: 'Selection period is not open' })
      }

      // Check if employee already has a selection for this period
      const existingSelection = await prisma.selection.findFirst({
        where: {
          employeeId: data.employeeId,
          periodId: data.periodId,
        },
      })

      if (existingSelection) {
        // Update existing selection
        const updatedSelection = await prisma.selection.update({
          where: { id: existingSelection.id },
          data: {
            choice1Id: data.choice1Id,
            choice2Id: data.choice2Id,
            choice3Id: data.choice3Id,
            submittedAt: new Date(),
            confirmationNumber: existingSelection.confirmationNumber,
          },
        })

        // Log the manual entry
        if (data.isManualEntry) {
          await prisma.auditLog.create({
            data: {
              action: 'MANUAL_SELECTION_UPDATE',
              entityType: 'SELECTION',
              entityId: updatedSelection.id,
              userId: session.user.id,
              details: `Manual selection update for employee ${data.employeeId}`,
            },
          })
        }

        return res.status(200).json(updatedSelection)
      } else {
        // Create new selection
        const confirmationNumber = `SEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const selection = await prisma.selection.create({
          data: {
            employeeId: data.employeeId,
            periodId: data.periodId,
            choice1Id: data.choice1Id,
            choice2Id: data.choice2Id,
            choice3Id: data.choice3Id,
            submittedAt: new Date(),
            confirmationNumber,
          },
        })

        // Log the manual entry
        if (data.isManualEntry) {
          await prisma.auditLog.create({
            data: {
              action: 'MANUAL_SELECTION_CREATE',
              entityType: 'SELECTION',
              entityId: selection.id,
              userId: session.user.id,
              details: `Manual selection entry for employee ${data.employeeId}`,
            },
          })
        }

        return res.status(201).json(selection)
      }
    } catch (error) {
      console.error('Error creating/updating selection:', error)
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request data', details: error.errors })
      }
      return res.status(500).json({ error: 'Failed to save selection' })
    }
  } else if (req.method === 'GET') {
    try {
      const { periodId, employeeId } = req.query

      const where: any = {}
      if (periodId) where.periodId = periodId
      if (employeeId) where.employeeId = employeeId

      const selections = await prisma.selection.findMany({
        where,
        include: {
          employee: true,
          choice1: true,
          choice2: true,
          choice3: true,
          period: true,
        },
        orderBy: [
          { employee: { hireDate: 'asc' } },
          { employee: { lastName: 'asc' } },
        ],
      })

      return res.status(200).json(selections)
    } catch (error) {
      console.error('Error fetching selections:', error)
      return res.status(500).json({ error: 'Failed to fetch selections' })
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}