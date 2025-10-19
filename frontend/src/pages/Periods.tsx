import { useState } from 'react';
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
  Activity
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
  status: 'Pending' | 'Active' | 'Completed' | 'Cancelled';
  createdAt: string;
  _count?: {
    selections: number;
  };
}

const Periods = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<SelectionPeriod | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Active' | 'Completed' | 'Cancelled'>('all');

  // Fetch periods
  const { data: periods, isLoading, error } = useQuery<SelectionPeriod[]>({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await apiClient.get('/periods');
      return response.data;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <Activity className="w-4 h-4" />;
      case 'Pending':
        return <Clock className="w-4 h-4" />;
      case 'Completed':
        return <CheckSquare className="w-4 h-4" />;
      case 'Cancelled':
        return <Pause className="w-4 h-4" />;
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
    active: periods?.filter(p => p.status === 'Active').length || 0,
    pending: periods?.filter(p => p.status === 'Pending').length || 0,
    completed: periods?.filter(p => p.status === 'Completed').length || 0,
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
            <option value="Pending">Pending</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
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
                  <Clock className="w-4 h-4" />
                  <span>Created {new Date(period.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Progress indicator for active periods */}
              {period.status === 'Active' && (
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
                  {period.status === 'Pending' && (
                    <button
                      onClick={() => handleStatusChange(period, 'Active')}
                      disabled={updateStatusMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-sm font-medium transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  )}
                  {period.status === 'Active' && (
                    <button
                      onClick={() => handleStatusChange(period, 'Completed')}
                      disabled={updateStatusMutation.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-medium transition-all"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Complete
                    </button>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => setSelectedPeriod(period)}
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                    title="Edit period"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {period.status !== 'Active' && (
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
    </div>
  );
};

export default Periods;