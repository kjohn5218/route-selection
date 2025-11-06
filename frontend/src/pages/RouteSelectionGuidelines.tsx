import { FileText, Clock, CheckCircle, AlertCircle, Calendar, Route, HelpCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const RouteSelectionGuidelines = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Section with CCFS branding */}
      <div className="card bg-gradient-to-r from-red-600 to-red-700 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">Bi-Annual Route Selection Process</h1>
              <p className="text-red-100 mt-2">
                CCFS LTL • Logistics - Route Selection Guidelines
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-red-100">Rev 11.6.25</p>
          </div>
        </div>
      </div>

      {/* Timing Section */}
      <div className="card">
        <h2 className="text-2xl font-semibold mb-4 flex items-center">
          <Calendar className="w-6 h-6 mr-2 text-red-600" />
          Timing
        </h2>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-gray-800">
            <span className="font-semibold">Conduct twice yearly (February and August)</span> to align with seasonal freight patterns and allow for life changes.
          </p>
        </div>
      </div>

      {/* Process Overview */}
      <div className="card">
        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <Route className="w-6 h-6 mr-2 text-green-600" />
          Process Overview
        </h2>
        
        {/* Phase 1 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
              1
            </div>
            Phase 1: Route Posting (Week 1)
          </h3>
          <ul className="space-y-3 ml-11">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Post all available routes with detailed information: routes, typical mileage, home time schedules, endorsement and equipment requirements, and average weekly earnings</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Include any new routes or modified existing routes</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Allow 5 business days for drivers to review options (employees on vacation need to be contacted. If contact is not possible, process would be extended until their return)</span>
            </li>
          </ul>
        </div>

        {/* Phase 2 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
              2
            </div>
            Phase 2: Selection Submission
          </h3>
          <ul className="space-y-3 ml-11">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Drivers submit ranked preferences (top 3 choices) in writing (Probably electronic)</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Require current drivers to participate even if they want to keep existing routes</span>
            </li>
          </ul>
        </div>

        {/* Phase 3 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
              3
            </div>
            Phase 3: Route Assignment (Week 2)
          </h3>
          <ul className="space-y-3 ml-11">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Award routes strictly by company seniority date and qualifications</span>
            </li>
            <li className="ml-8 space-y-2">
              <div className="flex items-center">
                <span className="w-4 h-4 rounded-full bg-gray-400 mr-3"></span>
                <span>Doubles endorsement</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 rounded-full bg-gray-400 mr-3"></span>
                <span>6 months chain experience</span>
              </div>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Start with most senior driver's first choice, work down the list</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Each driver gets their highest available preference when their turn comes</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Notify all drivers of assignments within 5 business days of completion</span>
            </li>
          </ul>
        </div>

        {/* Phase 4 */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <div className="bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm font-bold">
              4
            </div>
            Phase 4: Implementation (Week 3)
          </h3>
          <ul className="space-y-3 ml-11">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Pair switching drivers for knowledge transfer</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Update all systems and dispatch protocols</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Key Rules */}
      <div className="card">
        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <AlertCircle className="w-6 h-6 mr-2 text-amber-600" />
          Key Rules
        </h2>
        <div className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 mr-3 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-800">
                Drivers with any preventable accidents within the past 6 months will forfeit their seniority credit and will be placed at the bottom of the seniority list.
              </p>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 mr-3 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-800">
                Once awarded, drivers commit to route for full 6-month period except for emergencies
              </p>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 mr-3 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-800">
                Drivers who change request to move off a run prior to the next selection process will drop to the bottom of the float pool and will be eligible to reselect at the next open selection period.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 mr-3 text-gray-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-800">
                At the discretion of operations and human resources, drivers who cannot meet operational needs on their run may be removed from their run and move to the float pool until the next selection process opens.
              </p>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 mr-3 text-orange-600 mt-0.5 flex-shrink-0" />
              <p className="text-gray-800">
                Drivers who experience a preventable accident may be placed on the float pool until they are again eligible to reselect (no preventable accidents within 6 months).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Off cycle route selection process triggers */}
      <div className="card">
        <h2 className="text-2xl font-semibold mb-6 flex items-center">
          <RefreshCw className="w-6 h-6 mr-2 text-purple-600" />
          Off Cycle Route Selection Process Triggers
        </h2>
        <p className="text-gray-700 mb-4">
          Circumstances which could trigger a supplement route selection process include:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center mb-2">
              <Route className="w-5 h-5 mr-2 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Route Changes</h4>
            </div>
            <p className="text-sm text-gray-700">Adding or removing new routes</p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center mb-2">
              <Clock className="w-5 h-5 mr-2 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Departure Changes</h4>
            </div>
            <p className="text-sm text-gray-700">Routes with departure changes of +/- 8 hours</p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 mr-2 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Driver Pool Decline</h4>
            </div>
            <p className="text-sm text-gray-700">If the driver pool declines by 10% or more</p>
          </div>
        </div>
      </div>

      {/* Timeline Summary */}
      <div className="card bg-gray-50">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Clock className="w-6 h-6 mr-2 text-blue-600" />
          Process Timeline Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-red-600 mb-2">Week 1</h3>
            <p className="text-sm text-gray-600">Route posting and review period</p>
            <p className="text-xs text-gray-500 mt-1">5 business days for driver review</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-red-600 mb-2">Week 2</h3>
            <p className="text-sm text-gray-600">Selection submission and route assignment</p>
            <p className="text-xs text-gray-500 mt-1">Processing and notification within 5 business days</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-red-600 mb-2">Week 3</h3>
            <p className="text-sm text-gray-600">Implementation and knowledge transfer</p>
            <p className="text-xs text-gray-500 mt-1">System updates and driver pairing</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteSelectionGuidelines;