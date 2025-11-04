import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import { Play, ArrowLeft, Download, Eye } from 'lucide-react'
import type { SelectionPeriod, Selection, Employee, Route } from '@prisma/client'

type SelectionWithDetails = Selection & {
  employee: Employee
  choice1: Route | null
  choice2: Route | null
  choice3: Route | null
}

export default function ProcessSelections() {
  const router = useRouter()
  const { periodId } = router.query
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [period, setPeriod] = useState<SelectionPeriod | null>(null)
  const [selections, setSelections] = useState<SelectionWithDetails[]>([])
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    if (periodId) {
      fetchData()
    }
  }, [periodId])

  const fetchData = async () => {
    try {
      // Fetch selection period
      const periodRes = await fetch(`/api/selection-periods/${periodId}`)
      if (!periodRes.ok) throw new Error('Failed to fetch period')
      const periodData = await periodRes.json()
      setPeriod(periodData)

      // Fetch all selections for this period
      const selectionsRes = await fetch(`/api/selections?periodId=${periodId}`)
      if (!selectionsRes.ok) throw new Error('Failed to fetch selections')
      const selectionsData = await selectionsRes.json()
      setSelections(selectionsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleProcessSelections = async () => {
    if (!periodId) return

    setProcessing(true)
    try {
      const response = await fetch(`/api/selection-periods/${periodId}/process`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process selections')
      }

      const data = await response.json()
      setResults(data)
      toast.success('Selections processed successfully!')
      
      // Refresh data
      await fetchData()
    } catch (error: any) {
      console.error('Error processing selections:', error)
      toast.error(error.message || 'Failed to process selections')
    } finally {
      setProcessing(false)
    }
  }

  const handleViewResults = () => {
    router.push(`/admin/selection-results?periodId=${periodId}`)
  }

  const handleExportResults = async () => {
    try {
      const response = await fetch(`/api/selection-periods/${periodId}/export`)
      if (!response.ok) throw new Error('Failed to export results')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selection-results-${periodId}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Results exported successfully')
    } catch (error) {
      console.error('Error exporting results:', error)
      toast.error('Failed to export results')
    }
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

  if (!period) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <p>Selection period not found</p>
        </div>
      </Layout>
    )
  }

  const manualSelections = selections.filter(sel => 
    sel.submittedAt && (sel.choice1Id || sel.choice2Id || sel.choice3Id)
  )

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Process Route Selections</h1>
              <p className="text-gray-600 mt-1">{period.name}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* Period Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Selection Period Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge
                  variant={
                    period.status === 'COMPLETED' ? 'default' :
                    period.status === 'PROCESSING' ? 'secondary' :
                    period.status === 'OPEN' ? 'default' :
                    'outline'
                  }
                >
                  {period.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Selections</p>
                <p className="text-xl font-semibold">{selections.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Manual Entries</p>
                <p className="text-xl font-semibold">{manualSelections.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selection Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Selection Summary</CardTitle>
            <CardDescription>
              Overview of submitted selections by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Selections by Entry Method</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Online Submissions:</span>
                    <span className="font-medium">{selections.length - manualSelections.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manual Entries:</span>
                    <span className="font-medium">{manualSelections.length}</span>
                  </div>
                </div>
              </div>

              {manualSelections.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recent Manual Entries</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {manualSelections.slice(0, 5).map((selection) => (
                      <div key={selection.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                        <div>
                          <span className="font-medium">
                            {selection.employee.firstName} {selection.employee.lastName}
                          </span>
                          <span className="text-gray-500 ml-2">
                            ({selection.employee.employeeId})
                          </span>
                        </div>
                        <div className="text-gray-600">
                          Choices: {selection.choice1?.runNumber || '-'}, 
                          {selection.choice2?.runNumber || '-'}, 
                          {selection.choice3?.runNumber || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Process Selections</CardTitle>
            <CardDescription>
              Run the assignment algorithm to process all selections
            </CardDescription>
          </CardHeader>
          <CardContent>
            {period.status === 'COMPLETED' ? (
              <div className="space-y-4">
                <p className="text-green-600">
                  ✓ Selections have been processed successfully
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleViewResults}
                    variant="outline"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Results
                  </Button>
                  <Button
                    onClick={handleExportResults}
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Results
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This will assign routes to all drivers based on their selections and seniority.
                </p>
                <Button
                  onClick={handleProcessSelections}
                  disabled={processing || period.status !== 'OPEN'}
                  size="lg"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Process All Selections
                    </>
                  )}
                </Button>
              </div>
            )}

            {results && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
                <h4 className="font-medium text-green-800 mb-2">Processing Complete!</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Total Processed: {results.totalProcessed}</p>
                  <p>Assigned: {results.totalAssigned}</p>
                  <p>Unassigned: {results.totalUnassigned}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}