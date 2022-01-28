export interface TwitterSuccessfulUserResponse<T> {
  data: T[];
}

export interface TwitterError {
  value: string;
  detail: string;
  title: string;
  resource_type: string;
  parameter: string;
  resource_id: string;
  type: string;
}

export interface TwitterErrorUserResponse {
  errors: TwitterError[];
}

export type TwitterUserResponse<T> = TwitterSuccessfulUserResponse<T> | TwitterErrorUserResponse;
