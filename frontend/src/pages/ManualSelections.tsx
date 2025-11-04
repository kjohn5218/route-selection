import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useTerminal } from '../contexts/TerminalContext';
import { toast } from 'react-hot-toast';
import { Save, FileText, Search } from 'lucide-react';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  doublesEndorsement: boolean;
  chainExperience: boolean;
}

interface Route {
  id: string;
  runNumber: string;
  origin: string;
  destination: string;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
}

interface SelectionPeriod {
  id: string;
  name: string;
  status: string;
  requiredSelections: number;
}

interface ManualSelection {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  choice1: string;
  choice2: string;
  choice3: string;
}

const ManualSelections = () => {
  const { selectedTerminal } = useTerminal();
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selections, setSelections] = useState<ManualSelection[]>([]);

  // Fetch open selection periods
  const { data: periods = [] } = useQuery<SelectionPeriod[]>({
    queryKey: ['selection-periods', 'open', selectedTerminal?.id],
    queryFn: async () => {
      if (!selectedTerminal) return [];
      const response = await apiClient.get('/periods', {
        params: { terminalId: selectedTerminal.id, status: 'Open' }
      });
      return response.data;
    },
    enabled: !!selectedTerminal,
  });

  // Fetch employees and routes when period is selected
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ['employees', selectedTerminal?.id],
    queryFn: async () => {
      if (!selectedTerminal) return [];
      const response = await apiClient.get('/employees', {
        params: { terminalId: selectedTerminal.id }
      });
      return response.data;
    },
    enabled: !!selectedTerminal && !!selectedPeriod,
  });

  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ['period-routes', selectedPeriod],
    queryFn: async () => {
      if (!selectedPeriod) return [];
      const response = await apiClient.get(`/routes/available/${selectedPeriod}`);
      return response.data;
    },
    enabled: !!selectedPeriod,
  });

  // Initialize selections when employees are loaded
  useEffect(() => {
    if (employees.length > 0) {
      const sortedEmployees = [...employees].sort((a, b) => {
        const dateA = new Date(a.hireDate).getTime();
        const dateB = new Date(b.hireDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.lastName.localeCompare(b.lastName);
      });

      const initialSelections = sortedEmployees.map(emp => ({
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeId,
        choice1: '',
        choice2: '',
        choice3: '',
      }));
      setSelections(initialSelections);
    }
  }, [employees]);

  // Save selections mutation
  const saveMutation = useMutation({
    mutationFn: async (selections: ManualSelection[]) => {
      const validSelections = selections.filter(sel => sel.choice1 || sel.choice2 || sel.choice3);
      
      const promises = validSelections.map(selection =>
        apiClient.post('/selections/admin', {
          employeeId: selection.employeeId,
          selectionPeriodId: selectedPeriod,
          firstChoiceId: selection.choice1 || null,
          secondChoiceId: selection.choice2 || null,
          thirdChoiceId: selection.choice3 || null,
        })
      );
      
      return Promise.all(promises);
    },
    onSuccess: (data) => {
      toast.success(`Saved ${data.length} selections successfully`);
      // Navigate to process page
      window.location.href = `/periods/${selectedPeriod}/manage`;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save selections');
    },
  });

  const handleSelectionChange = (employeeId: string, field: 'choice1' | 'choice2' | 'choice3', value: string) => {
    setSelections(prev => prev.map(sel => 
      sel.employeeId === employeeId 
        ? { ...sel, [field]: value }
        : sel
    ));
  };

  const getEligibleRoutes = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return [];

    return routes
      .filter(route => {
        if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) return false;
        if (route.requiresChainExperience && !employee.chainExperience) return false;
        return true;
      })
      .sort((a, b) => {
        // Extract numeric part for proper numeric sorting
        const aNum = parseInt(a.runNumber.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.runNumber.replace(/\D/g, '')) || 0;
        return aNum - bNum;
      });
  };

  const filteredSelections = selections.filter(sel => {
    const search = searchTerm.toLowerCase();
    return sel.employeeName.toLowerCase().includes(search) || 
           sel.employeeNumber.toLowerCase().includes(search);
  });

  const currentPeriod = periods.find(p => p.id === selectedPeriod);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Manual Route Selection Entry</h1>
        <a
          href={`/print-forms?periodId=${selectedPeriod}&terminalId=${selectedTerminal?.id}`}
          className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4 mr-2" />
          Print Blank Forms
        </a>
      </div>

      {/* Selection Period Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Selection Period</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terminal</label>
            <input
              type="text"
              value={selectedTerminal?.name || 'Select a terminal'}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selection Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a period</option>
              {periods.map(period => (
                <option key={period.id} value={period.id}>{period.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Search */}
      {selectedPeriod && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by employee name or number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {/* Selections Table */}
      {loadingEmployees ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      ) : selectedPeriod && filteredSelections.length > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Driver Route Selections</h2>
              <p className="text-sm text-gray-600 mt-1">
                Enter up to {currentPeriod?.requiredSelections || 3} route choices for each driver
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      1st Choice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      2nd Choice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      3rd Choice
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSelections.map((selection) => {
                    const eligibleRoutes = getEligibleRoutes(selection.employeeId);
                    return (
                      <tr key={selection.employeeId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {selection.employeeName}
                            </div>
                            <div className="text-sm text-gray-500">
                              Seniority #{employees.findIndex(e => e.id === selection.employeeId) + 1}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {selection.employeeNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={selection.choice1}
                            onChange={(e) => handleSelectionChange(selection.employeeId, 'choice1', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Select</option>
                            {eligibleRoutes.map(route => (
                              <option key={route.id} value={route.id}>
                                {route.runNumber}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={selection.choice2}
                            onChange={(e) => handleSelectionChange(selection.employeeId, 'choice2', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Select</option>
                            {eligibleRoutes.map(route => (
                              <option key={route.id} value={route.id}>
                                {route.runNumber}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={selection.choice3}
                            onChange={(e) => handleSelectionChange(selection.employeeId, 'choice3', e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Select</option>
                            {eligibleRoutes.map(route => (
                              <option key={route.id} value={route.id}>
                                {route.runNumber}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => saveMutation.mutate(selections)}
              disabled={saveMutation.isPending}
              className="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save All Selections
                </>
              )}
            </button>
          </div>
        </>
      ) : selectedPeriod ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No eligible employees found for this selection period.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Select a terminal and selection period to begin.</p>
        </div>
      )}
    </div>
  );
};

export default ManualSelections;