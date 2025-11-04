import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { ArrowLeft, Download, Mail, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
}

interface Route {
  id: string;
  runNumber: string;
  origin: string;
  destination: string;
  type: string;
}

interface Assignment {
  id: string;
  employeeId: string;
  routeId: string | null;
  choiceReceived: number | null;
  employee: Employee;
  route: Route | null;
}

interface SelectionPeriod {
  id: string;
  name: string;
  status: string;
}

const SelectionResults = () => {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingEmails, setSendingEmails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'csv' | 'pdf' | null>(null);

  // Fetch period details
  const { data: period } = useQuery<SelectionPeriod>({
    queryKey: ['period', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/periods/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  // Fetch assignments
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/assignments/period/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  const handleExport = async (format: 'csv' | 'pdf') => {
    setDownloading(true);
    setDownloadFormat(format);
    try {
      const response = await apiClient.get(`/assignments/download/${periodId}`, {
        params: { format },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `assignment-results-${periodId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Results exported as ${format.toUpperCase()} successfully`);
    } catch (error: any) {
      console.error('Export error:', error);
      const errorMessage = error.response?.data?.error || `Failed to export ${format.toUpperCase()}`;
      toast.error(errorMessage);
    } finally {
      setDownloading(false);
      setDownloadFormat(null);
    }
  };

  const handleSendEmails = async () => {
    if (!confirm('Are you sure you want to send email notifications to all assigned drivers?')) {
      return;
    }
    
    setSendingEmails(true);
    try {
      const response = await apiClient.post(`/assignments/notify/${periodId}`);
      if (response.data.notificationsFailed > 0) {
        toast.warning(`Sent ${response.data.notificationsSent} notifications successfully. ${response.data.notificationsFailed} failed.`);
      } else {
        toast.success(`Successfully sent ${response.data.notificationsSent} email notifications!`);
      }
    } catch (error: any) {
      console.error('Send emails error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to send notifications';
      toast.error(errorMessage);
    } finally {
      setSendingEmails(false);
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const search = searchTerm.toLowerCase();
    const fullName = `${assignment.employee.firstName} ${assignment.employee.lastName}`.toLowerCase();
    const empNumber = assignment.employee.employeeId.toLowerCase();
    const routeNumber = assignment.route?.runNumber.toLowerCase() || '';
    
    return fullName.includes(search) || empNumber.includes(search) || routeNumber.includes(search);
  });

  const assignedCount = assignments.filter(a => a.route).length;
  const floatPoolCount = assignments.filter(a => !a.route).length;
  const firstChoiceCount = assignments.filter(a => a.choiceReceived === 1).length;
  const secondChoiceCount = assignments.filter(a => a.choiceReceived === 2).length;
  const thirdChoiceCount = assignments.filter(a => a.choiceReceived === 3).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Selection Results</h1>
          {period && <p className="text-gray-600 mt-1">{period.name}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={downloading}
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading && downloadFormat === 'csv' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {downloading && downloadFormat === 'csv' ? 'Downloading...' : 'Export CSV'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={downloading}
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading && downloadFormat === 'pdf' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            {downloading && downloadFormat === 'pdf' ? 'Downloading...' : 'Export PDF'}
          </button>
          <button
            onClick={handleSendEmails}
            disabled={sendingEmails || assignments.length === 0}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendingEmails ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Mail className="w-4 h-4 mr-2" />
            )}
            {sendingEmails ? 'Sending...' : 'Send Notifications'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold">{assignments.length}</div>
          <p className="text-sm text-gray-600">Total Drivers</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-green-600">{assignedCount}</div>
          <p className="text-sm text-gray-600">Assigned Routes</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-2xl font-bold text-orange-600">{floatPoolCount}</div>
          <p className="text-sm text-gray-600">Float Pool</p>
        </div>
      </div>

      {/* Choice Distribution */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xl font-bold text-blue-600">{firstChoiceCount}</div>
          <p className="text-sm text-gray-600">1st Choice</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xl font-bold text-purple-600">{secondChoiceCount}</div>
          <p className="text-sm text-gray-600">2nd Choice</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xl font-bold text-pink-600">{thirdChoiceCount}</div>
          <p className="text-sm text-gray-600">3rd Choice</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-xl font-bold text-gray-600">
            {assignedCount > 0 ? Math.round((firstChoiceCount / assignedCount) * 100) : 0}%
          </div>
          <p className="text-sm text-gray-600">1st Choice Rate</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, employee number, or route..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Assignment Results</h2>
          <p className="text-sm text-gray-600">Final route assignments for all drivers</p>
        </div>
        <div className="overflow-x-auto">
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No assignments found. Please ensure selections have been processed.
            </div>
          ) : (
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
                    Seniority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Choice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAssignments.map((assignment, index) => (
                  <tr key={assignment.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.employee.firstName} {assignment.employee.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {assignment.employee.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.employee.employeeId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assignment.route ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {assignment.route.runNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {assignment.route.origin} → {assignment.route.destination}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Float Pool</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assignment.choiceReceived ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {assignment.choiceReceived === 1 && '1st Choice'}
                          {assignment.choiceReceived === 2 && '2nd Choice'}
                          {assignment.choiceReceived === 3 && '3rd Choice'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assignment.route ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Assigned
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Float Pool
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectionResults;