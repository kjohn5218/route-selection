import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Route, Calendar, Clock, MapPin, Truck, AlertTriangle, Search } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

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
  workTime: number;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
  isActive: boolean;
}

interface SelectionPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  requiredSelections: number;
}

interface Selection {
  id: string;
  firstChoiceId: string | null;
  secondChoiceId: string | null;
  thirdChoiceId: string | null;
  confirmationNumber: string;
  submittedAt: string;
  firstChoice: Route | null;
  secondChoice: Route | null;
  thirdChoice: Route | null;
}

const Selections = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedChoices, setSelectedChoices] = useState<{
    firstChoiceId: string | null;
    secondChoiceId: string | null;
    thirdChoiceId: string | null;
  }>({
    firstChoiceId: null,
    secondChoiceId: null,
    thirdChoiceId: null,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showListView, setShowListView] = useState(true);

  // Get active selection period
  const { data: activePeriod } = useQuery<SelectionPeriod | null>({
    queryKey: ['active-selection-period'],
    queryFn: async () => {
      const response = await apiClient.get('/periods/active');
      console.log('Active period response:', response.data);
      return response.data;
    },
  });

  // Get available routes
  const { data: availableRoutes = [], isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ['available-routes', activePeriod?.id],
    queryFn: async () => {
      if (!activePeriod?.id) return [];
      console.log('Fetching available routes for period:', activePeriod.id);
      const response = await apiClient.get(`/routes/available/${activePeriod.id}`);
      console.log('Available routes response:', response.data);
      return response.data;
    },
    enabled: !!activePeriod?.id && activePeriod.status === 'OPEN',
  });

  console.log('Available routes query enabled:', !!activePeriod?.id && activePeriod?.status === 'OPEN');
  console.log('Active period:', activePeriod);

  // Get current selection
  const { data: currentSelection } = useQuery<Selection | null>({
    queryKey: ['my-selection', activePeriod?.id],
    queryFn: async () => {
      if (!activePeriod?.id) return null;
      const response = await apiClient.get(`/selections/my/${activePeriod.id}`);
      return response.data;
    },
    enabled: !!activePeriod?.id,
  });

  // Submit selection mutation
  const submitSelection = useMutation({
    mutationFn: async (data: {
      selectionPeriodId: string;
      firstChoiceId?: string;
      secondChoiceId?: string;
      thirdChoiceId?: string;
    }) => {
      const response = await apiClient.post('/selections', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-selection'] });
      setSelectedChoices({
        firstChoiceId: null,
        secondChoiceId: null,
        thirdChoiceId: null,
      });
    },
  });

  const handleChoiceSelect = (choiceNumber: 1 | 2 | 3, routeId: string | null) => {
    const key = `${['first', 'second', 'third'][choiceNumber - 1]}ChoiceId` as keyof typeof selectedChoices;
    setSelectedChoices(prev => ({
      ...prev,
      [key]: routeId,
    }));
  };

  const handleSubmit = () => {
    if (!activePeriod?.id) return;

    const choices = Object.entries(selectedChoices)
      .filter(([_, value]) => value !== null)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    submitSelection.mutate({
      selectionPeriodId: activePeriod.id,
      ...choices,
    });
  };

  const getRouteTypeColor = (type: string) => {
    switch (type) {
      case 'LOCAL':
        return 'bg-blue-100 text-blue-800';
      case 'REGIONAL':
        return 'bg-green-100 text-green-800';
      case 'LONG_HAUL':
        return 'bg-purple-100 text-purple-800';
      case 'DEDICATED':
        return 'bg-orange-100 text-orange-800';
      case 'DOUBLES':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRateTypeIcon = (rateType: string) => {
    switch (rateType) {
      case 'HOURLY':
        return Clock;
      case 'MILEAGE':
        return Truck;
      default:
        return MapPin;
    }
  };

  // Admin view - show all selections
  if (user?.role === 'Admin') {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Route Selections</h1>
        <div className="card">
          <div className="p-6">
            <p className="text-gray-600">Admin view for managing all employee selections.</p>
          </div>
        </div>
      </div>
    );
  }

  // No active period
  if (!activePeriod || activePeriod.status !== 'OPEN') {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Route Selection</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-900">No Active Selection Period</h3>
              <p className="text-yellow-700 mt-1">
                There is no selection period currently open. Please check back later or contact your administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Update selection mutation
  const updateSelection = useMutation({
    mutationFn: async (data: {
      id: string;
      firstChoiceId?: string | null;
      secondChoiceId?: string | null;
      thirdChoiceId?: string | null;
    }) => {
      const { id, ...choices } = data;
      const response = await apiClient.put(`/selections/${id}`, choices);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-selection'] });
      setIsEditMode(false);
      setSelectedChoices({
        firstChoiceId: null,
        secondChoiceId: null,
        thirdChoiceId: null,
      });
    },
  });

  const deleteSelection = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/selections/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-selection'] });
    },
  });

  const [isEditMode, setIsEditMode] = useState(false);

  // Initialize edit mode selections
  const handleEditClick = () => {
    if (currentSelection) {
      setSelectedChoices({
        firstChoiceId: currentSelection.firstChoiceId,
        secondChoiceId: currentSelection.secondChoiceId,
        thirdChoiceId: currentSelection.thirdChoiceId,
      });
      setIsEditMode(true);
    }
  };

  const handleUpdate = () => {
    if (!currentSelection) return;

    const choices = Object.entries(selectedChoices)
      .filter(([_, value]) => value !== null)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    updateSelection.mutate({
      id: currentSelection.id,
      ...choices,
    });
  };

  // Already submitted - show view/edit mode
  if (currentSelection && !isEditMode) {
    const isOpen = activePeriod?.status === 'OPEN';
    
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Route Selection</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Selection Submitted</h3>
                <p className="text-green-700 mt-1">
                  Your route selection has been submitted successfully.
                </p>
                <p className="text-sm text-green-600 mt-2">
                  Confirmation #: {currentSelection.confirmationNumber}
                </p>
              </div>
            </div>
            {isOpen && (
              <div className="flex gap-2">
                <button
                  onClick={handleEditClick}
                  className="btn-secondary"
                >
                  Edit Selection
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel your selection? This cannot be undone.')) {
                      deleteSelection.mutate(currentSelection.id);
                    }
                  }}
                  disabled={deleteSelection.isPending}
                  className="btn-danger"
                >
                  Cancel Selection
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Selections</h2>
          {[
            { label: 'First Choice', route: currentSelection.firstChoice },
            { label: 'Second Choice', route: currentSelection.secondChoice },
            { label: 'Third Choice', route: currentSelection.thirdChoice },
          ].slice(0, activePeriod?.requiredSelections || 3).map((choice, index) => (
            <div key={index} className="card">
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-2">{choice.label}</h3>
                {choice.route ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">#{choice.route.runNumber}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRouteTypeColor(choice.route.type)}`}>
                        {choice.route.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {choice.route.origin} → {choice.route.destination}
                    </p>
                    <p className="text-sm text-gray-500">
                      {choice.route.days} | {choice.route.startTime} - {choice.route.endTime}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No selection made</p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {!isOpen && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-yellow-700 text-sm">
                The selection period has closed. You can no longer modify your selections.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Selection form
  const selectedRouteIds = Object.values(selectedChoices).filter(Boolean);
  const getAvailableRoutesForChoice = (choiceNumber: 1 | 2 | 3) => {
    return availableRoutes.filter(route => {
      // Don't show routes already selected for other choices
      const otherChoices = Object.entries(selectedChoices)
        .filter(([key]) => key !== `${['first', 'second', 'third'][choiceNumber - 1]}ChoiceId`)
        .map(([_, value]) => value)
        .filter(Boolean);
      return !otherChoices.includes(route.id);
    });
  };

  // Filter routes based on search and type
  const filteredRoutes = availableRoutes.filter(route => {
    const matchesSearch = searchTerm === '' || 
      route.runNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.destination.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'ALL' || route.type === filterType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Route Selection</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{activePeriod.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>
              Open until {new Date(activePeriod.endDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {(submitSelection.error || updateSelection.error) && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">
              {(submitSelection.error as any)?.response?.data?.error || 
               (updateSelection.error as any)?.response?.data?.error || 
               'Failed to submit selection'}
            </p>
          </div>
        </div>
      )}

      {isEditMode && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <p className="text-blue-700 font-medium">
                Edit Mode - Update your route selections below
              </p>
            </div>
            <button
              onClick={() => {
                setIsEditMode(false);
                setSelectedChoices({
                  firstChoiceId: null,
                  secondChoiceId: null,
                  thirdChoiceId: null,
                });
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Cancel Edit
            </button>
          </div>
        </div>
      )}

      {/* View Toggle and Filters */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search routes by number, origin, or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-select w-full sm:w-48"
          >
            <option value="ALL">All Types</option>
            <option value="LOCAL">Local</option>
            <option value="REGIONAL">Regional</option>
            <option value="LONG_HAUL">Long Haul</option>
            <option value="DEDICATED">Dedicated</option>
            <option value="DOUBLES">Doubles</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowListView(!showListView)}
            className="btn-secondary"
          >
            {showListView ? 'Selection View' : 'List View'}
          </button>
        </div>
      </div>

      {/* Available Routes Summary */}
      <div className="mb-6 bg-primary-50 border border-primary-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Route className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-semibold text-primary-900">
                {filteredRoutes.length} Available Routes
              </p>
              <p className="text-sm text-primary-700">
                {selectedRouteIds.length > 0 
                  ? `${selectedRouteIds.length} route${selectedRouteIds.length > 1 ? 's' : ''} selected`
                  : `Select ${activePeriod?.requiredSelections === 1 ? '1 route' : `up to ${activePeriod?.requiredSelections || 3} routes`} in order of preference`}
              </p>
            </div>
          </div>
          {selectedRouteIds.length > 0 && selectedRouteIds.length < (activePeriod?.requiredSelections || 3) && (
            <span className="text-sm text-primary-600 font-medium">
              {(activePeriod?.requiredSelections || 3) - selectedRouteIds.length} selection{(activePeriod?.requiredSelections || 3) - selectedRouteIds.length !== 1 ? 's' : ''} remaining
            </span>
          )}
        </div>
      </div>

      {/* List View */}
      {showListView ? (
        <div className="mb-8">
          <div className="card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Origin/Destination
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Selection
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No routes found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filteredRoutes.map((route) => {
                      const isSelected = selectedRouteIds.includes(route.id);
                      const choiceNumber = selectedChoices.firstChoiceId === route.id ? 1 
                        : selectedChoices.secondChoiceId === route.id ? 2 
                        : selectedChoices.thirdChoiceId === route.id ? 3 
                        : null;
                      
                      return (
                        <tr key={route.id} className={isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">#{route.runNumber}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRouteTypeColor(route.type)}`}>
                              {route.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{route.origin}</div>
                            <div className="text-sm text-gray-500">→ {route.destination}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{route.days}</div>
                            <div className="text-sm text-gray-500">{route.startTime} - {route.endTime}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {route.distance} mi • {route.workTime}h • {route.rateType}
                            </div>
                            {(route.requiresDoublesEndorsement || route.requiresChainExperience) && (
                              <div className="flex gap-2 mt-1">
                                {route.requiresDoublesEndorsement && (
                                  <span className="text-xs text-amber-600 font-medium">Doubles</span>
                                )}
                                {route.requiresChainExperience && (
                                  <span className="text-xs text-amber-600 font-medium">Chains</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isSelected ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-600 text-white">
                                Choice #{choiceNumber}
                              </span>
                            ) : (
                              <select
                                className="form-select text-sm"
                                value=""
                                onChange={(e) => handleChoiceSelect(parseInt(e.target.value) as 1 | 2 | 3, route.id)}
                                disabled={selectedRouteIds.length >= (activePeriod?.requiredSelections || 3)}
                              >
                                <option value="">Select as...</option>
                                {!selectedChoices.firstChoiceId && <option value="1">1st Choice</option>}
                                {!selectedChoices.secondChoiceId && activePeriod?.requiredSelections && activePeriod.requiredSelections >= 2 && <option value="2">2nd Choice</option>}
                                {!selectedChoices.thirdChoiceId && activePeriod?.requiredSelections && activePeriod.requiredSelections >= 3 && <option value="3">3rd Choice</option>}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Routes Summary */}
          {selectedRouteIds.length > 0 && (
            <div className={`mt-6 grid grid-cols-1 ${activePeriod?.requiredSelections === 1 ? '' : activePeriod?.requiredSelections === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
              {Array.from({ length: activePeriod?.requiredSelections || 3 }, (_, i) => i + 1).map((num) => {
                const key = `${['first', 'second', 'third'][num - 1]}ChoiceId` as keyof typeof selectedChoices;
                const routeId = selectedChoices[key];
                const route = routeId ? availableRoutes.find(r => r.id === routeId) : null;
                
                return (
                  <div key={num} className="card p-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      {['First', 'Second', 'Third'][num - 1]} Choice
                    </h4>
                    {route ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">#{route.runNumber}</p>
                        <p className="text-sm text-gray-600">{route.origin} → {route.destination}</p>
                        <button
                          onClick={() => handleChoiceSelect(num as 1 | 2 | 3, null)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium mt-2"
                        >
                          Remove Selection
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">Not selected</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Selection View (Original Grid) */
        <div className={`grid grid-cols-1 ${activePeriod?.requiredSelections === 1 ? '' : activePeriod?.requiredSelections === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6 mb-8`}>
          {Array.from({ length: activePeriod?.requiredSelections || 3 }, (_, i) => i + 1).map((choiceNumber) => {
            const key = `${['first', 'second', 'third'][choiceNumber - 1]}ChoiceId` as keyof typeof selectedChoices;
            const selectedRouteId = selectedChoices[key];
            const availableRoutesForChoice = getAvailableRoutesForChoice(choiceNumber as 1 | 2 | 3);

            return (
              <div key={choiceNumber} className="card">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">
                    {['First', 'Second', 'Third'][choiceNumber - 1]} Choice
                  </h3>
                  
                  <select
                    className="form-select mb-4"
                    value={selectedRouteId || ''}
                    onChange={(e) => handleChoiceSelect(choiceNumber as 1 | 2 | 3, e.target.value || null)}
                    disabled={routesLoading}
                  >
                    <option value="">Select a route...</option>
                    {availableRoutesForChoice.map((route) => (
                      <option key={route.id} value={route.id}>
                        #{route.runNumber} - {route.origin} → {route.destination}
                        {route.requiresDoublesEndorsement && ' (Doubles Required)'}
                        {route.requiresChainExperience && ' (Chains Required)'}
                      </option>
                    ))}
                  </select>

                  {selectedRouteId && (
                    <div className="border-t pt-4">
                      {(() => {
                        const route = availableRoutes.find(r => r.id === selectedRouteId);
                        if (!route) return null;

                        const RateIcon = getRateTypeIcon(route.rateType);

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">#{route.runNumber}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRouteTypeColor(route.type)}`}>
                                {route.type.replace('_', ' ')}
                              </span>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <MapPin className="w-4 h-4" />
                                <span>{route.origin} → {route.destination}</span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span>{route.days}</span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span>{route.startTime} - {route.endTime}</span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-gray-600">
                                <RateIcon className="w-4 h-4" />
                                <span>{route.rateType} ({route.workTime}h)</span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-gray-600">
                                <Truck className="w-4 h-4" />
                                <span>{route.distance} miles</span>
                              </div>
                            </div>

                            {(route.requiresDoublesEndorsement || route.requiresChainExperience) && (
                              <div className="border-t pt-3 space-y-1">
                                {route.requiresDoublesEndorsement && (
                                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Doubles endorsement required</span>
                                  </div>
                                )}
                                {route.requiresChainExperience && (
                                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Chain experience required</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={isEditMode ? handleUpdate : handleSubmit}
          disabled={!selectedRouteIds.length || submitSelection.isPending || updateSelection.isPending}
          className="btn-primary"
        >
          {submitSelection.isPending || updateSelection.isPending ? 'Saving...' : 
           isEditMode ? 'Update Selection' : 'Submit Selection'}
        </button>
      </div>
    </div>
  );
};

export default Selections;