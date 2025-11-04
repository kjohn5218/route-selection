import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';
import { ArrowLeft, Play, Eye, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SelectionPeriod {
  id: string;
  name: string;
  status: string;
  requiredSelections: number;
}

interface Selection {
  id: string;
  employeeId: string;
  firstChoiceId: string | null;
  secondChoiceId: string | null;
  thirdChoiceId: string | null;
  submittedAt: string;
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
  };
  firstChoice: { runNumber: string } | null;
  secondChoice: { runNumber: string } | null;
  thirdChoice: { runNumber: string } | null;
}

const ProcessSelections = () => {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState<any>(null);

  // Fetch period details
  const { data: period } = useQuery<SelectionPeriod>({
    queryKey: ['period', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/periods/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  // Fetch selections
  const { data: selections = [] } = useQuery<Selection[]>({
    queryKey: ['selections', periodId],
    queryFn: async () => {
      const response = await apiClient.get('/selections', {
        params: { selectionPeriodId: periodId }
      });
      return response.data;
    },
    enabled: !!periodId,
  });

  // Process selections mutation
  const processMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/selections/process/${periodId}`);
      return response.data;
    },
    onSuccess: (data) => {
      setResults(data);
      toast.success('Selections processed successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to process selections');
    },
  });

  const handleViewResults = () => {
    navigate(`/selection-results/${periodId}`);
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.get(`/selections/download/${periodId}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `selection-results-${periodId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Results exported successfully');
    } catch (error) {
      toast.error('Failed to export results');
    }
  };

  const manualSelections = selections.filter(sel => 
    sel.submittedAt && (sel.firstChoiceId || sel.secondChoiceId || sel.thirdChoiceId)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Process Route Selections</h1>
          {period && <p className="text-gray-600 mt-1">{period.name}</p>}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
      </div>

      {/* Period Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Selection Period Status</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              period?.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
              period?.status === 'PROCESSING' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {period?.status || 'Loading...'}
            </span>
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
      </div>

      {/* Selection Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Selection Summary</h2>
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
                      Choices: {selection.firstChoice?.runNumber || '-'}, 
                      {selection.secondChoice?.runNumber || '-'}, 
                      {selection.thirdChoice?.runNumber || '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Process Selections</h2>
        <p className="text-sm text-gray-600 mb-4">
          Run the assignment algorithm to process all selections
        </p>
        
        {period?.status === 'COMPLETED' ? (
          <div className="space-y-4">
            <p className="text-green-600">
              ✓ Selections have been processed successfully
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleViewResults}
                className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Results
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will assign routes to all drivers based on their selections and seniority.
            </p>
            <button
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending || period?.status !== 'OPEN'}
              className="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processMutation.isPending ? (
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
            </button>
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
      </div>
    </div>
  );
};

export default ProcessSelections;