import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { z } from 'zod';

// Define schemas for import validation
const routeImportSchema = z.object({
  runNumber: z.string(),
  type: z.enum(['SINGLES', 'DOUBLES', 'Singles', 'Doubles', 'LOCAL', 'REGIONAL', 'LONG_HAUL', 'DEDICATED']).transform(val => {
    // Normalize the type values
    if (val === 'Doubles' || val === 'DOUBLES') return 'DOUBLES';
    // All other types become SINGLES
    return 'SINGLES';
  }),
  origin: z.string(),
  destination: z.string(),
  days: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  distance: z.number(),
  rateType: z.enum(['HOURLY', 'MILEAGE', 'FLAT_RATE', 'SALARY', 'Miles', 'Flat Rate']).transform(val => {
    // Normalize the rate type values
    if (val === 'Miles') return 'MILEAGE';
    if (val === 'Flat Rate' || val === 'SALARY') return 'FLAT_RATE';
    return val;
  }),
  workTime: z.number(),
  requiresDoublesEndorsement: z.boolean().default(false),
  requiresChainExperience: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const employeeImportSchema = z.object({
  employeeId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  hireDate: z.string().transform(str => {
    // Handle MM/DD/YYYY format
    if (str.includes('/')) {
      const [month, day, year] = str.split('/');
      return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    }
    // Handle standard formats
    return new Date(str);
  }),
  doublesEndorsement: z.boolean().default(false),
  chainExperience: z.boolean().default(false),
  isEligible: z.boolean().default(true),
  terminal: z.string(),
});

export interface ImportResult<T> {
  success: boolean;
  data: T[];
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
}

export class FileProcessor {
  static parseExcel(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      raw: false, // Don't use raw values
      dateNF: 'mm/dd/yyyy', // Date format
    });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert sheet to JSON with string values
    return XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Format values as strings
      dateNF: 'mm/dd/yyyy',
    });
  }

  static parseCSV(content: string): any[] {
    const result = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (result.errors.length > 0) {
      throw new Error(`CSV parsing error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  static validateRoutes(rawData: any[]): ImportResult<any> {
    const errors: Array<{ row: number; field?: string; message: string }> = [];
    const validData: any[] = [];

    // If no data, return early
    if (!rawData || rawData.length === 0) {
      errors.push({
        row: 0,
        message: 'No data found in file',
      });
      return {
        success: false,
        data: validData,
        errors,
        summary: {
          totalRows: 0,
          validRows: 0,
          errorRows: 1,
        },
      };
    }

    // Log headers to debug
    console.log('CSV Headers:', Object.keys(rawData[0]));
    console.log('First row raw data:', rawData[0]);

    rawData.forEach((row, index) => {
      try {
        // Map common header variations
        const normalizedRow: any = {};
        
        // Map headers (case-insensitive)
        Object.keys(row).forEach(key => {
          const lowerKey = key.toLowerCase().trim();
          const value = row[key];
          
          // Map variations to standard field names
          switch(lowerKey) {
            case 'run #':
            case 'run#':
            case 'runnumber':
            case 'run_number':
              normalizedRow.runNumber = value;
              break;
            case 'run type':
            case 'runtype':
            case 'type':
              normalizedRow.type = value;
              break;
            case 'orig':
            case 'origin':
              normalizedRow.origin = value;
              break;
            case 'dest':
            case 'destination':
              normalizedRow.destination = value;
              break;
            case 'days':
              normalizedRow.days = value;
              break;
            case 'start':
            case 'starttime':
            case 'start_time':
              normalizedRow.startTime = value;
              break;
            case 'end':
            case 'endtime':
            case 'end_time':
              normalizedRow.endTime = value;
              break;
            case 'distance':
              normalizedRow.distance = value;
              break;
            case 'rate type':
            case 'ratetype':
            case 'rate_type':
              normalizedRow.rateType = value;
              break;
            case 'estimated work time':
            case 'worktime':
            case 'work_time':
              normalizedRow.workTime = value;
              break;
            case 'doubles':
            case 'doublesendorsement':
            case 'requiresdoublesendorsement':
              normalizedRow.requiresDoublesEndorsement = value;
              break;
            case 'chains':
            case 'chainexperience':
            case 'requireschainexperience':
              normalizedRow.requiresChainExperience = value;
              break;
            case 'active':
            case 'isactive':
              normalizedRow.isActive = value;
              break;
            default:
              // Keep any other fields as-is
              normalizedRow[key] = value;
          }
        });

        console.log(`Row ${index + 1} normalized:`, normalizedRow);

        // Convert string values to appropriate types
        const processedRow = {
          runNumber: String(normalizedRow.runNumber || ''),
          type: String(normalizedRow.type || ''),
          origin: String(normalizedRow.origin || ''),
          destination: String(normalizedRow.destination || ''),
          days: String(normalizedRow.days || ''),
          startTime: this.convertTo24Hour(String(normalizedRow.startTime || '')),
          endTime: this.convertTo24Hour(String(normalizedRow.endTime || '')),
          distance: normalizedRow.distance !== undefined && normalizedRow.distance !== '' 
            ? this.parseNumber(normalizedRow.distance, `Row ${index + 1}: distance`) 
            : 0,
          workTime: normalizedRow.workTime !== undefined && normalizedRow.workTime !== '' 
            ? this.parseNumber(normalizedRow.workTime, `Row ${index + 1}: workTime`) 
            : 8, // Default to 8 hours
          rateType: String(normalizedRow.rateType || 'HOURLY'),
          requiresDoublesEndorsement: normalizedRow.requiresDoublesEndorsement !== undefined 
            ? this.parseBoolean(normalizedRow.requiresDoublesEndorsement) 
            : false,
          requiresChainExperience: normalizedRow.requiresChainExperience !== undefined 
            ? this.parseBoolean(normalizedRow.requiresChainExperience) 
            : false,
          isActive: normalizedRow.isActive !== undefined 
            ? this.parseBoolean(normalizedRow.isActive) 
            : true,
        };

        const validatedRow = routeImportSchema.parse(processedRow);
        
        // Automatically set requiresDoublesEndorsement for Doubles routes
        if (validatedRow.type === 'DOUBLES') {
          validatedRow.requiresDoublesEndorsement = true;
        }
        
        validData.push(validatedRow);
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach(err => {
            errors.push({
              row: index + 1,
              field: err.path.join('.'),
              message: err.message,
            });
          });
        } else {
          errors.push({
            row: index + 1,
            message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    });

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      summary: {
        totalRows: rawData.length,
        validRows: validData.length,
        errorRows: errors.length,
      },
    };
  }

  static validateEmployees(rawData: any[]): ImportResult<any> {
    const errors: Array<{ row: number; field?: string; message: string }> = [];
    const validData: any[] = [];

    rawData.forEach((row, index) => {
      try {
        // Convert string values to appropriate types
        const processedRow = {
          ...row,
          hireDate: row.hireDate,
          doublesEndorsement: this.parseBoolean(row.doublesEndorsement),
          chainExperience: this.parseBoolean(row.chainExperience),
          isEligible: row.isEligible !== undefined ? this.parseBoolean(row.isEligible) : true,
          terminal: row.terminal || row.Terminal || row.terminalCode || row.terminal_code || '',
        };

        const validatedRow = employeeImportSchema.parse(processedRow);
        validData.push(validatedRow);
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach(err => {
            errors.push({
              row: index + 1,
              field: err.path.join('.'),
              message: err.message,
            });
          });
        } else {
          errors.push({
            row: index + 1,
            message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    });

    return {
      success: errors.length === 0,
      data: validData,
      errors,
      summary: {
        totalRows: rawData.length,
        validRows: validData.length,
        errorRows: errors.length,
      },
    };
  }

  static generateExcel(data: any[], filename: string): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    // Auto-size columns
    const columnWidths = this.calculateColumnWidths(data);
    worksheet['!cols'] = columnWidths;

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  static generateCSV(data: any[]): string {
    return Papa.unparse(data, {
      header: true,
      skipEmptyLines: true,
    });
  }

  static generateRouteTemplate(): Buffer {
    const template = [
      {
        runNumber: '1',
        type: 'Doubles',
        origin: 'DEN',
        destination: 'WAM',
        days: 'M,T,W,TH,F',
        startTime: '1:45 PM',
        endTime: '12:45 AM',
        distance: 562,
        rateType: 'Miles',
        workTime: 11.25,
        requiresDoublesEndorsement: true,
        requiresChainExperience: false,
        isActive: true,
        _comment: 'Terminal is automatically set from the import page selection',
      },
      {
        runNumber: '2',
        type: 'Doubles',
        origin: 'DEN',
        destination: 'WAM',
        days: 'M,T,W,TH,F',
        startTime: '9:15 PM',
        endTime: '8:30 AM',
        distance: 562,
        rateType: 'Miles',
        workTime: 11.25,
        requiresDoublesEndorsement: true,
        requiresChainExperience: false,
        isActive: true,
      },
      {
        runNumber: '8',
        type: 'Singles',
        origin: 'DEN',
        destination: 'WAK',
        days: 'M,T,W,TH,F',
        startTime: '7:15 PM',
        endTime: '6:30 AM',
        distance: 616,
        rateType: 'Miles',
        workTime: 11.25,
        requiresDoublesEndorsement: false,
        requiresChainExperience: false,
        isActive: true,
      },
      {
        runNumber: '16',
        type: 'Singles',
        origin: 'DEN',
        destination: 'NCS',
        days: 'M,T,W,TH,F',
        startTime: '11:15 PM',
        endTime: '8:15 AM',
        distance: 350,
        rateType: 'Flat Rate',
        workTime: 9.0,
        requiresDoublesEndorsement: false,
        requiresChainExperience: false,
        isActive: true,
      },
    ];

    return this.generateExcel(template, 'route_template');
  }

  static generateEmployeeTemplate(): Buffer {
    const template = [
      {
        employeeId: 'EMP001',
        firstName: 'Clement',
        lastName: 'Arlee Mingle',
        email: 'aryeemingle@gmail.com',
        phone: '334-590-5191',
        hireDate: '03/24/2025',
        terminal: 'DEN',
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
      },
      {
        employeeId: 'EMP002',
        firstName: 'Lynn C.',
        lastName: 'Beale',
        email: 'truckerbeale2968@gmail.com',
        phone: '303-520-1507',
        hireDate: '07/23/2012',
        terminal: 'DEN',
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
      },
      {
        employeeId: 'EMP003',
        firstName: 'Eduardo D.',
        lastName: 'Flores',
        email: 'e_d97@hotmail.com',
        phone: '720-308-3850',
        hireDate: '08/09/2022',
        terminal: 'DEN',
        doublesEndorsement: false,
        chainExperience: false,
        isEligible: true,
      },
      {
        employeeId: 'EMP004',
        firstName: 'Randy J.',
        lastName: 'Foss',
        email: 'rjfoss030362@msn.com',
        phone: '303-915-8716',
        hireDate: '11/14/2005',
        terminal: 'DEN',
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
      },
    ];

    return this.generateExcel(template, 'employee_template');
  }

  private static parseNumber(value: any, context: string): number {
    if (value === null || value === undefined || value === '') {
      throw new Error(`${context}: Empty or missing value`);
    }
    
    if (typeof value === 'number') return value;
    
    if (typeof value === 'string') {
      // Remove commas and spaces from numbers (e.g., "1,234" -> "1234")
      const cleanValue = value.trim().replace(/,/g, '');
      const parsed = parseFloat(cleanValue);
      if (isNaN(parsed)) {
        throw new Error(`${context}: Invalid number format '${value}'`);
      }
      return parsed;
    }
    
    throw new Error(`${context}: Expected number but got ${typeof value}`);
  }

  private static parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === 'yes' || lower === '1') return true;
      if (lower === 'false' || lower === 'no' || lower === '0') return false;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    return false;
  }

  private static convertTo24Hour(time: string): string {
    if (!time) return '';
    
    // If already in 24-hour format, return as-is
    if (/^\d{2}:\d{2}$/.test(time)) return time;
    
    // Handle 12-hour format (e.g., "1:45 PM", "12:30 AM")
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      
      // Convert to 24-hour format
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      
      // Pad hours with zero if needed
      const formattedHours = hours.toString().padStart(2, '0');
      return `${formattedHours}:${minutes}`;
    }
    
    // If no match, return original
    return time;
  }

  private static calculateColumnWidths(data: any[]): any[] {
    if (data.length === 0) return [];

    const headers = Object.keys(data[0]);
    const widths = headers.map(header => {
      let maxWidth = header.length;
      
      data.forEach(row => {
        const cellValue = String(row[header] || '');
        maxWidth = Math.max(maxWidth, cellValue.length);
      });

      return { width: Math.min(maxWidth + 2, 50) }; // Cap at 50 characters
    });

    return widths;
  }

  static async processRouteFile(file: Buffer, filename: string): Promise<ImportResult<any>> {
    try {
      let rawData: any[];

      if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        rawData = this.parseExcel(file);
      } else if (filename.endsWith('.csv')) {
        const content = file.toString('utf-8');
        rawData = this.parseCSV(content);
      } else {
        throw new Error('Unsupported file format. Please use .xlsx, .xls, or .csv');
      }

      return this.validateRoutes(rawData);
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          message: `File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        summary: {
          totalRows: 0,
          validRows: 0,
          errorRows: 1,
        },
      };
    }
  }

  static async processEmployeeFile(file: Buffer, filename: string): Promise<ImportResult<any>> {
    try {
      let rawData: any[];

      if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        rawData = this.parseExcel(file);
      } else if (filename.endsWith('.csv')) {
        const content = file.toString('utf-8');
        rawData = this.parseCSV(content);
      } else {
        throw new Error('Unsupported file format. Please use .xlsx, .xls, or .csv');
      }

      return this.validateEmployees(rawData);
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          message: `File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        summary: {
          totalRows: 0,
          validRows: 0,
          errorRows: 1,
        },
      };
    }
  }
}