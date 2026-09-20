import type { ApiRequest, HttpMethod, ResponseData } from './request';

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  latency: number;
  size: number;
  isError?: boolean;
  request: ApiRequest;
  response?: ResponseData | null;
}

export interface DatabaseHistoryRow {
  id: string;
  user_id: string;
  method: string;
  url: string;
  status: number;
  status_text: string;
  latency: number;
  size: number;
  is_error: boolean;
  request: ApiRequest;
  response: ResponseData | null;
  created_at: string;
}

