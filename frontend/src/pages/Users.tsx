import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X,
  Shield,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  managedTerminals?: {
    terminal: {
      id: string;
      code: string;
      name: string;
    };
  }[];
}

interface Terminal {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addUserRole, setAddUserRole] = useState('DRIVER');
  const [editUserRole, setEditUserRole] = useState('DRIVER');
  const [editUserIsActive, setEditUserIsActive] = useState(true);

  // Fetch users
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get('/users');
      return response.data;
    },
  });

  // Fetch all terminals (for admin to assign to managers)
  const { data: terminals = [] } = useQuery<Terminal[]>({
    queryKey: ['terminals'],
    queryFn: async () => {
      const response = await apiClient.get('/terminals?isActive=true');
      return response.data;
    },
    enabled: currentUser?.role === 'ADMIN',
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/users', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddModal(false);
    },
    onError: (error: any) => {
      console.error('Failed to create user:', error);
      alert(error.response?.data?.error || 'Failed to create user');
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await apiClient.put(`/users/${id}`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      
      // Show alert if user activation status changed and had an associated employee
      if (selectedUser?.employee && selectedUser.isActive !== variables.isActive) {
        if (variables.isActive) {
          alert(`User account activated. The associated employee ${selectedUser.employee.firstName} ${selectedUser.employee.lastName} is now visible in the Employee Management page.`);
        } else {
          alert(`User account deactivated. The associated employee ${selectedUser.employee.firstName} ${selectedUser.employee.lastName} has been hidden from the Employee Management page.`);
        }
      }
      
      setShowEditModal(false);
      setSelectedUser(null);
      setEditUserIsActive(true);
    },
    onError: (error: any) => {
      console.error('Failed to update user:', error);
      alert(error.response?.data?.error || 'Failed to update user');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowDeleteModal(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      console.error('Failed to delete user:', error);
      alert(error.response?.data?.error || 'Failed to delete user');
    },
  });

  const filteredUsers = users?.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.employee?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.employee?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <ShieldCheck className="w-4 h-4" />;
      case 'MANAGER':
        return <Shield className="w-4 h-4" />;
      default:
        return <UserCheck className="w-4 h-4" />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditUserRole(user.role);
    setEditUserIsActive(user.isActive);
    setShowEditModal(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading users..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Users</h3>
            <p className="text-red-700">Failed to load user data. Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage system users and access levels</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="card p-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">User</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Email</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Role</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Created</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {user.employee ? 
                          `${user.employee.firstName.charAt(0)}${user.employee.lastName.charAt(0)}` :
                          user.email.charAt(0).toUpperCase()
                        }
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.name || (user.employee ? 
                            `${user.employee.firstName} ${user.employee.lastName}` :
                            'No Name Set'
                          )}
                        </p>
                        {user.employee && (
                          <p className="text-sm text-gray-500">ID: {user.employee.employeeId}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-700">{user.email}</td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                      {user.role === 'MANAGER' && user.managedTerminals && user.managedTerminals.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Terminals: {user.managedTerminals.map(mt => mt.terminal.code).join(', ')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                        title="Edit user"
                        disabled={user.id === currentUser?.id}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete user"
                        disabled={user.id === currentUser?.id || user.employee !== undefined}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first user'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete User</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete user <strong>{selectedUser.email}</strong>? 
              This action cannot be undone.
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
                disabled={deleteUserMutation.isPending}
                className="btn-danger"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Add New User</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddUserRole('DRIVER');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const role = formData.get('role') as string;
                const selectedTerminalIds = role === 'MANAGER' 
                  ? Array.from(formData.getAll('terminalIds')) as string[]
                  : [];
                createUserMutation.mutate({
                  email: formData.get('email') as string,
                  password: formData.get('password') as string,
                  name: formData.get('name') as string || undefined,
                  role,
                  isActive: formData.get('isActive') === 'on',
                  terminalIds: selectedTerminalIds,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="label" htmlFor="add-name">User Name</label>
                <input
                  type="text"
                  id="add-name"
                  name="name"
                  className="input-field"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label" htmlFor="add-email">Email</label>
                <input
                  type="email"
                  id="add-email"
                  name="email"
                  className="input-field"
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="add-password">Password</label>
                <input
                  type="password"
                  id="add-password"
                  name="password"
                  className="input-field"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="add-role">Role</label>
                <select
                  id="add-role"
                  name="role"
                  className="input-field"
                  required
                  value={addUserRole}
                  onChange={(e) => setAddUserRole(e.target.value)}
                >
                  <option value="DRIVER">Driver</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>
              {addUserRole === 'MANAGER' && currentUser?.role === 'ADMIN' && (
                <div>
                  <label className="label">Assigned Terminals</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {terminals.map(terminal => (
                      <label key={terminal.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          name="terminalIds"
                          value={terminal.id}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{terminal.code} - {terminal.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Select terminals this manager can access</p>
                </div>
              )}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Account Active</span>
                </label>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddUserRole('DRIVER');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="btn-primary"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditUserRole('DRIVER');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const role = formData.get('role') as string;
                const selectedTerminalIds = role === 'MANAGER' 
                  ? Array.from(formData.getAll('terminalIds')) as string[]
                  : [];
                const updateData: any = {
                  id: selectedUser.id,
                  email: formData.get('email') as string,
                  name: formData.get('name') as string || undefined,
                  role,
                  isActive: editUserIsActive,
                  terminalIds: selectedTerminalIds,
                };
                
                const password = formData.get('password') as string;
                if (password) {
                  updateData.password = password;
                }
                
                updateUserMutation.mutate(updateData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="label" htmlFor="edit-name">User Name</label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  defaultValue={selectedUser.name || ''}
                  className="input-field"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-email">Email</label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  defaultValue={selectedUser.email}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-password">New Password (optional)</label>
                <input
                  type="password"
                  id="edit-password"
                  name="password"
                  className="input-field"
                  placeholder="Leave blank to keep current password"
                  minLength={6}
                />
              </div>
              <div>
                <label className="label" htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  name="role"
                  defaultValue={selectedUser.role}
                  className="input-field"
                  required
                  disabled={selectedUser.id === currentUser?.id}
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value)}
                >
                  <option value="DRIVER">Driver</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </div>
              {editUserRole === 'MANAGER' && currentUser?.role === 'ADMIN' && selectedUser.id !== currentUser?.id && (
                <div>
                  <label className="label">Assigned Terminals</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {terminals.map(terminal => (
                      <label key={terminal.id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          name="terminalIds"
                          value={terminal.id}
                          defaultChecked={selectedUser.managedTerminals?.some(mt => mt.terminal.id === terminal.id)}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{terminal.code} - {terminal.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Select terminals this manager can access</p>
                </div>
              )}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={editUserIsActive}
                    onChange={(e) => setEditUserIsActive(e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    disabled={selectedUser.id === currentUser?.id}
                  />
                  <span className="text-sm font-medium text-gray-700">Account Active</span>
                </label>
                {selectedUser.employee && selectedUser.isActive && !editUserIsActive && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Warning:</strong> Deactivating this user account will hide the associated employee ({selectedUser.employee.firstName} {selectedUser.employee.lastName}) from the Employee Management page.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditUserRole('DRIVER');
                    setEditUserIsActive(true);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="btn-primary"
                >
                  {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;