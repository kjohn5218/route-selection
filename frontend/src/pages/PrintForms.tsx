import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { format } from 'date-fns';
import { Printer } from 'lucide-react';

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
  hourlyRate?: number;
  mileageRate?: number;
  flatRate?: number;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
}

interface SelectionPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  requiredSelections: number;
}

interface Terminal {
  id: string;
  code: string;
  name: string;
}

const PrintForms = () => {
  const [searchParams] = useSearchParams();
  const periodId = searchParams.get('periodId');
  const terminalId = searchParams.get('terminalId');

  // Fetch data
  const { data: period, isLoading: periodLoading, error: periodError } = useQuery<SelectionPeriod>({
    queryKey: ['selection-period', periodId],
    queryFn: async () => {
      if (!periodId) throw new Error('Period ID required');
      const response = await apiClient.get(`/periods/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  const { data: terminal, isLoading: terminalLoading, error: terminalError } = useQuery<Terminal>({
    queryKey: ['terminal', terminalId],
    queryFn: async () => {
      if (!terminalId) throw new Error('Terminal ID required');
      const response = await apiClient.get(`/terminals/${terminalId}`);
      return response.data;
    },
    enabled: !!terminalId,
  });

  const { data: routes = [], isLoading: routesLoading, error: routesError } = useQuery<Route[]>({
    queryKey: ['period-routes', periodId],
    queryFn: async () => {
      if (!periodId) return [];
      const response = await apiClient.get(`/periods/${periodId}/routes`);
      return response.data;
    },
    enabled: !!periodId,
  });

  // Auto-print on load
  useEffect(() => {
    if (period && terminal && routes.length > 0) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [period, terminal, routes]);

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
          <p className="text-sm text-gray-500">Period ID: {periodId || 'Not provided'}</p>
          <p className="text-sm text-gray-500">Terminal ID: {terminalId || 'Not provided'}</p>
          <p className="text-sm text-gray-500 mt-2">Period loaded: {period ? 'Yes' : 'No'}</p>
          <p className="text-sm text-gray-500">Terminal loaded: {terminal ? 'Yes' : 'No'}</p>
        </div>
      </div>
    );
  }

  const sortedRoutes = routes
    .sort((a, b) => a.runNumber.localeCompare(b.runNumber));

  // If no routes, show a message
  if (routes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No routes available for this selection period</p>
          <p className="text-sm text-gray-500">Period: {period.name}</p>
          <p className="text-sm text-gray-500">Terminal: {terminal.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="print:m-0 print:p-0 p-8">
      {/* Debug info - hidden when printing */}
      <div className="print:hidden mb-4 p-4 bg-gray-100 rounded text-sm">
        <p>Period: {period.name}</p>
        <p>Terminal: {terminal.name}</p>
        <p>Routes loaded: {routes.length}</p>
      </div>

      {/* Print button - hidden when printing */}
      <div className="print:hidden mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Printer className="w-4 h-4 mr-2" />
          Print Form
        </button>
      </div>

      <div className="printable-form bg-white text-black p-8 max-w-4xl mx-auto print:max-w-none print:m-0 print:p-0">
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
                <th className="border border-black p-2 text-left">Rate</th>
                <th className="border border-black p-2 text-left">Requirements</th>
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
                    {route.rateType === 'Hourly' && `$${route.hourlyRate}/hr`}
                    {route.rateType === 'Mileage' && `$${route.mileageRate}/mi`}
                    {route.rateType === 'FlatRate' && `$${route.flatRate}`}
                  </td>
                  <td className="border border-black p-2 text-xs">
                    {route.requiresDoublesEndorsement && 'Doubles'}
                    {route.requiresDoublesEndorsement && route.requiresChainExperience && ', '}
                    {route.requiresChainExperience && 'Chains'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Driver Selection Section - Force page break before */}
        <div className="break-before-page print:break-before-page">
          <h3 className="font-bold text-lg mb-4">DRIVER SELECTION:</h3>
          
          {/* Driver Information */}
          <div className="border border-black p-4 mb-4">
            <h4 className="font-bold mb-3">Driver Information:</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-3">
                <span className="inline-block w-24">Full Name:</span>
                <span className="inline-block border-b border-black w-64"></span>
              </div>
              <div className="mb-3">
                <span className="inline-block w-32">Employee Number:</span>
                <span className="inline-block border-b border-black w-48"></span>
              </div>
              <div className="mb-3">
                <span className="inline-block w-24">Email:</span>
                <span className="inline-block border-b border-black w-64"></span>
              </div>
              <div className="mb-3">
                <span className="inline-block w-24">Phone:</span>
                <span className="inline-block border-b border-black w-48"></span>
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
            <div className="grid grid-cols-2 gap-8 mt-8">
              <div>
                <span className="inline-block w-32">Driver Signature:</span>
                <span className="inline-block border-b border-black w-64"></span>
              </div>
              <div>
                <span className="inline-block w-16">Date:</span>
                <span className="inline-block border-b border-black w-48"></span>
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

      <style>{`
        @media print {
          @page {
            margin: 0.5in;
          }
          
          .break-before-page {
            page-break-before: always;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintForms;