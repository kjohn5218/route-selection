import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle, Info, Search } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

interface Route {
  id: string;
  runNumber: string;
  origin: string;
  destination: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  estimatedHours: number | null;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
  terminalId: string;
  distance: number | null;
  workTime: number | null;
  rateType: string | null;
}

interface SelectionPeriod {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  requiredSelections: number;
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  doublesEndorsement: boolean;
  chainExperience: boolean;
}

interface ExistingSelection {
  id: string;
  firstChoiceId: string | null;
  secondChoiceId: string | null;
  thirdChoiceId: string | null;
}

const DriverSelectionForm = () => {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [firstChoice, setFirstChoice] = useState<string | null>(null);
  const [secondChoice, setSecondChoice] = useState<string | null>(null);
  const [thirdChoice, setThirdChoice] = useState<string | null>(null);
  const [filterQualified, setFilterQualified] = useState(true);

  // Fetch selection period details
  const { data: period, isLoading: periodLoading } = useQuery<SelectionPeriod>({
    queryKey: ['period', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/periods/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  // Fetch available routes for the period
  const { data: routes = [], isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ['period-routes', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/routes/period/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  // Fetch employee details
  const { data: employee } = useQuery<Employee>({
    queryKey: ['employee', user?.id],
    queryFn: async () => {
      const response = await apiClient.get(`/employees/by-user/${user?.id}`);
      return response.data;
    },
    enabled: !!user?.id,
  });

  // Check if driver already has a selection
  const { data: existingSelection } = useQuery<ExistingSelection>({
    queryKey: ['my-selection', periodId],
    queryFn: async () => {
      try {
        const response = await apiClient.get(`/selections/my/${periodId}`);
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!periodId,
  });

  // Set existing selections if they exist
  useEffect(() => {
    if (existingSelection) {
      setFirstChoice(existingSelection.firstChoiceId);
      setSecondChoice(existingSelection.secondChoiceId);
      setThirdChoice(existingSelection.thirdChoiceId);
    }
  }, [existingSelection]);

  // Submit selection mutation
  const submitMutation = useMutation({
    mutationFn: async (data: { firstChoiceId: string | null; secondChoiceId: string | null; thirdChoiceId: string | null }) => {
      const response = await apiClient.post('/selections', {
        selectionPeriodId: periodId,
        ...data,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Selection submitted successfully! Confirmation #: ${data.confirmationNumber}`);
      navigate('/selections');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to submit selection';
      toast.error(message);
    },
  });

  // Filter routes based on qualifications
  const isQualified = (route: Route) => {
    if (!employee) return true;
    if (route.requiresDoublesEndorsement && !employee.doublesEndorsement) return false;
    if (route.requiresChainExperience && !employee.chainExperience) return false;
    return true;
  };

  // Format rate type for display
  const formatRateType = (rateType: string | null): string => {
    if (!rateType) return '';
    switch (rateType) {
      case 'HOURLY':
        return 'Hourly';
      case 'MILEAGE':
        return 'Mileage';
      case 'FLAT_RATE':
        return 'Flat Rate';
      default:
        return rateType;
    }
  };

  // Filter routes based on search and qualifications
  const filteredRoutes = routes.filter(route => {
    const matchesSearch = searchTerm === '' || 
      route.runNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.destination.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesQualification = !filterQualified || isQualified(route);
    
    return matchesSearch && matchesQualification;
  });

  // Get available routes for each choice level
  const getAvailableRoutes = (choiceLevel: 1 | 2 | 3) => {
    return filteredRoutes.filter(route => {
      // Don't show already selected routes
      if (choiceLevel === 2 && route.id === firstChoice) return false;
      if (choiceLevel === 3 && (route.id === firstChoice || route.id === secondChoice)) return false;
      
      return true;
    });
  };

  const handleSubmit = () => {
    if (period?.requiredSelections === 3 && (!firstChoice || !secondChoice || !thirdChoice)) {
      toast.error('Please select all three route choices');
      return;
    }

    if (!firstChoice) {
      toast.error('Please select at least your first choice');
      return;
    }

    submitMutation.mutate({
      firstChoiceId: firstChoice,
      secondChoiceId: secondChoice,
      thirdChoiceId: thirdChoice,
    });
  };

  const getRouteById = (id: string | null) => {
    if (!id) return null;
    return routes.find(r => r.id === id);
  };

  if (periodLoading || routesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading selection form..." />
      </div>
    );
  }

  if (!period || period.status !== 'OPEN') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-900">Selection Period Not Available</h3>
              <p className="text-yellow-700">This selection period is not currently open for submissions.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/selections')}
            className="mt-4 inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Selections
          </button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const endDate = new Date(period.endDate);
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/selections')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Selections
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Submit Route Selection</h1>
            <p className="text-gray-600 mt-1">{period.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Time Remaining</p>
            <p className="text-lg font-semibold text-primary-600">{daysRemaining} days</p>
          </div>
        </div>
      </div>

      {/* Employee Info Card */}
      {employee && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 mb-1">Your Qualifications</p>
              <div className="flex gap-4 text-blue-800">
                <span>Doubles Endorsement: {employee.doublesEndorsement ? '✓ Yes' : '✗ No'}</span>
                <span>Chain Experience: {employee.chainExperience ? '✓ Yes' : '✗ No'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Selection Warning */}
      {existingSelection && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-900 mb-1">You have already submitted a selection</p>
              <p className="text-yellow-800">Submitting again will replace your previous selection.</p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search routes by number, origin, or destination..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterQualified}
              onChange={(e) => setFilterQualified(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Only show routes I'm qualified for</span>
          </label>
        </div>

        <p className="text-sm text-gray-600">
          {filteredRoutes.length} routes available
        </p>
      </div>

      {/* Selection Form */}
      <div className="space-y-6 mb-8">
        {/* First Choice */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">First Choice (Required)</h3>
          <div className="space-y-2">
            {getAvailableRoutes(1).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No routes match your search criteria</p>
            ) : (
              getAvailableRoutes(1).map(route => {
                const qualified = isQualified(route);
                return (
                  <label
                    key={route.id}
                    className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                      firstChoice === route.id
                        ? 'border-primary-500 bg-primary-50'
                        : qualified
                        ? 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="firstChoice"
                      value={route.id}
                      checked={firstChoice === route.id}
                      onChange={(e) => setFirstChoice(e.target.value)}
                      disabled={!qualified}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {route.runNumber} - {route.origin} → {route.destination}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Type: {route.type}
                          {route.estimatedHours && ` • ${route.estimatedHours} hours`}
                          {route.startTime && ` • Start: ${route.startTime}`}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {route.distance && `Distance: ${route.distance} mi`}
                          {route.distance && route.workTime && ' • '}
                          {route.workTime && `Work Time: ${route.workTime}h`}
                          {(route.distance || route.workTime) && route.rateType && ' • '}
                          {route.rateType && `Rate: ${formatRateType(route.rateType)}`}
                        </div>
                        {!qualified && (
                          <div className="text-xs text-red-600 mt-1">
                            Requires: {route.requiresDoublesEndorsement && 'Doubles Endorsement'} 
                            {route.requiresDoublesEndorsement && route.requiresChainExperience && ' & '}
                            {route.requiresChainExperience && 'Chain Experience'}
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className={`w-5 h-5 rounded-full border-2 ${
                          firstChoice === route.id
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-gray-300'
                        }`}>
                          {firstChoice === route.id && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Second Choice */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Second Choice {period.requiredSelections >= 2 ? '(Required)' : '(Optional)'}
          </h3>
          {!firstChoice ? (
            <p className="text-gray-500 text-center py-4">Please select your first choice first</p>
          ) : (
            <div className="space-y-2">
              {getAvailableRoutes(2).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No additional routes available</p>
              ) : (
                getAvailableRoutes(2).map(route => {
                  const qualified = isQualified(route);
                  return (
                    <label
                      key={route.id}
                      className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                        secondChoice === route.id
                          ? 'border-primary-500 bg-primary-50'
                          : qualified
                          ? 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="secondChoice"
                        value={route.id}
                        checked={secondChoice === route.id}
                        onChange={(e) => setSecondChoice(e.target.value)}
                        disabled={!qualified}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {route.runNumber} - {route.origin} → {route.destination}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Type: {route.type}
                            {route.estimatedHours && ` • ${route.estimatedHours} hours`}
                            {route.startTime && ` • Start: ${route.startTime}`}
                          </div>
                          {!qualified && (
                            <div className="text-xs text-red-600 mt-1">
                              Requires: {route.requiresDoublesEndorsement && 'Doubles Endorsement'} 
                              {route.requiresDoublesEndorsement && route.requiresChainExperience && ' & '}
                              {route.requiresChainExperience && 'Chain Experience'}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className={`w-5 h-5 rounded-full border-2 ${
                            secondChoice === route.id
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-gray-300'
                          }`}>
                            {secondChoice === route.id && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Third Choice */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Third Choice {period.requiredSelections >= 3 ? '(Required)' : '(Optional)'}
          </h3>
          {!secondChoice ? (
            <p className="text-gray-500 text-center py-4">Please select your second choice first</p>
          ) : (
            <div className="space-y-2">
              {getAvailableRoutes(3).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No additional routes available</p>
              ) : (
                getAvailableRoutes(3).map(route => {
                  const qualified = isQualified(route);
                  return (
                    <label
                      key={route.id}
                      className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                        thirdChoice === route.id
                          ? 'border-primary-500 bg-primary-50'
                          : qualified
                          ? 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="thirdChoice"
                        value={route.id}
                        checked={thirdChoice === route.id}
                        onChange={(e) => setThirdChoice(e.target.value)}
                        disabled={!qualified}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {route.runNumber} - {route.origin} → {route.destination}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Type: {route.type}
                            {route.estimatedHours && ` • ${route.estimatedHours} hours`}
                            {route.startTime && ` • Start: ${route.startTime}`}
                          </div>
                          {!qualified && (
                            <div className="text-xs text-red-600 mt-1">
                              Requires: {route.requiresDoublesEndorsement && 'Doubles Endorsement'} 
                              {route.requiresDoublesEndorsement && route.requiresChainExperience && ' & '}
                              {route.requiresChainExperience && 'Chain Experience'}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className={`w-5 h-5 rounded-full border-2 ${
                            thirdChoice === route.id
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-gray-300'
                          }`}>
                            {thirdChoice === route.id && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Selection Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">First Choice:</span>
            <span className="font-medium text-gray-900">
              {firstChoice ? getRouteById(firstChoice)?.runNumber : 'Not selected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Second Choice:</span>
            <span className="font-medium text-gray-900">
              {secondChoice ? getRouteById(secondChoice)?.runNumber : 'Not selected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Third Choice:</span>
            <span className="font-medium text-gray-900">
              {thirdChoice ? getRouteById(thirdChoice)?.runNumber : 'Not selected'}
            </span>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/selections')}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!firstChoice || submitMutation.isPending}
          className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {submitMutation.isPending ? 'Submitting...' : existingSelection ? 'Update Selection' : 'Submit Selection'}
        </button>
      </div>
    </div>
  );
};

export default DriverSelectionForm;