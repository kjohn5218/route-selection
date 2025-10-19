import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye,
  Mail,
  Phone,
  Calendar,
  Award,
  Truck
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  hireDate: string;
  doublesEndorsement: boolean;
  chainExperience: boolean;
  user?: {
    id: string;
    role: string;
  };
}

const Employees = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch employees
  const { data: employees, isLoading, error } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await apiClient.get('/employees');
      return response.data;
    },
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      await apiClient.delete(`/employees/${employeeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    },
  });

  const filteredEmployees = employees?.filter(employee =>
    `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleDelete = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedEmployee) {
      deleteEmployeeMutation.mutate(selectedEmployee.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading employees..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Employees</h3>
            <p className="text-red-700">Failed to load employee data. Please try refreshing the page.</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-gray-600">Manage driver records and information</p>
        </div>
        {user?.role !== 'Driver' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Employee
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
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <button className="btn-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Employee Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{employees?.length || 0}</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-xl">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Doubles Endorsed</p>
              <p className="text-2xl font-bold text-gray-900">
                {employees?.filter(e => e.doublesEndorsement).length || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-xl">
              <Award className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chain Experience</p>
              <p className="text-2xl font-bold text-gray-900">
                {employees?.filter(e => e.chainExperience).length || 0}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-xl">
              <Truck className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {employees?.filter(e => e.user).length || 0}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-xl">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Employee</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">ID</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Contact</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Hire Date</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Qualifications</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                {user?.role !== 'Driver' && (
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {employee.employeeId}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-3 h-3" />
                        {employee.email}
                      </div>
                      {employee.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-3 h-3" />
                          {employee.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {new Date(employee.hireDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-wrap gap-1">
                      {employee.doublesEndorsement && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Doubles
                        </span>
                      )}
                      {employee.chainExperience && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Chains
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {employee.user ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  {user?.role !== 'Driver' && (
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                          title="Edit employee"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first employee'}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Employee</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedEmployee.firstName} {selectedEmployee.lastName}? 
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
                disabled={deleteEmployeeMutation.isPending}
                className="btn-danger"
              >
                {deleteEmployeeMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;