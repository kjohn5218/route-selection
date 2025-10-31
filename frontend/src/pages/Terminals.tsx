import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, 
  Plus, 
  Search, 
  Edit, 
  ToggleLeft,
  ToggleRight,
  X,
  MapPin
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface Terminal {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    employees: number;
    routes: number;
    periods: number;
  };
}

interface TerminalFormData {
  code: string;
  name: string;
  isActive: boolean;
}

const Terminals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [formData, setFormData] = useState<TerminalFormData>({
    code: '',
    name: '',
    isActive: true,
  });

  // Fetch terminals
  const { data: terminals = [], isLoading, error } = useQuery<Terminal[]>({
    queryKey: ['terminals'],
    queryFn: async () => {
      const response = await apiClient.get('/terminals');
      return response.data;
    },
  });

  // Create terminal mutation
  const createTerminalMutation = useMutation({
    mutationFn: async (data: TerminalFormData) => {
      const response = await apiClient.post('/terminals', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      setShowAddModal(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to create terminal');
    },
  });

  // Update terminal mutation
  const updateTerminalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TerminalFormData> }) => {
      const response = await apiClient.put(`/terminals/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      setShowEditModal(false);
      setSelectedTerminal(null);
      resetForm();
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to update terminal');
    },
  });

  // Toggle terminal status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiClient.put(`/terminals/${id}`, { isActive });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
    },
  });

  const filteredTerminals = terminals.filter(terminal => {
    const matchesSearch = 
      terminal.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      terminal.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      isActive: true,
    });
  };

  const handleEdit = (terminal: Terminal) => {
    setSelectedTerminal(terminal);
    setFormData({
      code: terminal.code,
      name: terminal.name,
      isActive: terminal.isActive,
    });
    setShowEditModal(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createTerminalMutation.mutate(formData);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTerminal) {
      updateTerminalMutation.mutate({ id: selectedTerminal.id, data: formData });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading terminals..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Terminals</h3>
            <p className="text-red-700">Failed to load terminal data. Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const stats = {
    total: terminals.length,
    active: terminals.filter(t => t.isActive).length,
    inactive: terminals.filter(t => !t.isActive).length,
    totalUsers: terminals.reduce((sum, t) => sum + (t._count?.users || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Terminal Management</h1>
          <p className="text-gray-600">Manage terminals and locations across the system</p>
        </div>
        {user?.role === 'Admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Terminal
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search terminals by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Terminals</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-xl">
              <Building2 className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-xl">
              <ToggleRight className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
            </div>
            <div className="bg-gray-100 p-3 rounded-xl">
              <ToggleLeft className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-xl">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Terminals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTerminals.map((terminal) => (
          <div key={terminal.id} className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 p-2 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{terminal.code}</h3>
                  <p className="text-sm text-gray-500">{terminal.name}</p>
                </div>
              </div>
              <button
                onClick={() => toggleStatusMutation.mutate({ 
                  id: terminal.id, 
                  isActive: !terminal.isActive 
                })}
                className={`p-2 rounded-lg transition-colors ${
                  terminal.isActive 
                    ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                    : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                }`}
                title={terminal.isActive ? 'Active' : 'Inactive'}
              >
                {terminal.isActive ? (
                  <ToggleRight className="w-5 h-5" />
                ) : (
                  <ToggleLeft className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mb-4">
              {terminal._count && (
                <>
                  <div className="flex justify-between">
                    <span>Users:</span>
                    <span className="font-medium">{terminal._count.users}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Employees:</span>
                    <span className="font-medium">{terminal._count.employees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Routes:</span>
                    <span className="font-medium">{terminal._count.routes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Periods:</span>
                    <span className="font-medium">{terminal._count.periods}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => handleEdit(terminal)}
                className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTerminals.length === 0 && (
        <div className="card">
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No terminals found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first terminal'}
            </p>
          </div>
        </div>
      )}

      {/* Add Terminal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Add New Terminal</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="add-code">
                  Terminal Code
                </label>
                <input
                  type="text"
                  id="add-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="input-field"
                  placeholder="e.g., DEN, LAX, ORD"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="add-name">
                  Terminal Name
                </label>
                <input
                  type="text"
                  id="add-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Denver, Los Angeles, Chicago"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Terminal</span>
                </label>
              </div>
              <div className="flex gap-3 justify-end pt-4">
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
                  disabled={createTerminalMutation.isPending}
                  className="btn-primary"
                >
                  {createTerminalMutation.isPending ? 'Creating...' : 'Create Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Terminal Modal */}
      {showEditModal && selectedTerminal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit Terminal</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTerminal(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-code">
                  Terminal Code
                </label>
                <input
                  type="text"
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="input-field"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="edit-name">
                  Terminal Name
                </label>
                <input
                  type="text"
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Terminal</span>
                </label>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedTerminal(null);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTerminalMutation.isPending}
                  className="btn-primary"
                >
                  {updateTerminalMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Terminals;