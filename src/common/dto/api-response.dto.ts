export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
  requestId: string;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}
