export interface WebOutputMessage {
  response: string;
  jobId?: string;
  error?: string;
}

export function formatWebOutput(response: string, jobId?: string): WebOutputMessage {
  return { response, jobId };
}

export function formatWebError(error: string): WebOutputMessage {
  return { response: '', error };
}
