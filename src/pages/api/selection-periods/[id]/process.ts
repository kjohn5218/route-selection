import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import prisma from '@/lib/prisma'
import { processSelections } from '@/services/assignmentEngine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { id } = req.query

  if (req.method === 'POST') {
    try {
      // Get the selection period
      const period = await prisma.selectionPeriod.findUnique({
        where: { id: id as string },
        include: { terminal: true },
      })

      if (!period) {
        return res.status(404).json({ error: 'Selection period not found' })
      }

      if (period.status !== 'OPEN') {
        return res.status(400).json({ error: 'Selection period is not open' })
      }

      // Update status to processing
      await prisma.selectionPeriod.update({
        where: { id: period.id },
        data: { status: 'PROCESSING' },
      })

      // Process the selections
      const result = await processSelections(period.id)

      // Update status to completed
      await prisma.selectionPeriod.update({
        where: { id: period.id },
        data: { status: 'COMPLETED' },
      })

      // Log the processing
      await prisma.auditLog.create({
        data: {
          action: 'PROCESS_SELECTIONS',
          entityType: 'SELECTION_PERIOD',
          entityId: period.id,
          userId: session.user.id,
          details: `Processed selections for ${period.name}. Results: ${result.totalAssigned} assigned, ${result.totalUnassigned} unassigned.`,
        },
      })

      return res.status(200).json(result)
    } catch (error) {
      console.error('Error processing selections:', error)
      
      // Try to reset status back to OPEN if processing failed
      try {
        await prisma.selectionPeriod.update({
          where: { id: id as string },
          data: { status: 'OPEN' },
        })
      } catch (resetError) {
        console.error('Failed to reset status:', resetError)
      }

      return res.status(500).json({ error: 'Failed to process selections' })
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}