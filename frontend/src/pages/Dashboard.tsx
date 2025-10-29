import { useQuery } from '@tanstack/react-query';
import { Users, Route, Calendar, CheckSquare, TrendingUp, AlertCircle, ArrowUp, ArrowDown, Clock, Activity, Shield } from 'lucide-react';
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

interface Activity {
  id: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
  user: string;
  userRole: string;
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

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/activity?limit=5');
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

  const statCards = user?.role === 'Driver' ? [
    {
      title: 'Available Routes',
      value: stats?.totalRoutes || 0,
      icon: Route,
      color: 'green',
      trend: 'Total',
      trendUp: true,
      visible: true,
    },
    {
      title: 'My Selection Status',
      value: stats?.completedSelections && stats.completedSelections > 0 ? 'Submitted' : 'Pending',
      icon: stats?.completedSelections && stats.completedSelections > 0 ? CheckSquare : Clock,
      color: stats?.completedSelections && stats.completedSelections > 0 ? 'purple' : 'yellow',
      isText: true,
      visible: true,
    },
  ] : [
    {
      title: 'Total Employees',
      value: stats?.totalEmployees || 0,
      icon: Users,
      color: 'primary',
      trend: '+12%',
      trendUp: true,
      visible: true,
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
            {user?.role === 'Driver' 
              ? 'Access your route selections and view available routes'
              : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
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
      {user?.role === 'Driver' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          {(card as any).isText ? card.value : card.value.toLocaleString()}
                        </p>
                        {card.trend && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{card.trend}</span>
                          </div>
                        )}
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
      ) : (
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
                          {(card as any).isText ? card.value : card.value.toLocaleString()}
                        </p>
                        {card.trend && (
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
                        )}
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
      )}

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

            {/* Progress Bar - Only show for admin */}
            {user?.role !== 'Driver' && (
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
            )}

            {/* Time remaining for drivers */}
            {user?.role === 'Driver' && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Selection Period Closing Soon</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Submit your route preferences before {new Date(stats.activePeriod.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver Quick Actions */}
      {user?.role === 'Driver' && stats?.activePeriod && (
        <div className="card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/selections"
                className="card-hover p-6 text-left group"
              >
                <div className="bg-purple-100 p-3 rounded-xl inline-flex mb-4 group-hover:scale-110 transition-transform duration-200">
                  <CheckSquare className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {stats.completedSelections > 0 ? 'View My Selections' : 'Submit Route Selection'}
                </h3>
                <p className="text-sm text-gray-600">
                  {stats.completedSelections > 0 
                    ? 'Review your submitted route preferences'
                    : 'Select your preferred routes for this period'}
                </p>
              </Link>
              <a
                href="/forgot-password"
                className="card-hover p-6 text-left group"
              >
                <div className="bg-primary-100 p-3 rounded-xl inline-flex mb-4 group-hover:scale-110 transition-transform duration-200">
                  <Shield className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Update Password</h3>
                <p className="text-sm text-gray-600">Change your account password</p>
              </a>
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
          <h2 className="text-lg font-semibold text-gray-900">
            {user?.role === 'Driver' ? 'My Recent Activity' : 'Recent Activity'}
          </h2>
        </div>
        <div className="p-6">
          {activitiesLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity) => {
                const timeAgo = getTimeAgo(new Date(activity.timestamp));
                const activityText = formatActivityText(activity);
                
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      activity.action.includes('SELECTION') ? 'bg-purple-400' :
                      activity.action.includes('ROUTE') ? 'bg-green-400' :
                      activity.action.includes('PERIOD') ? 'bg-yellow-400' :
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activityText}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{timeAgo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              {user?.role === 'Driver' ? 'No recent activity to display' : 'No activity recorded yet'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return `${interval} years ago`;
  if (interval === 1) return '1 year ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;
  if (interval === 1) return '1 month ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;
  if (interval === 1) return '1 day ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;
  if (interval === 1) return '1 hour ago';
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;
  if (interval === 1) return '1 minute ago';
  
  return 'Just now';
}

function formatActivityText(activity: Activity): string {
  switch (activity.action) {
    case 'CREATE_SELECTION':
    case 'UPDATE_SELECTION':
      return `${activity.user} submitted route selections`;
    case 'DELETE_SELECTION':
      return `${activity.user} cancelled route selections`;
    case 'CREATE_ROUTE':
      return `New route created: ${activity.details}`;
    case 'UPDATE_ROUTE':
      return `Route updated: ${activity.details}`;
    case 'SEND_PERIOD_NOTIFICATION':
      return `Notifications sent: ${activity.details}`;
    case 'PROCESS_ASSIGNMENTS':
      return `Assignments processed: ${activity.details}`;
    case 'PASSWORD_RESET_REQUEST':
      return 'Password reset requested';
    case 'PASSWORD_RESET_COMPLETE':
      return 'Password successfully reset';
    case 'LOGIN':
      return `${activity.user} logged in`;
    case 'IMPORT_DATA':
      return `Data imported: ${activity.details}`;
    case 'EXPORT_DATA':
      return `Data exported: ${activity.details}`;
    default:
      return activity.details || activity.action;
  }
}

export default Dashboard;