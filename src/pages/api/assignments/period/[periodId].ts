import type { NextApiRequest, NextApiResponse } from 'next'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { periodId } = req.query
  
  if (req.method === 'GET') {
    try {
      // Forward the request to the Express backend
      const response = await fetch(`${API_BASE_URL}/assignments/period/${periodId}`, {
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const error = await response.text()
        return res.status(response.status).json({ error })
      }
      
      const data = await response.json()
      return res.status(200).json(data)
    } catch (error) {
      console.error('Error proxying assignments request:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}