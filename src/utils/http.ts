import axios, { type AxiosInstance } from 'axios';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function createHttpClient(options?: {
  timeout?: number;
  ua?: string;
}): AxiosInstance {
  const instance = axios.create({
    timeout: options?.timeout ?? 15000,
    headers: {
      'User-Agent': options?.ua ?? PC_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    maxRedirects: 5,
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return Promise.reject(new Error(`Request timeout: ${error.config?.url}`));
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export { MOBILE_UA, PC_UA };
export type { AxiosInstance };
