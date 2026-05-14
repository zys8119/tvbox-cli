import type { AxiosInstance } from 'axios';
import type { ParseConfig, ParseResult } from '../types/index.js';
import { ConfigLoader } from '../config/loader.js';

export class ParseService {
  constructor(
    private config: ConfigLoader,
    private http: AxiosInstance,
  ) {}

  getParses(): ParseConfig[] {
    return this.config.getParses().filter(p => p.type === 0);
  }

  getAllParses(): ParseConfig[] {
    return this.config.getParses();
  }

  async parse(videoUrl: string, parseName?: string): Promise<ParseResult | null> {
    const parses = parseName
      ? this.config.getParses().filter(p => p.name === parseName && p.type === 0)
      : this.getParses();

    for (const parse of parses) {
      try {
        const fullUrl = `${parse.url}${encodeURIComponent(videoUrl)}`;
        const headers: Record<string, string> = {
          ...(parse.ext?.header ?? {}),
        };

        const resp = await this.http.get(fullUrl, {
          headers,
          timeout: 8000,
        });

        const data = resp.data;
        if (data?.url && data.url !== videoUrl) {
          return {
            url: data.url,
            header: data.header ?? data.headers,
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async parseWithAll(videoUrl: string): Promise<Array<{ name: string; result: ParseResult | null }>> {
    const parses = this.getParses();
    const results: Array<{ name: string; result: ParseResult | null }> = [];

    const promises = parses.map(async (parse) => {
      try {
        const fullUrl = `${parse.url}${encodeURIComponent(videoUrl)}`;
        const headers = parse.ext?.header ?? {};
        const resp = await this.http.get(fullUrl, { headers, timeout: 8000 });
        const data = resp.data;
        if (data?.url && data.url !== videoUrl) {
          return { name: parse.name, result: { url: data.url, header: data.header } as ParseResult };
        }
        return { name: parse.name, result: null };
      } catch {
        return { name: parse.name, result: null };
      }
    });

    const settled = await Promise.all(promises);
    results.push(...settled);

    return results.filter(r => r.result !== null);
  }
}
