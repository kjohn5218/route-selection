import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Play,
  Pause,
  Clock,
  Users,
  CheckSquare,
  Activity,
  X,
  Send,
  AlertCircle,
  Settings,
  Route as RouteIcon
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface SelectionPeriod {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: 'UPCOMING' | 'OPEN' | 'CLOSED' | 'PROCESSING' | 'COMPLETED';
  requiredSelections: number;
  createdAt: string;
  _count?: {
    selections: number;
  };
}

interface PeriodFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  routeIds?: string[];
  requiredSelections: number;
}

const Periods = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<SelectionPeriod | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'UPCOMING' | 'OPEN' | 'CLOSED' | 'PROCESSING' | 'COMPLETED'>('all');
  const [formData, setFormData] = useState<PeriodFormData>({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    routeIds: [],
    requiredSelections: 3,
  });

  // Fetch periods
  const { data: periods, isLoading, error } = useQuery<SelectionPeriod[]>({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await apiClient.get('/periods');
      return response.data;
    },
  });

  // Fetch all active routes for selection
  const { data: allRoutes = [] } = useQuery<any[]>({
    queryKey: ['routes', 'active'],
    queryFn: async () => {
      const response = await apiClient.get('/routes?isActive=true');
      return response.data;
    },
  });

  // Create period mutation
  const createPeriodMutation = useMutation({
    mutationFn: async (data: PeriodFormData) => {
      const response = await apiClient.post('/periods', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      setShowAddModal(false);
      resetForm();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to create period';
      const details = error.response?.data?.details;
      if (details) {
        console.error('Validation errors:', details);
      }
      alert(`Error: ${message}`);
    },
  });

  // Update period mutation
  const updatePeriodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PeriodFormData> }) => {
      const response = await apiClient.put(`/periods/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      setShowEditModal(false);
      setSelectedPeriod(null);
      resetForm();
    },
  });

  // Delete period mutation
  const deletePeriodMutation = useMutation({
    mutationFn: async (periodId: string) => {
      await apiClient.delete(`/periods/${periodId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      setShowDeleteModal(false);
      setSelectedPeriod(null);
    },
  });

  // Update period status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ periodId, status }: { periodId: string; status: string }) => {
      await apiClient.patch(`/periods/${periodId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
    },
  });

  // Send notifications mutation
  const notifyDriversMutation = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await apiClient.post(`/periods/${periodId}/notify`);
      return response.data;
    },
    onSuccess: (data) => {
      setShowNotifyModal(false);
      setSelectedPeriod(null);
      // Show success message
      const failedText = data.notificationsFailed > 0 ? ` (${data.notificationsFailed} failed)` : '';
      alert(`Successfully sent notifications to ${data.notificationsSent} eligible drivers${failedText}.`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to send notifications';
      alert(`Error: ${message}`);
    },
  });

  const filteredPeriods = periods?.filter(period => {
    const matchesSearch = 
      period.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (period.description && period.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || period.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  const handleDelete = (period: SelectionPeriod) => {
    setSelectedPeriod(period);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedPeriod) {
      deletePeriodMutation.mutate(selectedPeriod.id);
    }
  };

  const handleStatusChange = (period: SelectionPeriod, newStatus: string) => {
    updateStatusMutation.mutate({ periodId: period.id, status: newStatus });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      routeIds: [],
      requiredSelections: 3,
    });
  };

  const handleEdit = async (period: SelectionPeriod) => {
    setSelectedPeriod(period);
    
    // Fetch the full period details with routes
    try {
      const response = await apiClient.get(`/periods/${period.id}`);
      const fullPeriod = response.data;
      
      setFormData({
        name: fullPeriod.name,
        description: fullPeriod.description || '',
        startDate: fullPeriod.startDate.split('T')[0],
        endDate: fullPeriod.endDate.split('T')[0],
        routeIds: fullPeriod.routes?.map((pr: any) => pr.route.id) || [],
        requiredSelections: fullPeriod.requiredSelections || 3,
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Error fetching period details:', error);
      alert('Failed to load period details');
    }
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting form data:', formData);
    createPeriodMutation.mutate(formData);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPeriod) {
      updatePeriodMutation.mutate({ id: selectedPeriod.id, data: formData });
    }
  };

  const handleNotify = (period: SelectionPeriod) => {
    setSelectedPeriod(period);
    setShowNotifyModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-green-100 text-green-800';
      case 'UPCOMING':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      case 'PROCESSING':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <Activity className="w-4 h-4" />;
      case 'UPCOMING':
        return <Clock className="w-4 h-4" />;
      case 'COMPLETED':
        return <CheckSquare className="w-4 h-4" />;
      case 'CLOSED':
        return <Pause className="w-4 h-4" />;
      case 'PROCESSING':
        return <Activity className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading selection periods..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Periods</h3>
            <p className="text-red-700">Failed to load selection period data. Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  const periodStats = {
    total: periods?.length || 0,
    active: periods?.filter(p => p.status === 'OPEN').length || 0,
    pending: periods?.filter(p => p.status === 'UPCOMING').length || 0,
    completed: periods?.filter(p => p.status === 'COMPLETED').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Selection Periods</h1>
          <p className="text-gray-600">Manage route selection periods and schedules</p>
        </div>
        {user?.role !== 'Driver' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Period
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
              placeholder="Search periods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input-field max-w-xs"
          >
            <option value="all">All Statuses</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Period Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Periods</p>
              <p className="text-2xl font-bold text-gray-900">{periodStats.total}</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-xl">
              <Calendar className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{periodStats.active}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-xl">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{periodStats.pending}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{periodStats.completed}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-xl">
              <CheckSquare className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Periods Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredPeriods.map((period) => (
          <div key={period.id} className="card">
            <div className="p-6">
              {/* Period Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{period.name}</h3>
                  {period.description && (
                    <p className="text-sm text-gray-500 mt-1">{period.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(period.status)}`}>
                    {getStatusIcon(period.status)}
                    {period.status}
                  </span>
                </div>
              </div>

              {/* Period Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{period._count?.selections || 0} selections</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <RouteIcon className="w-4 h-4" />
                  <span>{period.routeCount || 0} routes</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Created {new Date(period.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Progress indicator for active periods */}
              {period.status === 'OPEN' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Period Progress</span>
                    <span>
                      {Math.round(
                        ((new Date().getTime() - new Date(period.startDate).getTime()) / 
                        (new Date(period.endDate).getTime() - new Date(period.startDate).getTime())) * 100
                      )}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, 
                          ((new Date().getTime() - new Date(period.startDate).getTime()) / 
                          (new Date(period.endDate).getTime() - new Date(period.startDate).getTime())) * 100
                        ))}%` 
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              {user?.role !== 'Driver' && (
                <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                  {period.status === 'UPCOMING' && (
                    <button
                      onClick={() => handleStatusChange(period, 'OPEN')}
                      disabled={updateStatusMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Open
                    </button>
                  )}
                  {period.status === 'OPEN' && (
                    <button
                      onClick={() => handleStatusChange(period, 'CLOSED')}
                      disabled={updateStatusMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"
                    >
                      <Pause className="w-4 h-4" />
                      Close
                    </button>
                  )}
                  {period.status === 'CLOSED' && (
                    <button
                      onClick={() => handleStatusChange(period, 'PROCESSING')}
                      disabled={updateStatusMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-sm font-medium transition-all"
                    >
                      <Activity className="w-4 h-4" />
                      Process
                    </button>
                  )}
                  {period.status === 'PROCESSING' && (
                    <button
                      onClick={() => handleStatusChange(period, 'COMPLETED')}
                      disabled={updateStatusMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-all"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Complete
                    </button>
                  )}
                  <div className="flex-1" />
                  {(period.status === 'CLOSED' || period.status === 'PROCESSING' || period.status === 'COMPLETED') && (
                    <button
                      onClick={() => navigate(`/periods/${period.id}/manage`)}
                      className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                      title="Manage selections"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                  {period.status === 'UPCOMING' && (
                    <button
                      onClick={() => handleNotify(period)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Notify drivers"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(period)}
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                    title="Edit period"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {period.status !== 'OPEN' && period.status !== 'PROCESSING' && (
                    <button
                      onClick={() => handleDelete(period)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete period"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPeriods.length === 0 && (
        <div className="card">
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No selection periods found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search criteria or filters' 
                : 'Get started by creating your first selection period'
              }
            </p>
            {user?.role !== 'Driver' && !searchTerm && statusFilter === 'all' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary"
              >
                Create First Period
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Selection Period</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{selectedPeriod.name}"? 
              This action cannot be undone and will remove all associated selections.
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
                disabled={deletePeriodMutation.isPending}
                className="btn-danger"
              >
                {deletePeriodMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Period Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Create Selection Period</h3>
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

            <form onSubmit={handleSubmitAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Q1 2024 Route Selection"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Add any important details about this selection period..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="input-field"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="input-field"
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Selections</label>
                <select
                  value={formData.requiredSelections}
                  onChange={(e) => setFormData({ ...formData, requiredSelections: parseInt(e.target.value) })}
                  className="input-field"
                  required
                >
                  <option value={1}>1 Route Selection</option>
                  <option value={2}>2 Route Selections</option>
                  <option value={3}>3 Route Selections</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  How many route choices can drivers submit?
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available Routes</label>
                {allRoutes.length > 0 && (
                  <div className="mb-2">
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={formData.routeIds?.length === allRoutes.length}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = formData.routeIds && formData.routeIds.length > 0 && formData.routeIds.length < allRoutes.length;
                          }
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, routeIds: allRoutes.map(r => r.id) });
                          } else {
                            setFormData({ ...formData, routeIds: [] });
                          }
                        }}
                        className="text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium">Select All Routes ({allRoutes.length})</span>
                    </label>
                  </div>
                )}
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {allRoutes.length === 0 ? (
                    <p className="text-sm text-gray-500">No active routes available</p>
                  ) : (
                    [...allRoutes].sort((a, b) => parseInt(a.runNumber) - parseInt(b.runNumber)).map(route => (
                      <label key={route.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          value={route.id}
                          checked={formData.routeIds?.includes(route.id) || false}
                          onChange={(e) => {
                            const newRouteIds = e.target.checked
                              ? [...(formData.routeIds || []), route.id]
                              : (formData.routeIds || []).filter(id => id !== route.id);
                            setFormData({ ...formData, routeIds: newRouteIds });
                          }}
                          className="text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm">
                          #{route.runNumber} - {route.origin} → {route.destination} ({route.type})
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.routeIds?.length || 0} of {allRoutes.length} routes selected for this selection period
                </p>
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
                  disabled={createPeriodMutation.isPending}
                  className="btn-primary"
                >
                  {createPeriodMutation.isPending ? 'Creating...' : 'Create Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Period Modal */}
      {showEditModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit Selection Period</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPeriod(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="input-field"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="input-field"
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Selections</label>
                <select
                  value={formData.requiredSelections}
                  onChange={(e) => setFormData({ ...formData, requiredSelections: parseInt(e.target.value) })}
                  className="input-field"
                  required
                >
                  <option value={1}>1 Route Selection</option>
                  <option value={2}>2 Route Selections</option>
                  <option value={3}>3 Route Selections</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  How many route choices can drivers submit?
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Available Routes</label>
                {allRoutes.length > 0 && (
                  <div className="mb-2">
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 rounded-lg hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={formData.routeIds?.length === allRoutes.length}
                        ref={(el) => {
                          if (el) {
                            el.indeterminate = formData.routeIds && formData.routeIds.length > 0 && formData.routeIds.length < allRoutes.length;
                          }
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, routeIds: allRoutes.map(r => r.id) });
                          } else {
                            setFormData({ ...formData, routeIds: [] });
                          }
                        }}
                        className="text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium">Select All Routes ({allRoutes.length})</span>
                    </label>
                  </div>
                )}
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {allRoutes.length === 0 ? (
                    <p className="text-sm text-gray-500">No active routes available</p>
                  ) : (
                    [...allRoutes].sort((a, b) => parseInt(a.runNumber) - parseInt(b.runNumber)).map(route => (
                      <label key={route.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          value={route.id}
                          checked={formData.routeIds?.includes(route.id) || false}
                          onChange={(e) => {
                            const newRouteIds = e.target.checked
                              ? [...(formData.routeIds || []), route.id]
                              : (formData.routeIds || []).filter(id => id !== route.id);
                            setFormData({ ...formData, routeIds: newRouteIds });
                          }}
                          className="text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm">
                          #{route.runNumber} - {route.origin} → {route.destination} ({route.type})
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.routeIds?.length || 0} of {allRoutes.length} routes selected for this selection period
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Important</p>
                    <p>Changing dates or routes may affect employees who have already made selections.</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPeriod(null);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePeriodMutation.isPending}
                  className="btn-primary"
                >
                  {updatePeriodMutation.isPending ? 'Updating...' : 'Update Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notify Drivers Modal */}
      {showNotifyModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Notify Drivers</h3>
              <button
                onClick={() => {
                  setShowNotifyModal(false);
                  setSelectedPeriod(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Send className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-900">Email Notification</p>
                    <p className="text-sm text-blue-700 mt-1">
                      An email will be sent to all eligible drivers with instructions on how to make their route selections.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Preview</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Subject:</span>
                    <p className="mt-1">Route Selection Period Now Open: {selectedPeriod.name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Message:</span>
                    <div className="mt-1 bg-gray-50 p-3 rounded border border-gray-200">
                      <p>Dear Driver,</p>
                      <br />
                      <p>The route selection period "{selectedPeriod.name}" is now open.</p>
                      <br />
                      <p><strong>Selection Period Details:</strong></p>
                      <ul className="list-disc list-inside mt-2 ml-2">
                        <li>Start Date: {new Date(selectedPeriod.startDate).toLocaleDateString()}</li>
                        <li>End Date: {new Date(selectedPeriod.endDate).toLocaleDateString()}</li>
                      </ul>
                      <br />
                      <p><strong>How to Submit Your Selection:</strong></p>
                      <ol className="list-decimal list-inside mt-2 ml-2">
                        <li>Log in to your driver portal</li>
                        <li>Navigate to "Route Selection"</li>
                        <li>Review available routes based on your qualifications</li>
                        <li>Select up to 3 route preferences in order of priority</li>
                        <li>Submit your selections before the deadline</li>
                      </ol>
                      <br />
                      <p>Routes will be assigned based on seniority and your preferences. You will be notified of your assignment once the selection period closes.</p>
                      <br />
                      <p>If you have any questions, please contact your supervisor.</p>
                      <br />
                      <p>Thank you,<br />Route Selection Team</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowNotifyModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    notifyDriversMutation.mutate(selectedPeriod.id);
                  }}
                  disabled={notifyDriversMutation.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {notifyDriversMutation.isPending ? 'Sending...' : 'Send Notifications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Periods;