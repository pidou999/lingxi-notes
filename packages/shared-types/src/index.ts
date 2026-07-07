// ===== User =====
export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Tag =====
export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

// ===== Collection =====
export interface Collection {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  order: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Note =====
export interface Note {
  id: string;
  title: string;
  content: string;
  contentJson: Record<string, unknown>;
  tags: Tag[];
  collectionId?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// ===== API Response Types =====
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// ===== Auth Types =====
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ===== Editor Types =====
export type EditorContent = Record<string, unknown>;

export interface NoteCreateRequest {
  title: string;
  content?: string;
  contentJson?: EditorContent;
  tags?: string[];
  collectionId?: string | null;
}

export interface NoteUpdateRequest {
  title?: string;
  content?: string;
  contentJson?: EditorContent;
  tags?: string[];
  collectionId?: string | null;
}
