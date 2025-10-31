import React, { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, FileSpreadsheet, Users, Route } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useTerminal } from '../contexts/TerminalContext';

interface ImportResult {
  preview?: boolean;
  success?: boolean;
  result: {
    success: boolean;
    data: any[];
    errors: Array<{
      row: number;
      field?: string;
      message: string;
    }>;
    summary: {
      totalRows: number;
      validRows: number;
      errorRows: number;
    };
  };
  importResults?: {
    created: number;
    updated: number;
    skipped: number;
    userAccountsCreated?: number;
    errors: string[];
  };
  filename?: string;
}

const ImportExport = () => {
  const { selectedTerminal } = useTerminal();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'routes' | 'employees'>('routes');
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [importOptions, setImportOptions] = useState({
    overwrite: false,
    createUserAccounts: true,
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiClient.post(
        `/import/${importType}/preview${selectedTerminal ? `?terminalId=${selectedTerminal.id}` : ''}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data as ImportResult;
    },
    onSuccess: (data) => {
      setPreviewResult(data);
    },
  });

  // Execute import mutation
  const executeMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiClient.post(
        `/import/${importType}/execute${selectedTerminal ? `?terminalId=${selectedTerminal.id}` : ''}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data as ImportResult;
    },
    onSuccess: () => {
      setSelectedFile(null);
      setPreviewResult(null);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewResult(null);
    }
  };

  const handlePreview = () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    previewMutation.mutate(formData);
  };

  const handleImport = () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('overwrite', String(importOptions.overwrite));
    
    if (importType === 'employees') {
      formData.append('createUserAccounts', String(importOptions.createUserAccounts));
    }

    executeMutation.mutate(formData);
  };

  const downloadTemplate = async (type: 'routes' | 'employees') => {
    try {
      const response = await apiClient.get(`/import/templates/${type}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_import_template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Template download error:', error);
    }
  };

  const downloadExport = async (type: 'routes' | 'employees') => {
    try {
      const response = await apiClient.get(`/export/${type}`, {
        params: { terminalId: selectedTerminal?.id },
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      const fileNameMatch = contentDisposition?.match(/filename="(.+)"/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `${type}_export.xlsx`;
      
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export download error:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Import & Export Data</h1>
        <p className="text-gray-600">Bulk import employees and routes, or export current data</p>
      </div>

      {/* Import/Export Type Selector */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setImportType('routes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            importType === 'routes'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Route className="w-4 h-4" />
          Routes
        </button>
        <button
          onClick={() => setImportType('employees')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            importType === 'employees'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Employees
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Import Section */}
        <div className="card">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import {importType === 'routes' ? 'Routes' : 'Employees'}
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Download Template */}
            <div>
              <p className="text-sm text-gray-600 mb-3">
                First, download the template to ensure your data is formatted correctly:
              </p>
              <button
                onClick={() => downloadTemplate(importType)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download {importType === 'routes' ? 'Route' : 'Employee'} Template
              </button>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".xlsx,.xls,.csv"
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100"
                />
              </div>
              {selectedFile && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>{selectedFile.name}</span>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewResult(null);
                    }}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Import Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={importOptions.overwrite}
                  onChange={(e) => setImportOptions(prev => ({ ...prev, overwrite: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Overwrite existing {importType === 'routes' ? 'routes' : 'employees'}
                </span>
              </label>

              {importType === 'employees' && (
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={importOptions.createUserAccounts}
                    onChange={(e) => setImportOptions(prev => ({ ...prev, createUserAccounts: e.target.checked }))}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    Automatically create user accounts (password: driver123)
                  </span>
                </label>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={!selectedFile || previewMutation.isPending}
                className="btn-secondary"
              >
                {previewMutation.isPending ? 'Validating...' : 'Preview Import'}
              </button>

              {previewResult?.result.success && (
                <button
                  onClick={handleImport}
                  disabled={executeMutation.isPending}
                  className="btn-primary"
                >
                  {executeMutation.isPending ? 'Importing...' : 'Execute Import'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Export Section */}
        <div className="card">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Data
            </h2>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Download current data in Excel format for backup or external processing.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => downloadExport('routes')}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Route className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Export Routes</p>
                    <p className="text-sm text-gray-600">Download all routes as Excel file</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => downloadExport('employees')}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900">Export Employees</p>
                    <p className="text-sm text-gray-600">Download all employees as Excel file</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Results */}
      {previewResult && (
        <div className="card">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Import Preview</h3>
          </div>
          
          <div className="p-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total Rows</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {previewResult.result.summary.totalRows}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600">Valid Rows</p>
                <p className="text-2xl font-semibold text-green-900">
                  {previewResult.result.summary.validRows}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600">Error Rows</p>
                <p className="text-2xl font-semibold text-red-900">
                  {previewResult.result.summary.errorRows}
                </p>
              </div>
            </div>

            {/* Errors */}
            {previewResult.result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Validation Errors
                </h4>
                <div className="space-y-1 text-sm text-red-700">
                  {previewResult.result.errors.slice(0, 10).map((error, index) => (
                    <div key={index}>
                      Row {error.row}: {error.field && `${error.field} - `}{error.message}
                    </div>
                  ))}
                  {previewResult.result.errors.length > 10 && (
                    <div className="text-red-600 font-medium mt-2">
                      ... and {previewResult.result.errors.length - 10} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success Message */}
            {previewResult.result.success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Validation Successful</p>
                    <p className="text-sm text-green-700 mt-1">
                      All {previewResult.result.summary.validRows} rows are valid and ready for import.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Results */}
      {executeMutation.isSuccess && executeMutation.data && (
        <div className="card">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Import Results</h3>
          </div>
          
          <div className="p-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Import Completed</p>
                  <div className="text-sm text-green-700 mt-1 space-y-1">
                    {executeMutation.data.importResults?.created > 0 && (
                      <p>Created: {executeMutation.data.importResults.created} new records</p>
                    )}
                    {executeMutation.data.importResults?.updated > 0 && (
                      <p>Updated: {executeMutation.data.importResults.updated} existing records</p>
                    )}
                    {executeMutation.data.importResults?.skipped > 0 && (
                      <p>Skipped: {executeMutation.data.importResults.skipped} records</p>
                    )}
                    {importType === 'employees' && executeMutation.data.importResults?.userAccountsCreated > 0 && (
                      <p>User accounts created: {executeMutation.data.importResults.userAccountsCreated}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {executeMutation.data.importResults?.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Import Warnings</h4>
                <div className="space-y-1 text-sm text-yellow-700">
                  {executeMutation.data.importResults.errors.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Errors */}
      {(previewMutation.error || executeMutation.error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">
              {(previewMutation.error as any)?.response?.data?.error || 
               (executeMutation.error as any)?.response?.data?.error || 
               'An error occurred while processing the file'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExport;