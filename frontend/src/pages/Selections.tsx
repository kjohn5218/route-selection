import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Users, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTerminal } from '../contexts/TerminalContext';

interface SelectionPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  requiredSelections: number;
}

const Selections = () => {
  const { user } = useAuth();
  const { selectedTerminal } = useTerminal();
  const [searchTerm, setSearchTerm] = useState('');

  // Get all selection periods
  const { data: periods = [], isLoading } = useQuery<SelectionPeriod[]>({
    queryKey: ['selection-periods', selectedTerminal?.id],
    queryFn: async () => {
      if (!selectedTerminal) return [];
      const response = await apiClient.get('/periods', {
        params: { terminalId: selectedTerminal.id }
      });
      return response.data;
    },
    enabled: !!selectedTerminal,
  });

  // Filter periods based on search
  const filteredPeriods = periods.filter(period =>
    period.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UPCOMING':
        return 'bg-gray-100 text-gray-800';
      case 'OPEN':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'UPCOMING':
        return Clock;
      case 'OPEN':
        return Calendar;
      case 'COMPLETED':
        return CheckCircle;
      default:
        return Clock;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Selection Periods</h1>
        <p className="text-gray-600">
          View and manage route selection periods for {selectedTerminal?.name || 'your terminal'}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search periods..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Periods List */}
      <div className="grid gap-4">
        {filteredPeriods.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No selection periods found</p>
          </div>
        ) : (
          filteredPeriods.map(period => {
            const StatusIcon = getStatusIcon(period.status);
            const startDate = new Date(period.startDate);
            const endDate = new Date(period.endDate);
            const now = new Date();
            const isActive = now >= startDate && now <= endDate;
            
            return (
              <div 
                key={period.id} 
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {period.name}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(period.status)}`}>
                          {period.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <StatusIcon className="w-4 h-4" />
                          <span>
                            {period.status === 'OPEN' && isActive ? 'Currently Active' :
                             period.status === 'UPCOMING' ? 'Starts Soon' :
                             period.status === 'COMPLETED' ? 'Completed' :
                             'Status: ' + period.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>
                            {period.requiredSelections} selection{period.requiredSelections !== 1 ? 's' : ''} required
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Link
                      to={`/periods/${period.id}/manage`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Manage Period
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin Note */}
      {user?.role === 'Admin' && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Admin Note:</strong> Click "Manage Period" to view submissions, process assignments, and send notifications.
          </p>
        </div>
      )}
    </div>
  );
};

export default Selections;