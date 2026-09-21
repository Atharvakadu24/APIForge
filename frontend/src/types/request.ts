export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface KeyValueEntry {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export type AuthType = 'none' | 'bearer' | 'apiKey';

export interface BearerAuth {
  token: string;
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

export interface RequestAuth {
  type: AuthType;
  bearer?: BearerAuth;
  apiKey?: ApiKeyAuth;
}

export type RequestBodyType =
  | 'none'
  | 'json'
  | 'text'
  | 'x-www-form-urlencoded'
  | 'multipart/form-data';

export interface ApiRequest {
  method: HttpMethod;
  url: string;
  queryParams: KeyValueEntry[];
  headers: KeyValueEntry[];
  bodyType: RequestBodyType;
  body: string;
  formUrlEncoded?: KeyValueEntry[];
  multipartFormData?: KeyValueEntry[];
  auth: RequestAuth;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  time: number;
  size: number;
  body: string;
  isError?: boolean;
  errorMessage?: string;
}
