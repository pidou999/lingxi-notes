export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Note {
  id: string;
  title: string;
  html: string;
  json: Record<string, unknown>;
  tags?: string[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  starred?: boolean;
  password?: string;
  folder?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
