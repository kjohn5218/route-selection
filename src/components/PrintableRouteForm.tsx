import React from 'react'
import { format } from 'date-fns'
import type { Route, SelectionPeriod, Terminal } from '@prisma/client'

interface PrintableRouteFormProps {
  routes: (Route & { terminal: Terminal })[]
  selectionPeriod: SelectionPeriod
  terminal: Terminal
}

export function PrintableRouteForm({ routes, selectionPeriod, terminal }: PrintableRouteFormProps) {
  const sortedRoutes = routes
    .filter(route => route.isActive)
    .sort((a, b) => a.runNumber.localeCompare(b.runNumber))

  return (
    <div className="printable-form bg-white text-black p-8 max-w-4xl mx-auto">
      <style jsx>{`
        @media print {
          .printable-form {
            max-width: 100%;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none;
          }
          .page-break {
            page-break-before: always;
          }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-8 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold mb-2">ROUTE SELECTION FORM</h1>
        <h2 className="text-xl">{terminal.name}</h2>
        <p className="mt-2">
          Selection Period: {format(new Date(selectionPeriod.startDate), 'MM/dd/yyyy')} - {format(new Date(selectionPeriod.endDate), 'MM/dd/yyyy')}
        </p>
      </div>

      {/* Instructions */}
      <div className="mb-8 border border-gray-400 p-4">
        <h3 className="font-bold text-lg mb-2">INSTRUCTIONS:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Review all available routes listed below</li>
          <li>Select up to {selectionPeriod.requiredSelections} routes in order of preference</li>
          <li>Write your selections in the "Driver Selection" section at the bottom</li>
          <li>Ensure your employee information is complete and accurate</li>
          <li>Sign and date the form</li>
          <li>Submit this form to your manager or administrator by the deadline</li>
        </ol>
      </div>

      {/* Routes Table */}
      <div className="mb-8">
        <h3 className="font-bold text-lg mb-4">AVAILABLE ROUTES:</h3>
        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-left">Run #</th>
              <th className="border border-black p-2 text-left">Type</th>
              <th className="border border-black p-2 text-left">Origin</th>
              <th className="border border-black p-2 text-left">Destination</th>
              <th className="border border-black p-2 text-left">Days</th>
              <th className="border border-black p-2 text-left">Time</th>
              <th className="border border-black p-2 text-left">Miles</th>
              <th className="border border-black p-2 text-left">Rate</th>
              <th className="border border-black p-2 text-left">Requirements</th>
            </tr>
          </thead>
          <tbody>
            {sortedRoutes.map((route) => (
              <tr key={route.id}>
                <td className="border border-black p-2">{route.runNumber}</td>
                <td className="border border-black p-2">{route.type}</td>
                <td className="border border-black p-2">{route.origin}</td>
                <td className="border border-black p-2">{route.destination}</td>
                <td className="border border-black p-2">{route.days}</td>
                <td className="border border-black p-2">
                  {format(new Date(`2000-01-01T${route.startTime}`), 'h:mm a')} - 
                  {format(new Date(`2000-01-01T${route.endTime}`), 'h:mm a')}
                </td>
                <td className="border border-black p-2">{route.distance}</td>
                <td className="border border-black p-2">
                  {route.rateType === 'HOURLY' && `$${route.hourlyRate}/hr`}
                  {route.rateType === 'MILEAGE' && `$${route.mileageRate}/mi`}
                  {route.rateType === 'FLAT_RATE' && `$${route.flatRate}`}
                </td>
                <td className="border border-black p-2 text-xs">
                  {route.requiresDoublesEndorsement && 'Doubles'}
                  {route.requiresDoublesEndorsement && route.requiresChainExperience && ', '}
                  {route.requiresChainExperience && 'Chains'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Driver Selection Section */}
      <div className="page-break">
        <h3 className="font-bold text-lg mb-4">DRIVER SELECTION:</h3>
        
        {/* Driver Information */}
        <div className="border border-black p-4 mb-4">
          <h4 className="font-bold mb-3">Driver Information:</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">
                Full Name: <span className="inline-block border-b border-black w-64 ml-2"></span>
              </label>
            </div>
            <div>
              <label className="block mb-2">
                Employee Number: <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
            <div>
              <label className="block mb-2">
                Email: <span className="inline-block border-b border-black w-64 ml-2"></span>
              </label>
            </div>
            <div>
              <label className="block mb-2">
                Phone: <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Route Selections */}
        <div className="border border-black p-4 mb-4">
          <h4 className="font-bold mb-3">Route Selections (in order of preference):</h4>
          {Array.from({ length: selectionPeriod.requiredSelections }, (_, i) => (
            <div key={i} className="mb-3">
              <label className="block">
                {i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'} Choice - Run Number: 
                <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
          ))}
        </div>

        {/* Signature Section */}
        <div className="border border-black p-4">
          <h4 className="font-bold mb-3">Driver Declaration:</h4>
          <p className="text-sm mb-4">
            I certify that the route selections above are my preferred choices and that all information 
            provided is accurate. I understand that routes will be assigned based on seniority and availability.
          </p>
          <div className="grid grid-cols-2 gap-8 mt-8">
            <div>
              <label className="block">
                Driver Signature: <span className="inline-block border-b border-black w-64 ml-2"></span>
              </label>
            </div>
            <div>
              <label className="block">
                Date: <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Office Use Only */}
        <div className="border border-black p-4 mt-4 bg-gray-100">
          <h4 className="font-bold mb-3">FOR OFFICE USE ONLY:</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">
                Received By: <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
            <div>
              <label className="block mb-2">
                Date Received: <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
            <div>
              <label className="block mb-2">
                Entered By: <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
            <div>
              <label className="block mb-2">
                Date Entered: <span className="inline-block border-b border-black w-48 ml-2"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}