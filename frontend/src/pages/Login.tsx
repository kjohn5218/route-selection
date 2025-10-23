import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, Truck, Shield, Users } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-10 animate-fade-in">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-100 p-3 rounded-full">
                <Truck className="h-8 w-8 text-primary-600" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              Welcome Back
            </h2>
            <p className="mt-2 text-gray-600">
              Sign in to manage routes and selections
            </p>
          </div>

          <form className="space-y-6 animate-slide-up" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg animate-slide-down">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
              />
            </div>
            
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gray-50 text-gray-500">
                  Quick Access - Demo Accounts
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@example.com', 'password')}
                className="group relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200"
              >
                <div className="bg-primary-100 p-2 rounded-lg group-hover:bg-primary-200 transition-colors">
                  <Shield className="w-5 h-5 text-primary-700" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Administrator</p>
                  <p className="text-sm text-gray-500">Full system access</p>
                </div>
                <LogIn className="w-4 h-4 text-gray-400 ml-auto group-hover:text-primary-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials('manager@example.com', 'password')}
                className="group relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all duration-200"
              >
                <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Users className="w-5 h-5 text-green-700" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Manager</p>
                  <p className="text-sm text-gray-500">Manage routes & employees</p>
                </div>
                <LogIn className="w-4 h-4 text-gray-400 ml-auto group-hover:text-green-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => setDemoCredentials('driver@example.com', 'password')}
                className="group relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all duration-200"
              >
                <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Truck className="w-5 h-5 text-purple-700" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Driver</p>
                  <p className="text-sm text-gray-500">View & select routes</p>
                </div>
                <LogIn className="w-4 h-4 text-gray-400 ml-auto group-hover:text-purple-600 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Feature Showcase */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary-600 to-primary-800 items-center justify-center p-12">
        <div className="max-w-lg text-white animate-fade-in">
          <h1 className="text-4xl font-bold mb-6">
            Route Selection System
          </h1>
          <p className="text-lg text-primary-100 mb-8">
            Streamline your bi-annual route selection process with our comprehensive management system.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-2 rounded-lg flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Seniority-Based Selection</h3>
                <p className="text-primary-100">
                  Fair and transparent route assignment based on employee seniority
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-2 rounded-lg flex-shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Comprehensive Route Management</h3>
                <p className="text-primary-100">
                  Easily manage all routes, schedules, and special requirements
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-2 rounded-lg flex-shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Secure & Reliable</h3>
                <p className="text-primary-100">
                  Role-based access control ensures data security and integrity
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;