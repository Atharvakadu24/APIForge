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
