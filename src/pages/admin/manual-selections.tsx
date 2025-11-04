import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'react-hot-toast'
import { Save, FileText, ArrowLeft, Search } from 'lucide-react'
import type { Employee, SelectionPeriod, Terminal, Route } from '@prisma/client'

interface ManualSelection {
  employeeId: string
  employeeName: string
  employeeNumber: string
  choice1: string
  choice2: string
  choice3: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Helper function to handle API errors
const handleApiError = async (response: Response, context: string) => {
  if (!response.ok) {
    console.error(`[${context}] API Error:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    })
    
    try {
      const errorData = await response.json()
      console.error(`[${context}] Error details:`, errorData)
      throw new Error(errorData.error || `${context} failed`)
    } catch (e) {
      // If JSON parsing fails, try text
      const errorText = await response.text()
      console.error(`[${context}] Error text:`, errorText)
      throw new Error(`${context} failed: ${response.status} ${response.statusText}`)
    }
  }
}

export default function ManualSelections() {
  console.log('=== ManualSelections Component Mounted ===')
  const router = useRouter()
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [selectedTerminal, setSelectedTerminal] = useState('')
  const [selectionPeriods, setSelectionPeriods] = useState<SelectionPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [selections, setSelections] = useState<ManualSelection[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Log auth token
  console.log('Auth token exists:', !!localStorage.getItem('token'))
  console.log('API Base URL:', API_BASE_URL)

  // Global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error)
    }
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  useEffect(() => {
    console.log('Fetching terminals on mount...')
    fetchTerminals()
  }, [])

  useEffect(() => {
    if (selectedTerminal) {
      fetchSelectionPeriods()
    }
  }, [selectedTerminal])

  useEffect(() => {
    if (selectedPeriod && selectedTerminal) {
      fetchEmployeesAndRoutes()
    }
  }, [selectedPeriod, selectedTerminal])

  const fetchTerminals = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/terminals`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      await handleApiError(response, 'Fetch terminals')
      const data = await response.json()
      setTerminals(data)
    } catch (error) {
      console.error('Error fetching terminals:', error)
      toast.error('Failed to load terminals')
    }
  }

  const fetchSelectionPeriods = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/periods?terminalId=${selectedTerminal}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      await handleApiError(response, 'Fetch selection periods')
      const data = await response.json()
      setSelectionPeriods(data)
    } catch (error) {
      console.error('Error fetching selection periods:', error)
      toast.error('Failed to load selection periods')
    }
  }

  const fetchEmployeesAndRoutes = async () => {
    setLoading(true)
    try {
      console.log('Fetching employees and routes for:', {
        terminalId: selectedTerminal,
        periodId: selectedPeriod
      })
      
      // Fetch eligible employees
      const empResponse = await fetch(`${API_BASE_URL}/employees?terminalId=${selectedTerminal}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      await handleApiError(empResponse, 'Fetch employees')
      const empData = await empResponse.json()
      
      // Sort employees by seniority
      const sortedEmployees = empData.sort((a: Employee, b: Employee) => {
        const dateA = new Date(a.hireDate).getTime()
        const dateB = new Date(b.hireDate).getTime()
        if (dateA !== dateB) return dateA - dateB
        return a.lastName.localeCompare(b.lastName)
      })
      
      setEmployees(sortedEmployees)
      
      // Initialize selections for each employee
      const initialSelections = sortedEmployees.map((emp: Employee) => ({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeId,
        choice1: '',
        choice2: '',
        choice3: '',
      }))
      setSelections(initialSelections)

      // Fetch routes for this period
      const routeResponse = await fetch(`${API_BASE_URL}/periods/${selectedPeriod}/routes`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      await handleApiError(routeResponse, 'Fetch routes')
      const routeData = await routeResponse.json()
      console.log('Fetched routes:', routeData)
      setRoutes(routeData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectionChange = (employeeId: string, field: 'choice1' | 'choice2' | 'choice3', value: string) => {
    setSelections(prev => prev.map(sel => 
      sel.employeeId === employeeId 
        ? { ...sel, [field]: value === 'none' ? '' : value }
        : sel
    ))
  }

  const handleSaveSelections = async () => {
    setSaving(true)
    try {
      // Validate selections
      const validSelections = selections.filter(sel => sel.choice1 || sel.choice2 || sel.choice3)
      
      if (validSelections.length === 0) {
        toast.error('No selections to save')
        return
      }

      // Save each selection
      const promises = validSelections.map(async (selection) => {
        const payload = {
          employeeId: selection.employeeId,
          selectionPeriodId: selectedPeriod,
          firstChoiceId: selection.choice1 || null,
          secondChoiceId: selection.choice2 || null,
          thirdChoiceId: selection.choice3 || null,
        }
        
        console.log('Saving selection with payload:', payload)

        const response = await fetch(`${API_BASE_URL}/selections/admin`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}` 
          },
          body: JSON.stringify(payload),
        })

        await handleApiError(response, 'Save selection')

        return response.json()
      })

      await Promise.all(promises)
      toast.success(`Saved ${validSelections.length} selections successfully`)
      
      // Navigate to process selections
      router.push(`/admin/process-selections?periodId=${selectedPeriod}`)
    } catch (error: any) {
      console.error('Error saving selections:', error)
      toast.error(error.message || 'Failed to save selections')
    } finally {
      setSaving(false)
    }
  }

  // Debug routes
  useEffect(() => {
    console.log('Routes state updated:', routes.length, routes)
  }, [routes])

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase()
    const empNumber = emp.employeeId.toLowerCase()
    const search = searchTerm.toLowerCase()
    return fullName.includes(search) || empNumber.includes(search)
  })

  const filteredSelections = selections.filter(sel => {
    const search = searchTerm.toLowerCase()
    return sel.employeeName.toLowerCase().includes(search) || 
           sel.employeeNumber.toLowerCase().includes(search)
  })

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Manual Route Selection Entry</h1>
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
                onClick={() => router.push(`/admin/print-route-form?periodId=${selectedPeriod}&terminalId=${selectedTerminal}`)}
                disabled={!selectedPeriod || !selectedTerminal}
              >
                <FileText className="w-4 h-4 mr-2" />
                Print Blank Forms
              </Button>
            </div>
          </div>
        </div>

        {/* Selection Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Selection Period</CardTitle>
            <CardDescription>Choose the terminal and selection period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="terminal">Terminal</Label>
                <Select value={selectedTerminal} onValueChange={setSelectedTerminal}>
                  <SelectTrigger id="terminal">
                    <SelectValue placeholder="Select a terminal" />
                  </SelectTrigger>
                  <SelectContent>
                    {terminals.map((terminal) => (
                      <SelectItem key={terminal.id} value={terminal.id}>
                        {terminal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="period">Selection Period</Label>
                <Select 
                  value={selectedPeriod} 
                  onValueChange={setSelectedPeriod}
                  disabled={!selectedTerminal}
                >
                  <SelectTrigger id="period">
                    <SelectValue placeholder="Select a period" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectionPeriods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.name} ({period.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Search */}
        {selectedPeriod && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by employee name or number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Manual Entry Form */}
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </CardContent>
          </Card>
        ) : selectedPeriod && filteredSelections.length > 0 ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Driver Route Selections</CardTitle>
                <CardDescription>
                  Enter route selections for each driver. Drivers are listed in seniority order.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Employee</th>
                        <th className="text-left py-2 px-4">Employee #</th>
                        <th className="text-left py-2 px-4">1st Choice</th>
                        <th className="text-left py-2 px-4">2nd Choice</th>
                        <th className="text-left py-2 px-4">3rd Choice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSelections.map((selection, index) => {
                        const employee = employees.find(emp => emp.id === selection.employeeId)
                        console.log('Rendering selection row for:', selection.employeeName, 'Routes available:', routes.length)
                        return (
                          <tr key={selection.employeeId} className="border-b">
                            <td className="py-2 px-4">
                              <div>
                                <div className="font-medium">{selection.employeeName}</div>
                                <div className="text-sm text-gray-500">
                                  Seniority #{employees.indexOf(employee!) + 1}
                                </div>
                              </div>
                            </td>
                            <td className="py-2 px-4">{selection.employeeNumber}</td>
                            <td className="py-2 px-4">
                              <Select
                                value={selection.choice1}
                                onValueChange={(value) => handleSelectionChange(selection.employeeId, 'choice1', value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {routes && routes.length > 0 ? (
                                    routes
                                      .filter(route => {
                                        if (!employee) return false
                                        if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) return false
                                        if (route.requiresChainExperience && !employee.chainExperience) return false
                                        return true
                                      })
                                      .map((route) => (
                                        <SelectItem key={route.id} value={route.id}>
                                          Route {route.runNumber}
                                        </SelectItem>
                                      ))
                                  ) : (
                                    <SelectItem value="no-routes" disabled>No routes available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-4">
                              <Select
                                value={selection.choice2}
                                onValueChange={(value) => handleSelectionChange(selection.employeeId, 'choice2', value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {routes && routes.length > 0 ? (
                                    routes
                                      .filter(route => {
                                        if (!employee) return false
                                        if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) return false
                                        if (route.requiresChainExperience && !employee.chainExperience) return false
                                        return true
                                      })
                                      .map((route) => (
                                        <SelectItem key={route.id} value={route.id}>
                                          Route {route.runNumber}
                                        </SelectItem>
                                      ))
                                  ) : (
                                    <SelectItem value="no-routes" disabled>No routes available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-4">
                              <Select
                                value={selection.choice3}
                                onValueChange={(value) => handleSelectionChange(selection.employeeId, 'choice3', value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {routes && routes.length > 0 ? (
                                    routes
                                      .filter(route => {
                                        if (!employee) return false
                                        if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) return false
                                        if (route.requiresChainExperience && !employee.chainExperience) return false
                                        return true
                                      })
                                      .map((route) => (
                                        <SelectItem key={route.id} value={route.id}>
                                          Route {route.runNumber}
                                        </SelectItem>
                                      ))
                                  ) : (
                                    <SelectItem value="no-routes" disabled>No routes available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSaveSelections}
                disabled={saving}
                size="lg"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save All Selections
                  </>
                )}
              </Button>
            </div>
          </>
        ) : selectedPeriod ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">No eligible employees found for this selection period.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">Select a terminal and selection period to begin.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}