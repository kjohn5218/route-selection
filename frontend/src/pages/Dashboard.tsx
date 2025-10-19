import { useQuery } from '@tanstack/react-query';
import { Users, Route, Calendar, CheckSquare, TrendingUp, AlertCircle, ArrowUp, ArrowDown, Clock, Activity } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Dashboard</h3>
            <p className="text-red-700">Failed to load dashboard data. Please try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Employees',
      value: stats?.totalEmployees || 0,
      icon: Users,
      color: 'primary',
      trend: '+12%',
      trendUp: true,
      visible: user?.role !== 'Driver',
    },
    {
      title: 'Total Routes',
      value: stats?.totalRoutes || 0,
      icon: Route,
      color: 'green',
      trend: '+5%',
      trendUp: true,
      visible: true,
    },
    {
      title: 'Pending Selections',
      value: stats?.pendingSelections || 0,
      icon: Clock,
      color: 'yellow',
      trend: '8',
      trendUp: false,
      visible: true,
    },
    {
      title: 'Completed Selections',
      value: stats?.completedSelections || 0,
      icon: CheckSquare,
      color: 'purple',
      trend: '+23%',
      trendUp: true,
      visible: true,
    },
  ];

  const colorClasses = {
    primary: {
      bg: 'bg-primary-50',
      icon: 'bg-primary-100',
      iconText: 'text-primary-600',
      trend: 'text-primary-600',
      trendBg: 'bg-primary-100'
    },
    green: {
      bg: 'bg-green-50',
      icon: 'bg-green-100',
      iconText: 'text-green-600',
      trend: 'text-green-600',
      trendBg: 'bg-green-100'
    },
    yellow: {
      bg: 'bg-yellow-50',
      icon: 'bg-yellow-100',
      iconText: 'text-yellow-600',
      trend: 'text-yellow-600',
      trendBg: 'bg-yellow-100'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'bg-purple-100',
      iconText: 'text-purple-600',
      trend: 'text-purple-600',
      trendBg: 'bg-purple-100'
    },
  };

  const quickActions = [
    {
      title: 'Add Employee',
      description: 'Register a new driver in the system',
      icon: Users,
      href: '/employees',
      color: 'primary'
    },
    {
      title: 'Create Route',
      description: 'Add a new route to the catalog',
      icon: Route,
      href: '/routes',
      color: 'green'
    },
    {
      title: 'Start Period',
      description: 'Begin a new selection period',
      icon: Calendar,
      href: '/periods',
      color: 'yellow'
    },
    {
      title: 'View Selections',
      description: 'Review current route selections',
      icon: CheckSquare,
      href: '/selections',
      color: 'purple'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 text-white">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-primary-100 text-lg">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {stats?.activePeriod && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">
                Active Period: {stats.activePeriod.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards
          .filter(card => card.visible)
          .map((card) => {
            const Icon = card.icon;
            const colors = colorClasses[card.color as keyof typeof colorClasses];
            
            return (
              <div
                key={card.title}
                className="card hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {card.value.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${colors.trendBg} ${colors.trend}`}>
                          {card.trendUp ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          )}
                          {card.trend}
                        </span>
                        <span className="text-xs text-gray-500">vs last period</span>
                      </div>
                    </div>
                    <div className={`${colors.icon} p-3 rounded-xl`}>
                      <Icon className={`w-6 h-6 ${colors.iconText}`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Active Period Details */}
      {stats?.activePeriod && (
        <div className="card">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Current Selection Period
                </h2>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Period Name</p>
                <p className="font-semibold text-gray-900">{stats.activePeriod.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Start Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(stats.activePeriod.startDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">End Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(stats.activePeriod.endDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Selection Progress</span>
                <span className="text-sm text-gray-600">
                  {stats.completedSelections} of {stats.completedSelections + stats.pendingSelections} completed
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(stats.completedSelections / (stats.completedSelections + stats.pendingSelections)) * 100}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {user?.role !== 'Driver' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const colors = colorClasses[action.color as keyof typeof colorClasses];
              
              return (
                <Link
                  key={action.title}
                  to={action.href}
                  className="card-hover p-6 text-left group"
                >
                  <div className={`${colors.icon} p-3 rounded-xl inline-flex mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`w-6 h-6 ${colors.iconText}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[
              { time: '2 hours ago', action: 'John Doe selected Route #45', type: 'selection' },
              { time: '3 hours ago', action: 'New route "Downtown Express" added', type: 'route' },
              { time: '5 hours ago', action: 'Selection period "Spring 2024" activated', type: 'period' },
              { time: '1 day ago', action: 'Mary Smith completed profile update', type: 'user' },
            ].map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;