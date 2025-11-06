import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { ArrowLeft, Route as RouteIcon, CheckCircle, XCircle, Calendar, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Route {
  id: string;
  runNumber: string;
  origin: string;
  destination: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  estimatedHours: number | null;
}

interface Assignment {
  id: string;
  employeeId: string;
  routeId: string | null;
  choiceReceived: number | null;
  effectiveDate: string;
  route: Route | null;
}

interface SelectionPeriod {
  id: string;
  name: string;
  status: string;
  effectiveDate: string;
}

const DriverSelectionResults = () => {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch period details
  const { data: period } = useQuery<SelectionPeriod>({
    queryKey: ['period', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/periods/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  // Fetch driver's assignment
  const { data: assignment, isLoading, error } = useQuery<Assignment>({
    queryKey: ['driver-assignment', periodId],
    queryFn: async () => {
      const response = await apiClient.get(`/assignments/my/${periodId}`);
      return response.data;
    },
    enabled: !!periodId,
  });

  const getChoiceLabel = (choice: number | null) => {
    switch (choice) {
      case 1: return '1st Choice';
      case 2: return '2nd Choice';
      case 3: return '3rd Choice';
      default: return 'Not from choices';
    }
  };

  const getChoiceColor = (choice: number | null) => {
    switch (choice) {
      case 1: return 'bg-green-100 text-green-800 border-green-200';
      case 2: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 3: return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">No Assignment Found</h3>
              <p className="text-red-700">You don't have an assignment for this selection period.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/selections')}
            className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Selections
          </button>
        </div>
      </div>
    );
  }

  const isFloatPool = !assignment.route;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <button
          onClick={() => navigate('/selections')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Selections
        </button>
        
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Route Assignment</h1>
          {period && <p className="text-gray-600 mt-1">{period.name}</p>}
        </div>
      </div>

      {/* Assignment Status Card */}
      <div className={`rounded-lg border-2 p-6 mb-6 ${isFloatPool ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
        <div className="flex items-center gap-4">
          {isFloatPool ? (
            <XCircle className="w-12 h-12 text-orange-600" />
          ) : (
            <CheckCircle className="w-12 h-12 text-green-600" />
          )}
          <div className="flex-1">
            <h2 className={`text-xl font-semibold ${isFloatPool ? 'text-orange-900' : 'text-green-900'}`}>
              {isFloatPool ? 'Float Pool Assignment' : 'Route Assigned'}
            </h2>
            <p className={`mt-1 ${isFloatPool ? 'text-orange-700' : 'text-green-700'}`}>
              {isFloatPool 
                ? 'You have been assigned to the float pool for this period.'
                : `You have been assigned route ${assignment.route.runNumber}.`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Route Details */}
      {!isFloatPool && assignment.route && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Route Details</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <RouteIcon className="w-4 h-4" />
                  Route Number
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {assignment.route.runNumber}
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <MapPin className="w-4 h-4" />
                  Route
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {assignment.route.origin} → {assignment.route.destination}
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Calendar className="w-4 h-4" />
                  Type
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {assignment.route.type}
                </p>
              </div>
              
              {assignment.route.estimatedHours && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    Estimated Hours
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {assignment.route.estimatedHours} hours
                  </p>
                </div>
              )}
            </div>

            {(assignment.route.startTime || assignment.route.endTime) && (
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {assignment.route.startTime && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Start Time</p>
                      <p className="text-lg font-medium text-gray-900">
                        {assignment.route.startTime}
                      </p>
                    </div>
                  )}
                  {assignment.route.endTime && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">End Time</p>
                      <p className="text-lg font-medium text-gray-900">
                        {assignment.route.endTime}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {assignment.choiceReceived && (
              <div className="pt-4 border-t border-gray-200">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getChoiceColor(assignment.choiceReceived)}`}>
                  {getChoiceLabel(assignment.choiceReceived)} Awarded
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Effective Date */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
          <Calendar className="w-4 h-4" />
          Effective Date
        </div>
        <p className="text-lg font-semibold text-gray-900">
          {new Date(assignment.effectiveDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Float Pool Information */}
      {isFloatPool && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Float Pool Information</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• You will receive your daily route assignments from dispatch</li>
                <li>• Routes will be assigned based on operational needs</li>
                <li>• You may be assigned to different routes throughout the period</li>
                <li>• Contact your supervisor for specific schedule details</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverSelectionResults;