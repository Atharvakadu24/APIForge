import type { ApiRequest } from './request';

export interface EnvironmentVariable {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Environment {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  variables: EnvironmentVariable[];
}

export interface UnresolvedVariable {
  name: string;
  location: string;
}

export interface ResolutionResult {
  resolvedRequest: ApiRequest;
  unresolved: UnresolvedVariable[];
  isValid: boolean;
}
