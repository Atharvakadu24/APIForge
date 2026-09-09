import type { ApiRequest } from './request';

export interface SavedRequest {
  id: string;
  collectionId: string;
  name: string;
  request: ApiRequest;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  requests: SavedRequest[];
}
