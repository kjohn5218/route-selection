import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useTerminal } from '../contexts/TerminalContext';
import { format } from 'date-fns';
import { Download, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { generateRouteFormPDF } from '../utils/generateRouteFormPDF';

interface Route {
  id: string;
  runNumber: string;
  type: string;
  origin: string;
  destination: string;
  days: string;
  startTime: string;
  endTime: string;
  distance: number;
  rateType: string;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
}

interface SelectionPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  requiredSelections: number;
  status: string;
  terminalId: string;
}

interface Terminal {
  id: string;
  code: string;
  name: string;
}

const PrintForms = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedTerminal } = useTerminal();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const periodId = searchParams.get('periodId');
  const terminalId = searchParams.get('terminalId');
  
  const [selectedPeriodId, setSelectedPeriodId] = useState(periodId || '');
  const [selectedTerminalId, setSelectedTerminalId] = useState(terminalId || selectedTerminal?.id || '');

  // Fetch available periods for selection
  const { data: periods = [] } = useQuery<SelectionPeriod[]>({
    queryKey: ['selection-periods', selectedTerminalId],
    queryFn: async () => {
      if (!selectedTerminalId) return [];
      const response = await apiClient.get('/periods', {
        params: { terminalId: selectedTerminalId }
      });
      return response.data;
    },
    enabled: !!selectedTerminalId && !periodId,
  });

  // Fetch terminals if not provided
  const { data: terminals = [] } = useQuery<Terminal[]>({
    queryKey: ['terminals'],
    queryFn: async () => {
      const response = await apiClient.get('/terminals');
      return response.data;
    },
    enabled: !terminalId,
  });

  // Set selected terminal ID when terminal context changes
  useEffect(() => {
    if (!terminalId && selectedTerminal?.id && !selectedTerminalId) {
      setSelectedTerminalId(selectedTerminal.id);
    }
  }, [selectedTerminal, terminalId, selectedTerminalId]);

  // Fetch data
  const { data: period, isLoading: periodLoading, error: periodError } = useQuery<SelectionPeriod>({
    queryKey: ['selection-period', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) throw new Error('Period ID required');
      const response = await apiClient.get(`/periods/${selectedPeriodId}`);
      return response.data;
    },
    enabled: !!selectedPeriodId,
  });

  const { data: terminal, isLoading: terminalLoading, error: terminalError } = useQuery<Terminal>({
    queryKey: ['terminal', selectedTerminalId],
    queryFn: async () => {
      if (!selectedTerminalId) throw new Error('Terminal ID required');
      const response = await apiClient.get(`/terminals/${selectedTerminalId}`);
      return response.data;
    },
    enabled: !!selectedTerminalId,
  });

  const { data: routes = [], isLoading: routesLoading, error: routesError } = useQuery<Route[]>({
    queryKey: ['period-routes', selectedPeriodId],
    queryFn: async () => {
      if (!selectedPeriodId) return [];
      const response = await apiClient.get(`/periods/${selectedPeriodId}/routes`);
      return response.data;
    },
    enabled: !!selectedPeriodId,
  });

  // Update URL when selections change
  const handleSelectionChange = () => {
    if (selectedPeriodId && selectedTerminalId) {
      setSearchParams({ periodId: selectedPeriodId, terminalId: selectedTerminalId });
    }
  };

  // Generate PDF from the form
  const generatePDF = () => {
    if (!period || !terminal || !routes) return;

    setIsGeneratingPDF(true);
    try {
      generateRouteFormPDF({
        period: {
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          requiredSelections: period.requiredSelections
        },
        terminal: {
          code: terminal.code,
          name: terminal.name
        },
        routes: routes
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Auto-generate PDF on load when parameters are provided
  useEffect(() => {
    if (period && terminal && routes.length > 0 && periodId && terminalId) {
      setTimeout(() => {
        generatePDF();
      }, 500);
    }
  }, [period, terminal, routes, periodId, terminalId]);

  // Show selection form if no parameters provided
  if (!selectedPeriodId || !selectedTerminalId) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Print Route Selection Form</h1>
          
          <div className="space-y-4">
            {/* Terminal Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Terminal
              </label>
              {selectedTerminal && !terminalId ? (
                <input
                  type="text"
                  value={selectedTerminal.name}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
                />
              ) : (
                <select
                  value={selectedTerminalId}
                  onChange={(e) => {
                    setSelectedTerminalId(e.target.value);
                    setSelectedPeriodId(''); // Reset period when terminal changes
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a terminal</option>
                  {terminals.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Period Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Selection Period
              </label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                disabled={!selectedTerminalId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
              >
                <option value="">Select a period</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSelectionChange}
              disabled={!selectedPeriodId || !selectedTerminalId}
              className="w-full mt-6 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Load Print Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (periodLoading || terminalLoading || routesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (periodError || terminalError || routesError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading form data</p>
          {periodError && <p className="text-sm text-gray-600">Period: {(periodError as Error).message}</p>}
          {terminalError && <p className="text-sm text-gray-600">Terminal: {(terminalError as Error).message}</p>}
          {routesError && <p className="text-sm text-gray-600">Routes: {(routesError as Error).message}</p>}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if we have the required data
  if (!period || !terminal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Missing required data</p>
          <button
            onClick={() => {
              setSelectedPeriodId('');
              setSelectedTerminalId('');
              setSearchParams({});
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  const sortedRoutes = routes
    .sort((a, b) => {
      // Extract numeric part for proper numeric sorting
      const aNum = parseInt(a.runNumber.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.runNumber.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });

  // If no routes, show a message
  if (routes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No routes available for this selection period</p>
          <p className="text-sm text-gray-500">Period: {period.name}</p>
          <p className="text-sm text-gray-500">Terminal: {terminal.name}</p>
          <button
            onClick={() => {
              setSelectedPeriodId('');
              setSelectedTerminalId('');
              setSearchParams({});
            }}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Select Different Period
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Download button */}
      <div className="mb-6 flex justify-between">
        <button
          onClick={() => {
            setSelectedPeriodId('');
            setSelectedTerminalId('');
            setSearchParams({});
          }}
          className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Selection
        </button>
        <button
          onClick={generatePDF}
          disabled={isGeneratingPDF}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isGeneratingPDF ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating PDF...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </>
          )}
        </button>
      </div>

      <div className="printable-form bg-white text-black p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-black pb-4">
          <h1 className="text-2xl font-bold mb-2">ROUTE SELECTION FORM</h1>
          <h2 className="text-xl">{terminal.name}</h2>
          <p className="mt-2">
            Selection Period: {format(new Date(period.startDate), 'MM/dd/yyyy')} - {format(new Date(period.endDate), 'MM/dd/yyyy')}
          </p>
        </div>

        {/* Instructions */}
        <div className="mb-8 border border-gray-400 p-4">
          <h3 className="font-bold text-lg mb-2">INSTRUCTIONS:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Review all available routes listed below</li>
            <li>Select up to {period.requiredSelections} routes in order of preference</li>
            <li>Write your selections in the "Driver Selection" section at the bottom</li>
            <li>Ensure your employee information is complete and accurate</li>
            <li>Sign and date the form</li>
            <li>Submit this form to your manager or administrator by the deadline</li>
          </ol>
        </div>

        {/* Routes Table */}
        <div className="mb-8">
          <h3 className="font-bold text-lg mb-4">AVAILABLE ROUTES:</h3>
          <table className="w-full border-collapse border border-black text-sm">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-2 text-left">Run #</th>
                <th className="border border-black p-2 text-left">Type</th>
                <th className="border border-black p-2 text-left">Origin</th>
                <th className="border border-black p-2 text-left">Destination</th>
                <th className="border border-black p-2 text-left">Days</th>
                <th className="border border-black p-2 text-left">Time</th>
                <th className="border border-black p-2 text-left">Miles</th>
                <th className="border border-black p-2 text-left">Rate Type</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoutes.map((route) => (
                <tr key={route.id}>
                  <td className="border border-black p-2">{route.runNumber}</td>
                  <td className="border border-black p-2">{route.type}</td>
                  <td className="border border-black p-2">{route.origin}</td>
                  <td className="border border-black p-2">{route.destination}</td>
                  <td className="border border-black p-2">{route.days}</td>
                  <td className="border border-black p-2">
                    {format(new Date(`2000-01-01T${route.startTime}`), 'h:mm a')} - 
                    {format(new Date(`2000-01-01T${route.endTime}`), 'h:mm a')}
                  </td>
                  <td className="border border-black p-2">{route.distance}</td>
                  <td className="border border-black p-2">
                    {route.rateType === 'HOURLY' && 'Hourly'}
                    {route.rateType === 'MILEAGE' && 'Mileage'}
                    {route.rateType === 'FLAT_RATE' && 'Flat Rate'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Driver Selection Section - Force page break before for PDF */}
        <div style={{ pageBreakBefore: 'always' }}>
          <h3 className="font-bold text-lg mb-4">DRIVER SELECTION:</h3>
          
          {/* Driver Information */}
          <div className="border border-black p-4 mb-4">
            <h4 className="font-bold mb-4">Driver Information:</h4>
            <div className="space-y-4">
              <div className="flex items-end">
                <span className="inline-block w-24 mr-2">Full Name:</span>
                <span className="inline-block border-b border-black flex-1"></span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-end">
                  <span className="inline-block mr-2">Employee Number:</span>
                  <span className="inline-block border-b border-black flex-1"></span>
                </div>
                <div className="flex items-end">
                  <span className="inline-block w-16 mr-2">Phone:</span>
                  <span className="inline-block border-b border-black flex-1"></span>
                </div>
              </div>
              <div className="flex items-end">
                <span className="inline-block w-16 mr-2">Email:</span>
                <span className="inline-block border-b border-black flex-1"></span>
              </div>
            </div>
          </div>

          {/* Route Selections */}
          <div className="border border-black p-4 mb-4">
            <h4 className="font-bold mb-3">Route Selections (in order of preference):</h4>
            {Array.from({ length: period.requiredSelections }, (_, i) => (
              <div key={i} className="mb-3">
                <span className="inline-block w-48">
                  {i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'} Choice - Run Number:
                </span>
                <span className="inline-block border-b border-black w-48"></span>
              </div>
            ))}
          </div>

          {/* Signature Section */}
          <div className="border border-black p-4">
            <h4 className="font-bold mb-3">Driver Declaration:</h4>
            <p className="text-sm mb-4">
              I certify that the route selections above are my preferred choices and that all information 
              provided is accurate. I understand that routes will be assigned based on seniority and availability.
            </p>
            <div className="mt-8 space-y-4">
              <div className="flex items-end">
                <span className="inline-block mr-2">Driver Signature:</span>
                <span className="inline-block border-b border-black flex-1 mr-8"></span>
                <span className="inline-block mr-2">Date:</span>
                <span className="inline-block border-b border-black w-32"></span>
              </div>
            </div>
          </div>

          {/* Office Use Only */}
          <div className="border border-black p-4 mt-4 bg-gray-100">
            <h4 className="font-bold mb-3">FOR OFFICE USE ONLY:</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-2">
                <span className="inline-block w-24">Received By:</span>
                <span className="inline-block border-b border-black w-48"></span>
              </div>
              <div className="mb-2">
                <span className="inline-block w-28">Date Received:</span>
                <span className="inline-block border-b border-black w-48"></span>
              </div>
              <div className="mb-2">
                <span className="inline-block w-24">Entered By:</span>
                <span className="inline-block border-b border-black w-48"></span>
              </div>
              <div className="mb-2">
                <span className="inline-block w-28">Date Entered:</span>
                <span className="inline-block border-b border-black w-48"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PrintForms;