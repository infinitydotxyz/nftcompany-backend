export type SearchResponse<T, Includes> = NonEmptySearchResponse<T, Includes> | EmptySearchResponse;

/**
 * response for search containing multiple results
 */
export interface NonEmptySearchResponse<T, Includes> {
  data: T[];
  meta: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token: string;
  };
  includes?: Includes;
}

/**
 * response for a search containing no results
 */
export interface EmptySearchResponse {
  meta: {
    result_count: 0;
  };
}
