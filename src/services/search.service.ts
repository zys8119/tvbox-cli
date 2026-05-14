import type { VideoItem } from '../types/index.js';
import type { SiteService } from './site.service.js';
import { ConfigLoader } from '../config/loader.js';
import type { Store } from '../store/index.js';

export class SearchService {
  constructor(
    private siteService: SiteService,
    private config: ConfigLoader,
    private store?: Store,
    private configName?: string,
  ) {}

  async searchAll(keyword: string, options?: {
    concurrency?: number;
    timeout?: number;
    siteKeys?: string[];
    signal?: AbortSignal;
    noCache?: boolean;
  }): Promise<VideoItem[]> {
    const cacheKey = options?.siteKeys ? `${keyword}@${options.siteKeys.join(',')}` : keyword;

    // Check cache
    if (!options?.noCache && this.store && this.configName) {
      const cached = this.store.getSearchCache(this.configName, cacheKey);
      if (cached) return cached as VideoItem[];
    }

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
      if (options?.signal?.aborted) break;

      const batch = sites.slice(i, i + concurrency);
      const promises = batch.map(async (site) => {
        try {
          if (options?.signal?.aborted) return [];
          const adapter = this.siteService.getAdapter(site.key);
          if (!adapter.supported) return [];
          const timer = setTimeout(() => {}, timeout);
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

    // Save to cache
    if (results.length > 0 && this.store && this.configName) {
      this.store.setSearchCache(this.configName, cacheKey, results);
    }

    return results;
  }

  async searchSite(siteKey: string, keyword: string, page = 1): Promise<VideoItem[]> {
    const adapter = this.siteService.getAdapter(siteKey);
    if (!adapter.supported) return [];
    return adapter.search(keyword, page);
  }
}
