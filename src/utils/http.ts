import axios, { type AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ProxyConfig {
  url: string; // e.g. "http://127.0.0.1:7890" or "socks5://127.0.0.1:1080"
}

function createProxyAgent(proxy: ProxyConfig) {
  const url = proxy.url;
  if (url.startsWith('socks')) {
    return new SocksProxyAgent(url);
  }
  return new HttpsProxyAgent(url);
}

export function createHttpClient(options?: {
  timeout?: number;
  ua?: string;
  proxy?: ProxyConfig;
}): AxiosInstance {
  const axiosConfig: Record<string, unknown> = {
    timeout: options?.timeout ?? 15000,
    headers: {
      'User-Agent': options?.ua ?? PC_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    maxRedirects: 5,
  };

  if (options?.proxy) {
    const agent = createProxyAgent(options.proxy);
    axiosConfig.httpAgent = agent;
    axiosConfig.httpsAgent = agent;
    axiosConfig.proxy = false; // disable axios built-in proxy, use agent instead
  }

  const instance = axios.create(axiosConfig);

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
