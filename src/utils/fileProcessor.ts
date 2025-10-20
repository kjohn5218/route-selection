import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';
import { z } from 'zod';

// Define schemas for import validation
const routeImportSchema = z.object({
  runNumber: z.string(),
  type: z.enum(['LOCAL', 'REGIONAL', 'LONG_HAUL', 'DEDICATED', 'DOUBLES', 'Doubles', 'Singles']).transform(val => {
    // Normalize the type values
    if (val === 'Doubles') return 'DOUBLES';
    if (val === 'Singles') return 'LOCAL';
    return val;
  }),
  origin: z.string(),
  destination: z.string(),
  days: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  distance: z.number(),
  rateType: z.enum(['HOURLY', 'MILEAGE', 'SALARY', 'Miles', 'Flat Rate']).transform(val => {
    // Normalize the rate type values
    if (val === 'Miles') return 'MILEAGE';
    if (val === 'Flat Rate') return 'SALARY';
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
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
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

    rawData.forEach((row, index) => {
      try {
        // Convert string values to appropriate types
        const processedRow = {
          ...row,
          distance: this.parseNumber(row.distance, `Row ${index + 1}: distance`),
          workTime: this.parseNumber(row.workTime, `Row ${index + 1}: workTime`),
          requiresDoublesEndorsement: this.parseBoolean(row.requiresDoublesEndorsement),
          requiresChainExperience: this.parseBoolean(row.requiresChainExperience),
          isActive: row.isActive !== undefined ? this.parseBoolean(row.isActive) : true,
        };

        const validatedRow = routeImportSchema.parse(processedRow);
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
        doublesEndorsement: true,
        chainExperience: true,
        isEligible: true,
      },
    ];

    return this.generateExcel(template, 'employee_template');
  }

  private static parseNumber(value: any, context: string): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        throw new Error(`${context}: Invalid number format`);
      }
      return parsed;
    }
    throw new Error(`${context}: Expected number`);
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