export interface StubCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  pathParams?: Record<string, string>;
}

export interface StubResult {
  status: number;
  data: unknown;
}
