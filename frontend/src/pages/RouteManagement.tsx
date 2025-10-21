import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Route as RouteIcon, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  MapPin,
  Clock,
  Calendar,
  Truck,
  Award,
  AlertTriangle
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

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
  createdAt: string;
  updatedAt: string;
}

const RouteManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Fetch routes
  const { data: routes, isLoading, error } = useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: async () => {
      const response = await apiClient.get('/routes');
      return response.data;
    },
  });

  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      await apiClient.delete(`/routes/${routeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setShowDeleteModal(false);
      setSelectedRoute(null);
    },
  });

  // Toggle route status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ routeId, isActive }: { routeId: string; isActive: boolean }) => {
      await apiClient.patch(`/routes/${routeId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  const filteredRoutes = routes?.filter(route => {
    const matchesSearch = 
      route.runNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.destination.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && route.isActive) ||
      (statusFilter === 'inactive' && !route.isActive);

    return matchesSearch && matchesStatus;
  }) || [];

  const handleDelete = (route: Route) => {
    setSelectedRoute(route);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedRoute) {
      deleteRouteMutation.mutate(selectedRoute.id);
    }
  };

  const toggleRouteStatus = (route: Route) => {
    toggleStatusMutation.mutate({ routeId: route.id, isActive: !route.isActive });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading routes..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <RouteIcon className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Routes</h3>
            <p className="text-red-700">Failed to load route data. Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  const routeStats = {
    total: routes?.length || 0,
    active: routes?.filter(r => r.isActive).length || 0,
    requiresDoubles: routes?.filter(r => r.requiresDoublesEndorsement).length || 0,
    requiresChains: routes?.filter(r => r.requiresChainExperience).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Route Management</h1>
          <p className="text-gray-600">Manage delivery routes and schedules</p>
        </div>
        {user?.role !== 'Driver' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Route
          </button>
        )}
      </div>

      {/* Filters and Search */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search routes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="input-field max-w-xs"
          >
            <option value="all">All Routes</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Route Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Routes</p>
              <p className="text-2xl font-bold text-gray-900">{routeStats.total}</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-xl">
              <RouteIcon className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Routes</p>
              <p className="text-2xl font-bold text-gray-900">{routeStats.active}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-xl">
              <Truck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Requires Doubles</p>
              <p className="text-2xl font-bold text-gray-900">{routeStats.requiresDoubles}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-xl">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Requires Chains</p>
              <p className="text-2xl font-bold text-gray-900">{routeStats.requiresChains}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Routes Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Route</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Type</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Origin → Destination</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Schedule</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Days</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Distance</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Work Time</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Requirements</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                {user?.role !== 'Driver' && (
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRoutes.map((route) => (
                <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary-100 p-1.5 rounded">
                        <RouteIcon className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="font-medium text-gray-900">{route.runNumber}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-900">{route.type}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{route.origin} → {route.destination}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{route.startTime} - {route.endTime}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-900">{route.days}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-900">{route.distance} mi</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-900">{route.workTime}h ({route.rateType})</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {route.requiresDoublesEndorsement && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Doubles
                        </span>
                      )}
                      {route.requiresChainExperience && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Chains
                        </span>
                      )}
                      {!route.requiresDoublesEndorsement && !route.requiresChainExperience && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Standard
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      route.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {route.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {user?.role !== 'Driver' && (
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRouteStatus(route)}
                          disabled={toggleStatusMutation.isPending}
                          className={`py-1 px-3 rounded text-xs font-medium transition-all ${
                            route.isActive
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {route.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setSelectedRoute(route)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-all"
                          title="Edit route"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(route)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Delete route"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRoutes.length === 0 && (
        <div className="text-center py-12">
          <RouteIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No routes found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search criteria or filters' 
              : 'Get started by adding your first route'
            }
          </p>
          {user?.role !== 'Driver' && !searchTerm && statusFilter === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
            >
              Add First Route
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedRoute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Route</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete Route {selectedRoute.runNumber}? 
              This action cannot be undone and may affect existing selections.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteRouteMutation.isPending}
                className="btn-danger"
              >
                {deleteRouteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteManagement;