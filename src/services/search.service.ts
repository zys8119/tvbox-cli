import type { VideoItem } from '../types/index.js';
import type { SiteService } from './site.service.js';
import { ConfigLoader } from '../config/loader.js';

export class SearchService {
  constructor(
    private siteService: SiteService,
    private config: ConfigLoader,
  ) {}

  async searchAll(keyword: string, options?: {
    concurrency?: number;
    timeout?: number;
    siteKeys?: string[];
  }): Promise<VideoItem[]> {
    const concurrency = options?.concurrency ?? 5;
    const timeout = options?.timeout ?? 10000;

    let sites: Array<{ key: string }>;
    if (options?.siteKeys && options.siteKeys.length > 0) {
      sites = options.siteKeys.map(k => ({ key: k }));
    } else {
      sites = this.config.getSearchableSites();
    }

    const results: VideoItem[] = [];

    for (let i = 0; i < sites.length; i += concurrency) {
      const batch = sites.slice(i, i + concurrency);
      const promises = batch.map(async (site) => {
        try {
          const adapter = this.siteService.getAdapter(site.key);
          if (!adapter.supported) return [];
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeout);
          try {
            const result = await adapter.search(keyword);
            clearTimeout(timer);
            return result;
          } catch {
            clearTimeout(timer);
            return [];
          }
        } catch {
          return [];
        }
      });
      const batchResults = await Promise.all(promises);
      results.push(...batchResults.flat());
    }

    return results;
  }

  async searchSite(siteKey: string, keyword: string, page = 1): Promise<VideoItem[]> {
    const adapter = this.siteService.getAdapter(siteKey);
    if (!adapter.supported) return [];
    return adapter.search(keyword, page);
  }
}
