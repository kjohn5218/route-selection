import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import prisma from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'GET') {
    try {
      const { periodId, employeeId } = req.query

      const where: any = {}
      if (periodId) where.periodId = periodId
      if (employeeId) where.employeeId = employeeId

      // Check if user is a driver and restrict access
      if (session.user.role === 'DRIVER') {
        const employee = await prisma.employee.findFirst({
          where: { email: session.user.email },
        })
        
        if (employee) {
          where.employeeId = employee.id
        } else {
          return res.status(403).json({ error: 'Employee record not found' })
        }
      }

      const assignments = await prisma.assignment.findMany({
        where,
        include: {
          employee: true,
          route: true,
          period: true,
        },
        orderBy: [
          { employee: { hireDate: 'asc' } },
          { employee: { lastName: 'asc' } },
        ],
      })

      return res.status(200).json(assignments)
    } catch (error) {
      console.error('Error fetching assignments:', error)
      return res.status(500).json({ error: 'Failed to fetch assignments' })
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}