import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Route, Calendar, Clock, MapPin, Truck, AlertTriangle } from 'lucide-react';
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

  // Get active selection period
  const { data: activePeriod } = useQuery<SelectionPeriod | null>({
    queryKey: ['active-selection-period'],
    queryFn: async () => {
      const response = await apiClient.get('/periods/active');
      return response.data;
    },
  });

  // Get available routes
  const { data: availableRoutes = [], isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ['available-routes', activePeriod?.id],
    queryFn: async () => {
      if (!activePeriod?.id) return [];
      const response = await apiClient.get(`/routes/available/${activePeriod.id}`);
      return response.data;
    },
    enabled: !!activePeriod?.id && activePeriod.status === 'OPEN',
  });

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
  if (user?.role === 'ADMIN') {
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

  // Already submitted
  if (currentSelection) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Route Selection</h1>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
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
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Selections</h2>
          {[
            { label: 'First Choice', route: currentSelection.firstChoice },
            { label: 'Second Choice', route: currentSelection.secondChoice },
            { label: 'Third Choice', route: currentSelection.thirdChoice },
          ].map((choice, index) => (
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

      {submitSelection.error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">
              {(submitSelection.error as any).response?.data?.error || 'Failed to submit selection'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((choiceNumber) => {
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

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!selectedRouteIds.length || submitSelection.isPending}
          className="btn-primary"
        >
          {submitSelection.isPending ? 'Submitting...' : 'Submit Selection'}
        </button>
      </div>
    </div>
  );
};

export default Selections;