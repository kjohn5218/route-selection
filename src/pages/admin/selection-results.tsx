import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { Download, Mail, ArrowLeft, Search, Printer } from 'lucide-react'
import type { Assignment, Employee, Route, SelectionPeriod } from '@prisma/client'

type AssignmentWithDetails = Assignment & {
  employee: Employee
  route: Route | null
}

export default function SelectionResults() {
  const router = useRouter()
  const { periodId } = router.query
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<SelectionPeriod | null>(null)
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sendingEmails, setSendingEmails] = useState(false)

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

      // Fetch assignments
      const assignmentsRes = await fetch(`/api/assignments?periodId=${periodId}`)
      if (!assignmentsRes.ok) throw new Error('Failed to fetch assignments')
      const assignmentsData = await assignmentsRes.json()
      setAssignments(assignmentsData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
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

  const handleSendEmails = async () => {
    setSendingEmails(true)
    try {
      const response = await fetch(`/api/selection-periods/${periodId}/notify`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to send notifications')
      
      const result = await response.json()
      toast.success(`Sent ${result.sent} email notifications`)
    } catch (error) {
      console.error('Error sending emails:', error)
      toast.error('Failed to send email notifications')
    } finally {
      setSendingEmails(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const filteredAssignments = assignments.filter(assignment => {
    const search = searchTerm.toLowerCase()
    const fullName = `${assignment.employee.firstName} ${assignment.employee.lastName}`.toLowerCase()
    const empNumber = assignment.employee.employeeId.toLowerCase()
    const routeNumber = assignment.route?.runNumber.toLowerCase() || ''
    
    return fullName.includes(search) || empNumber.includes(search) || routeNumber.includes(search)
  })

  const assignedCount = assignments.filter(a => a.route).length
  const floatPoolCount = assignments.filter(a => !a.route).length

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 no-print">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Selection Results</h1>
              <p className="text-gray-600 mt-1">{period.name}</p>
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                variant="outline"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={handleSendEmails}
                disabled={sendingEmails}
              >
                {sendingEmails ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Notifications
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{assignments.length}</div>
              <p className="text-xs text-muted-foreground">Total Drivers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{assignedCount}</div>
              <p className="text-xs text-muted-foreground">Assigned Routes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{floatPoolCount}</div>
              <p className="text-xs text-muted-foreground">Float Pool</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-4 no-print">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search by name, employee number, or route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Results</CardTitle>
            <CardDescription>
              Final route assignments for all drivers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Employee</th>
                    <th className="text-left py-2 px-4">Employee #</th>
                    <th className="text-left py-2 px-4">Seniority</th>
                    <th className="text-left py-2 px-4">Assigned Route</th>
                    <th className="text-left py-2 px-4">Choice</th>
                    <th className="text-left py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((assignment, index) => (
                    <tr key={assignment.id} className="border-b">
                      <td className="py-2 px-4">
                        <div>
                          <div className="font-medium">
                            {assignment.employee.firstName} {assignment.employee.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {assignment.employee.email}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-4">{assignment.employee.employeeId}</td>
                      <td className="py-2 px-4">#{index + 1}</td>
                      <td className="py-2 px-4">
                        {assignment.route ? (
                          <div>
                            <div className="font-medium">{assignment.route.runNumber}</div>
                            <div className="text-sm text-gray-500">
                              {assignment.route.origin} → {assignment.route.destination}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">Float Pool</span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {assignment.choiceNumber ? (
                          <Badge variant="outline">
                            {assignment.choiceNumber === 1 && '1st Choice'}
                            {assignment.choiceNumber === 2 && '2nd Choice'}
                            {assignment.choiceNumber === 3 && '3rd Choice'}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2 px-4">
                        {assignment.route ? (
                          <Badge variant="default">Assigned</Badge>
                        ) : (
                          <Badge variant="secondary">Float Pool</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <style jsx>{`
          @media print {
            .no-print {
              display: none;
            }
          }
        `}</style>
      </div>
    </Layout>
  )
}