import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'DRIVER';
  employeeId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  employeeId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role?: 'ADMIN' | 'DRIVER';
  employeeData?: {
    employeeId: string;
    firstName: string;
    lastName: string;
    phone?: string;
    hireDate: string;
    doublesEndorsement?: boolean;
    chainExperience?: boolean;
  };
}

export interface RouteFilters {
  type?: string;
  requiresDoublesEndorsement?: boolean;
  requiresChainExperience?: boolean;
  searchTerm?: string;
}

export interface EmployeeFilters {
  isEligible?: boolean;
  doublesEndorsement?: boolean;
  chainExperience?: boolean;
  searchTerm?: string;
}

// Type definitions for string-based enums
export type Role = 'ADMIN' | 'DRIVER';
export type RouteType = 'LOCAL' | 'REGIONAL' | 'LONG_HAUL' | 'DEDICATED';
export type RateType = 'HOURLY' | 'MILEAGE' | 'SALARY';
export type SelectionPeriodStatus = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'PROCESSING' | 'COMPLETED';