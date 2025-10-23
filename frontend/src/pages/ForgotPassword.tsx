import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const requestResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiClient.post('/password-reset/request', { email });
      return response.data;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      requestResetMutation.mutate(email);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full px-6">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center mb-4">Check Your Email</h1>
            <p className="text-gray-600 text-center mb-6">
              If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
            </p>
            <p className="text-sm text-gray-500 text-center mb-8">
              Please check your email and follow the instructions to reset your password. The link will expire in 1 hour.
            </p>
            <div className="space-y-4">
              <Link
                to="/login"
                className="btn-primary w-full text-center"
              >
                Back to Login
              </Link>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                className="text-sm text-primary-600 hover:text-primary-700 w-full text-center"
              >
                Didn't receive an email? Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-primary-100 p-4 rounded-full">
              <Mail className="w-12 h-12 text-primary-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">Forgot Password?</h1>
          <p className="text-gray-600 text-center mb-8">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="Enter your email"
                required
                autoFocus
              />
            </div>

            {requestResetMutation.isError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  An error occurred. Please try again later.
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={requestResetMutation.isPending}
              className="btn-primary w-full"
            >
              {requestResetMutation.isPending ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-gray-600 hover:text-primary-600 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;