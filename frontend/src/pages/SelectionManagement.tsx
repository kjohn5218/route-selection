import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Users, 
  Route as RouteIcon,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Send
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface Selection {
  id: string;
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    hireDate: string;
    doublesEndorsement: boolean;
    chainExperience: boolean;
  };
  firstChoice: {
    id: string;
    runNumber: string;
    origin: string;
    destination: string;
    type: string;
    requiresDoublesEndorsement: boolean;
    requiresChainExperience: boolean;
  } | null;
  secondChoice: {
    id: string;
    runNumber: string;
    origin: string;
    destination: string;
    type: string;
    requiresDoublesEndorsement: boolean;
    requiresChainExperience: boolean;
  } | null;
  thirdChoice: {
    id: string;
    runNumber: string;
    origin: string;
    destination: string;
    type: string;
    requiresDoublesEndorsement: boolean;
    requiresChainExperience: boolean;
  } | null;
  submittedAt: string;
  confirmationNumber: string;
}

interface Assignment {
  id: string;
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
  };
  route: {
    id: string;
    runNumber: string;
    origin: string;
    destination: string;
  } | null;
  choiceReceived: number | null;
  effectiveDate: string;
}

interface PeriodDetails {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  selections: Selection[];
  assignments: Assignment[];
}

const SelectionManagement = () => {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedSelections, setExpandedSelections] = useState<Set<string>>(new Set());
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [processingResults, setProcessingResults] = useState<any>(null);

  // Fetch period details
  const { data: period, isLoading, error } = useQuery<PeriodDetails>({
    queryKey: ['period', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/periods/${periodId}`);
      return response.data;
    },
  });

  // Process selections mutation
  const processSelectionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/assignments/process/${periodId}`);
      return response.data;
    },
    onSuccess: (data) => {
      setProcessingResults(data);
      setShowProcessModal(false);
      setShowResultsModal(true);
      queryClient.invalidateQueries({ queryKey: ['period', periodId] });
    },
  });

  // Notify employees mutation
  const notifyEmployeesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/assignments/notify/${periodId}`);
      return response.data;
    },
    onSuccess: (data) => {
      alert(`Successfully sent assignment notifications to ${data.notificationsSent} employees.`);
      setShowResultsModal(false);
      navigate('/periods');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to send notifications';
      alert(`Error: ${message}`);
    },
  });

  const toggleSelection = (selectionId: string) => {
    const newExpanded = new Set(expandedSelections);
    if (newExpanded.has(selectionId)) {
      newExpanded.delete(selectionId);
    } else {
      newExpanded.add(selectionId);
    }
    setExpandedSelections(newExpanded);
  };

  const checkQualification = (employee: any, route: any) => {
    if (!route) return { qualified: true, reason: '' };
    
    if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) {
      return { qualified: false, reason: 'Missing doubles endorsement' };
    }
    
    if (route.requiresChainExperience && !employee.chainExperience) {
      return { qualified: false, reason: 'Missing chain experience' };
    }
    
    return { qualified: true, reason: '' };
  };

  const handleExportResults = () => {
    if (!processingResults || !processingResults.assignments) return;

    // Create CSV content
    const csvRows = [
      ['Employee ID', 'Route ID', 'Choice Received', 'Reason'],
    ];

    processingResults.assignments.forEach((assignment: any) => {
      csvRows.push([
        assignment.employeeId || '',
        assignment.routeId || 'Float Pool',
        assignment.choiceReceived || 'N/A',
        assignment.reason || '',
      ]);
    });

    // Convert to CSV string
    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assignment-results-${periodId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading selection data..." />
      </div>
    );
  }

  if (error || !period) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Data</h3>
            <p className="text-red-700">Failed to load selection period data.</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = {
    totalEmployees: period.selections.length,
    processedAssignments: period.assignments.length,
    firstChoiceAwarded: period.assignments.filter(a => a.choiceReceived === 1).length,
    secondChoiceAwarded: period.assignments.filter(a => a.choiceReceived === 2).length,
    thirdChoiceAwarded: period.assignments.filter(a => a.choiceReceived === 3).length,
    floatPool: period.assignments.filter(a => a.choiceReceived === null).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/periods')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{period.name}</h1>
          <p className="text-gray-600">
            Manage selections and process route assignments
          </p>
        </div>
        {period.status === 'CLOSED' && (
          <button
            onClick={() => setShowProcessModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Award className="w-4 h-4" />
            Process Assignments
          </button>
        )}
      </div>

      {/* Period Info */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-medium text-gray-900">{period.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Start Date</p>
            <p className="font-medium text-gray-900">
              {new Date(period.startDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">End Date</p>
            <p className="font-medium text-gray-900">
              {new Date(period.endDate).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Submissions</p>
            <p className="font-medium text-gray-900">{period.selections.length}</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {period.status === 'COMPLETED' && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Total Processed</p>
                <p className="text-xl font-bold text-gray-900">{stats.processedAssignments}</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">1st Choice</p>
                <p className="text-xl font-bold text-green-600">{stats.firstChoiceAwarded}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">2nd Choice</p>
                <p className="text-xl font-bold text-yellow-600">{stats.secondChoiceAwarded}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">3rd Choice</p>
                <p className="text-xl font-bold text-orange-600">{stats.thirdChoiceAwarded}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Float Pool</p>
                <p className="text-xl font-bold text-gray-600">{stats.floatPool}</p>
              </div>
              <XCircle className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Success Rate</p>
                <p className="text-xl font-bold text-primary-600">
                  {stats.processedAssignments > 0 
                    ? Math.round(((stats.firstChoiceAwarded + stats.secondChoiceAwarded + stats.thirdChoiceAwarded) / stats.processedAssignments) * 100)
                    : 0}%
                </p>
              </div>
              <Award className="w-8 h-8 text-primary-400" />
            </div>
          </div>
        </div>
      )}

      {/* Selections List */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Employee Selections</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review all submitted route preferences
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {period.selections.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No selections have been submitted yet
            </div>
          ) : (
            period.selections.map((selection) => {
              const isExpanded = expandedSelections.has(selection.id);
              const assignment = period.assignments.find(a => a.employee.id === selection.employee.id);
              
              return (
                <div key={selection.id} className="hover:bg-gray-50 transition-colors">
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleSelection(selection.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-gray-100 p-2 rounded-lg">
                          <Users className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {selection.employee.firstName} {selection.employee.lastName}
                          </p>
                          <p className="text-sm text-gray-600">
                            Employee ID: {selection.employee.employeeId} | 
                            Seniority: {new Date(selection.employee.hireDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {assignment && (
                          <div className="flex items-center gap-2">
                            {assignment.route ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Assigned: {assignment.route.runNumber}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Float Pool
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-gray-500">
                          Submitted: {new Date(selection.submittedAt).toLocaleDateString()}
                        </p>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        {/* First Choice */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2">First Choice</h4>
                          {selection.firstChoice ? (
                            <div>
                              <p className="font-medium text-gray-800">
                                {selection.firstChoice.runNumber}
                              </p>
                              <p className="text-sm text-gray-600">
                                {selection.firstChoice.origin} → {selection.firstChoice.destination}
                              </p>
                              <p className="text-sm text-gray-600">
                                Type: {selection.firstChoice.type}
                              </p>
                              {(() => {
                                const qual = checkQualification(selection.employee, selection.firstChoice);
                                return !qual.qualified && (
                                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {qual.reason}
                                  </p>
                                );
                              })()}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No selection</p>
                          )}
                        </div>
                        
                        {/* Second Choice */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2">Second Choice</h4>
                          {selection.secondChoice ? (
                            <div>
                              <p className="font-medium text-gray-800">
                                {selection.secondChoice.runNumber}
                              </p>
                              <p className="text-sm text-gray-600">
                                {selection.secondChoice.origin} → {selection.secondChoice.destination}
                              </p>
                              <p className="text-sm text-gray-600">
                                Type: {selection.secondChoice.type}
                              </p>
                              {(() => {
                                const qual = checkQualification(selection.employee, selection.secondChoice);
                                return !qual.qualified && (
                                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {qual.reason}
                                  </p>
                                );
                              })()}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No selection</p>
                          )}
                        </div>
                        
                        {/* Third Choice */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2">Third Choice</h4>
                          {selection.thirdChoice ? (
                            <div>
                              <p className="font-medium text-gray-800">
                                {selection.thirdChoice.runNumber}
                              </p>
                              <p className="text-sm text-gray-600">
                                {selection.thirdChoice.origin} → {selection.thirdChoice.destination}
                              </p>
                              <p className="text-sm text-gray-600">
                                Type: {selection.thirdChoice.type}
                              </p>
                              {(() => {
                                const qual = checkQualification(selection.employee, selection.thirdChoice);
                                return !qual.qualified && (
                                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    {qual.reason}
                                  </p>
                                );
                              })()}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No selection</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          Confirmation #: <span className="font-mono">{selection.confirmationNumber}</span>
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            selection.employee.doublesEndorsement 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            Doubles: {selection.employee.doublesEndorsement ? 'Yes' : 'No'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            selection.employee.chainExperience 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            Chains: {selection.employee.chainExperience ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Process Selections Modal */}
      {showProcessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary-100 p-2 rounded-lg">
                <Award className="w-5 h-5 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Process Route Assignments</h3>
            </div>
            <p className="text-gray-600 mb-6">
              This will process all {period.selections.length} selections and assign routes based on 
              seniority and preferences. This action cannot be undone.
            </p>
            <div className="bg-yellow-50 p-4 rounded-lg mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Important</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Routes will be assigned by seniority (hire date)</li>
                    <li>Employees must meet route requirements</li>
                    <li>Each route can only be assigned once</li>
                    <li>Unassigned employees go to float pool</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowProcessModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => processSelectionsMutation.mutate()}
                disabled={processSelectionsMutation.isPending}
                className="btn-primary"
              >
                {processSelectionsMutation.isPending ? 'Processing...' : 'Process Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && processingResults && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Processing Complete</h3>
              <button
                onClick={() => {
                  setShowResultsModal(false);
                  navigate('/admin/periods');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600">First Choice</p>
                  <p className="text-2xl font-bold text-green-900">
                    {processingResults.summary?.choiceDistribution?.first || 0}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600">Second Choice</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {processingResults.summary?.choiceDistribution?.second || 0}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600">Third Choice</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {processingResults.summary?.choiceDistribution?.third || 0}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Float Pool</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {processingResults.summary?.choiceDistribution?.float || 0}
                  </p>
                </div>
              </div>

              {/* Assignments List */}
              <div className="border rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {processingResults.assignments?.map((assignment: any, index: number) => (
                  <div key={assignment.employeeId || index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          Employee {assignment.employeeId}
                        </p>
                        <p className="text-sm text-gray-600">
                          {assignment.routeId ? (
                            <>
                              Assigned to Route (Choice #{assignment.choiceReceived || 'N/A'})
                            </>
                          ) : (
                            assignment.reason || 'Assigned to Float Pool'
                          )}
                        </p>
                      </div>
                      <div>
                        {assignment.choiceReceived && (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            assignment.choiceReceived === 1 ? 'bg-green-100 text-green-800' :
                            assignment.choiceReceived === 2 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            Choice #{assignment.choiceReceived}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )) || <div className="p-4 text-center text-gray-500">No assignments to display</div>}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <button 
                  onClick={() => handleExportResults()}
                  className="btn-secondary flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export Results
                </button>
                <button 
                  onClick={() => notifyEmployeesMutation.mutate()}
                  disabled={notifyEmployeesMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {notifyEmployeesMutation.isPending ? 'Sending...' : 'Notify Employees'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectionManagement;