import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { PrintableRouteForm } from '@/components/PrintableRouteForm'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Route, SelectionPeriod, Terminal } from '@prisma/client'

export default function PrintRouteForm() {
  const router = useRouter()
  const { periodId, terminalId } = router.query
  const [loading, setLoading] = useState(true)
  const [routes, setRoutes] = useState<(Route & { terminal: Terminal })[]>([])
  const [selectionPeriod, setSelectionPeriod] = useState<SelectionPeriod | null>(null)
  const [terminal, setTerminal] = useState<Terminal | null>(null)

  useEffect(() => {
    if (periodId && terminalId) {
      fetchData()
    }
  }, [periodId, terminalId])

  const fetchData = async () => {
    try {
      // Fetch selection period
      const periodRes = await fetch(`/api/selection-periods/${periodId}`)
      if (!periodRes.ok) throw new Error('Failed to fetch selection period')
      const periodData = await periodRes.json()
      setSelectionPeriod(periodData)

      // Fetch terminal
      const terminalRes = await fetch(`/api/terminals/${terminalId}`)
      if (!terminalRes.ok) throw new Error('Failed to fetch terminal')
      const terminalData = await terminalRes.json()
      setTerminal(terminalData)

      // Fetch routes for this period
      const routesRes = await fetch(`/api/selection-periods/${periodId}/routes`)
      if (!routesRes.ok) throw new Error('Failed to fetch routes')
      const routesData = await routesRes.json()
      setRoutes(routesData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load form data')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  if (!selectionPeriod || !terminal) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p>Failed to load form data</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 no-print">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Print Route Selection Form</h1>
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print Form
              </Button>
            </div>
          </div>
        </div>

        <PrintableRouteForm 
          routes={routes} 
          selectionPeriod={selectionPeriod}
          terminal={terminal}
        />
      </div>
    </Layout>
  )
}