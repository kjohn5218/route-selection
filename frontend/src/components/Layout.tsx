import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, 
  Users, 
  Route, 
  Calendar, 
  CheckSquare, 
  FileUp, 
  LogOut, 
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Truck,
  UserCircle
} from 'lucide-react';
import { useState } from 'react';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/employees', label: 'Employees', icon: Users, roles: ['Admin', 'Manager'] },
    { path: '/routes', label: 'Routes', icon: Route, roles: ['Admin', 'Manager'] },
    { path: '/periods', label: 'Selection Periods', icon: Calendar, roles: ['Admin', 'Manager'] },
    { path: '/selections', label: 'My Selections', icon: CheckSquare, adminLabel: 'Selection Results' },
    { path: '/import-export', label: 'Import/Export', icon: FileUp, roles: ['Admin'] },
    { path: '/users', label: 'User Management', icon: UserCircle, roles: ['Admin', 'Manager'] },
  ];

  const isActive = (path: string) => location.pathname === path;

  const canAccess = (roles?: string[]) => {
    if (!roles) return true;
    if (!user) return false;
    return user.role === 'Admin' || roles.includes(user.role);
  };

  const getPageTitle = () => {
    const currentItem = menuItems.find(item => item.path === location.pathname);
    if (currentItem && (user?.role === 'Admin' || user?.role === 'Manager') && currentItem.adminLabel) {
      return currentItem.adminLabel;
    }
    return currentItem?.label || 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          {/* Logo Section */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="CCFS Logo" className="h-12 w-auto" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Route Select</h2>
                <p className="text-xs text-gray-500">Management System</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              if (!canAccess(item.roles)) return null;
              
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    active
                      ? 'bg-primary-50 text-primary-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
                  <span>{(user?.role === 'Admin' || user?.role === 'Manager') && item.adminLabel ? item.adminLabel : item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:ml-72">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Mobile menu button & Page Title */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-xl font-semibold text-gray-900">
                  {getPageTitle()}
                </h1>
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Search (hidden on mobile) */}
                <div className="hidden sm:block relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Notifications */}
                <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* Profile dropdown - Desktop */}
                <div className="hidden sm:block relative">
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {/* Dropdown menu */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 animate-slide-down">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{user?.name}</p>
                        <p className="text-sm text-gray-500">{user?.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile logout */}
                <button
                  onClick={handleLogout}
                  className="sm:hidden p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto py-4 px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>&copy; 2024 Route Selection System. All rights reserved.</p>
        </footer>
      </div>

      {/* Close dropdown when clicking outside */}
      {profileDropdownOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setProfileDropdownOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;