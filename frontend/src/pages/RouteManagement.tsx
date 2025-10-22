import { useState, useEffect } from 'react';
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
  AlertTriangle,
  X
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

interface RouteFormData {
  runNumber: string;
  type: 'SINGLES' | 'DOUBLES';
  origin: string;
  destination: string;
  days: string;
  startTime: string;
  endTime: string;
  distance: number;
  rateType: 'HOURLY' | 'MILEAGE' | 'FLAT_RATE';
  workTime: number;
  requiresDoublesEndorsement: boolean;
  requiresChainExperience: boolean;
  isActive: boolean;
}

const RouteManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [formData, setFormData] = useState<RouteFormData>({
    runNumber: '',
    type: 'SINGLES',
    origin: '',
    destination: '',
    days: '',
    startTime: '',
    endTime: '',
    distance: 0,
    rateType: 'HOURLY',
    workTime: 0,
    requiresDoublesEndorsement: false,
    requiresChainExperience: false,
    isActive: true,
  });

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
      await apiClient.put(`/routes/${routeId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });

  // Create route mutation
  const createRouteMutation = useMutation({
    mutationFn: async (data: RouteFormData) => {
      const response = await apiClient.post('/routes', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setShowAddModal(false);
      resetForm();
    },
  });

  // Update route mutation
  const updateRouteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RouteFormData> }) => {
      const response = await apiClient.put(`/routes/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setShowEditModal(false);
      setSelectedRoute(null);
      resetForm();
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
  }).sort((a, b) => {
    // Extract numeric part from route numbers for proper numeric sorting
    const getNumericValue = (runNumber: string) => {
      const match = runNumber.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };
    
    const numA = getNumericValue(a.runNumber);
    const numB = getNumericValue(b.runNumber);
    
    // If numeric parts are equal, fall back to string comparison
    if (numA === numB) {
      return a.runNumber.localeCompare(b.runNumber);
    }
    
    return numA - numB;
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

  const resetForm = () => {
    setFormData({
      runNumber: '',
      type: 'SINGLES',
      origin: '',
      destination: '',
      days: '',
      startTime: '',
      endTime: '',
      distance: 0,
      rateType: 'HOURLY',
      workTime: 0,
      requiresDoublesEndorsement: false,
      requiresChainExperience: false,
      isActive: true,
    });
  };

  const handleEdit = (route: Route) => {
    setSelectedRoute(route);
    
    // Ensure time format is HH:MM for HTML time inputs
    const formatTime = (time: string) => {
      if (!time) return '';
      
      // Remove any whitespace
      time = time.trim();
      
      // If time is already in HH:MM format, return it
      if (/^\d{2}:\d{2}$/.test(time)) return time;
      
      // If time is in H:MM format, pad with zero
      if (/^\d{1}:\d{2}$/.test(time)) return '0' + time;
      
      // Handle 12-hour format (e.g., "1:45 PM", "12:30 AM")
      const twelveHourMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (twelveHourMatch) {
        let hours = parseInt(twelveHourMatch[1]);
        const minutes = twelveHourMatch[2];
        const period = twelveHourMatch[3].toUpperCase();
        
        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
        
        // Pad hours with zero if needed
        const formattedHours = hours.toString().padStart(2, '0');
        return `${formattedHours}:${minutes}`;
      }
      
      // Otherwise return as is
      return time;
    };
    
    // Map old types to new types
    const mapRouteType = (type: string): RouteFormData['type'] => {
      if (type === 'DOUBLES') return 'DOUBLES';
      return 'SINGLES'; // Default all other types to SINGLES
    };
    
    const mapRateType = (rateType: string): RouteFormData['rateType'] => {
      if (rateType === 'HOURLY') return 'HOURLY';
      if (rateType === 'MILEAGE') return 'MILEAGE';
      if (rateType === 'SALARY' || rateType === 'FLAT_RATE') return 'FLAT_RATE';
      return 'HOURLY'; // Default
    };
    
    setFormData({
      runNumber: route.runNumber,
      type: mapRouteType(route.type),
      origin: route.origin,
      destination: route.destination,
      days: route.days,
      startTime: formatTime(route.startTime),
      endTime: formatTime(route.endTime),
      distance: route.distance,
      rateType: mapRateType(route.rateType),
      workTime: route.workTime,
      requiresDoublesEndorsement: route.requiresDoublesEndorsement,
      requiresChainExperience: route.requiresChainExperience,
      isActive: route.isActive,
    });
    setShowEditModal(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createRouteMutation.mutate(formData);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoute) {
      // Ensure work time has a valid value
      const dataToSubmit = {
        ...formData,
        workTime: formData.workTime || 0
      };
      updateRouteMutation.mutate({ id: selectedRoute.id, data: dataToSubmit });
    }
  };

  useEffect(() => {
    if (formData.type === 'DOUBLES') {
      setFormData(prev => ({ ...prev, requiresDoublesEndorsement: true }));
    }
  }, [formData.type]);

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
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleRouteStatus(route);
                          }}
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
                          type="button"
                          onClick={() => handleEdit(route)}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded transition-all"
                          title="Edit route"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
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

      {/* Add Route Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Add New Route</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Run Number</label>
                  <input
                    type="text"
                    value={formData.runNumber}
                    onChange={(e) => setFormData({ ...formData, runNumber: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as RouteFormData['type'] })}
                    className="input-field"
                    required
                  >
                    <option value="SINGLES">Singles</option>
                    <option value="DOUBLES">Doubles</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
                  <input
                    type="text"
                    value={formData.days}
                    onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Mon-Fri"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
                  <input
                    type="number"
                    value={formData.distance}
                    onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    min="0"
                    step="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                  <select
                    value={formData.rateType}
                    onChange={(e) => setFormData({ ...formData, rateType: e.target.value as RouteFormData['rateType'] })}
                    className="input-field"
                    required
                  >
                    <option value="HOURLY">Hourly</option>
                    <option value="MILEAGE">Mileage</option>
                    <option value="FLAT_RATE">Flat Rate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Time (hours)</label>
                  <input
                    type="number"
                    value={formData.workTime}
                    onChange={(e) => setFormData({ ...formData, workTime: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresDoublesEndorsement}
                    onChange={(e) => setFormData({ ...formData, requiresDoublesEndorsement: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    disabled={formData.type === 'DOUBLES'}
                  />
                  <span className="text-sm text-gray-700">Requires Doubles Endorsement</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresChainExperience}
                    onChange={(e) => setFormData({ ...formData, requiresChainExperience: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Requires Chain Experience</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRouteMutation.isPending}
                  className="btn-primary"
                >
                  {createRouteMutation.isPending ? 'Creating...' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {showEditModal && selectedRoute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit Route</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedRoute(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Run Number</label>
                  <input
                    type="text"
                    value={formData.runNumber}
                    onChange={(e) => setFormData({ ...formData, runNumber: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as RouteFormData['type'] })}
                    className="input-field"
                    required
                  >
                    <option value="SINGLES">Singles</option>
                    <option value="DOUBLES">Doubles</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
                  <input
                    type="text"
                    value={formData.days}
                    onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Mon-Fri"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
                  <input
                    type="number"
                    value={formData.distance}
                    onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    min="0"
                    step="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
                  <select
                    value={formData.rateType}
                    onChange={(e) => setFormData({ ...formData, rateType: e.target.value as RouteFormData['rateType'] })}
                    className="input-field"
                    required
                  >
                    <option value="HOURLY">Hourly</option>
                    <option value="MILEAGE">Mileage</option>
                    <option value="FLAT_RATE">Flat Rate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Time (hours)</label>
                  <input
                    type="number"
                    value={formData.workTime}
                    onChange={(e) => setFormData({ ...formData, workTime: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresDoublesEndorsement}
                    onChange={(e) => setFormData({ ...formData, requiresDoublesEndorsement: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    disabled={formData.type === 'DOUBLES'}
                  />
                  <span className="text-sm text-gray-700">Requires Doubles Endorsement</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresChainExperience}
                    onChange={(e) => setFormData({ ...formData, requiresChainExperience: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Requires Chain Experience</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedRoute(null);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateRouteMutation.isPending}
                  className="btn-primary"
                >
                  {updateRouteMutation.isPending ? 'Updating...' : 'Update Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteManagement;