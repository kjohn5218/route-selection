import { useQuery } from '@tanstack/react-query';
import { Users, Route, Calendar, CheckSquare, TrendingUp, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface DashboardStats {
  totalEmployees: number;
  totalRoutes: number;
  activePeriod: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  pendingSelections: number;
  completedSelections: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/stats');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Employees',
      value: stats?.totalEmployees || 0,
      icon: Users,
      color: 'bg-blue-500',
      visible: user?.role !== 'Driver',
    },
    {
      title: 'Total Routes',
      value: stats?.totalRoutes || 0,
      icon: Route,
      color: 'bg-green-500',
      visible: true,
    },
    {
      title: 'Pending Selections',
      value: stats?.pendingSelections || 0,
      icon: Calendar,
      color: 'bg-yellow-500',
      visible: true,
    },
    {
      title: 'Completed Selections',
      value: stats?.completedSelections || 0,
      icon: CheckSquare,
      color: 'bg-purple-500',
      visible: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user?.name}! Here's an overview of the route selection system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards
          .filter(card => card.visible)
          .map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.title} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {card.value}
                    </p>
                  </div>
                  <div className={`${card.color} rounded-lg p-3`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Active Period */}
      {stats?.activePeriod && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Selection Period</h2>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Period Name</p>
              <p className="font-medium text-gray-900">{stats.activePeriod.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="font-medium text-gray-900">
                {new Date(stats.activePeriod.startDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">End Date</p>
              <p className="font-medium text-gray-900">
                {new Date(stats.activePeriod.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {user?.role !== 'Driver' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Users className="w-8 h-8 text-blue-600 mb-2" />
              <p className="font-medium text-gray-900">Add Employee</p>
              <p className="text-sm text-gray-600">Register a new driver</p>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Route className="w-8 h-8 text-green-600 mb-2" />
              <p className="font-medium text-gray-900">Create Route</p>
              <p className="text-sm text-gray-600">Add a new route</p>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Calendar className="w-8 h-8 text-yellow-600 mb-2" />
              <p className="font-medium text-gray-900">Start Period</p>
              <p className="text-sm text-gray-600">Begin selection period</p>
            </button>
            <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <CheckSquare className="w-8 h-8 text-purple-600 mb-2" />
              <p className="font-medium text-gray-900">View Selections</p>
              <p className="text-sm text-gray-600">Check current selections</p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;