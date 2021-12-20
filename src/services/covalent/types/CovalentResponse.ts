export interface CovalentResponse<T> {
  data: T;
  error?: boolean;
  error_message?: string;
  error_code?: string;
}
