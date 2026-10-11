import type { ApiRequest } from './request';

export interface CollectionFolder {
  id: string;
  collectionId: string;
  parentFolderId: string | null;
  name: string;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
  subfolders?: CollectionFolder[];
  requests?: SavedRequest[];
}

export interface SavedRequest {
  id: string;
  collectionId: string;
  folderId: string | null;
  name: string;
  request: ApiRequest;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
  folders: CollectionFolder[];
  requests: SavedRequest[];
}

