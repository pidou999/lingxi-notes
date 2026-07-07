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
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
