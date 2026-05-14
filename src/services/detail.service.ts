import type { VideoDetail } from '../types/index.js';
import type { SiteService } from './site.service.js';
import type { Store } from '../store/index.js';

export class DetailService {
  constructor(
    private siteService: SiteService,
    private store?: Store,
    private configName?: string,
  ) {}

  async getDetail(siteKey: string, videoId: string): Promise<VideoDetail> {
    // Check cache
    if (this.store && this.configName) {
      const cached = this.store.getDetailCache(this.configName, siteKey, videoId);
      if (cached) return cached as VideoDetail;
    }

    const adapter = this.siteService.getAdapter(siteKey);
    const detail = await adapter.getDetail(videoId);

    // Save to cache
    if (this.store && this.configName && detail.playList?.length > 0) {
      this.store.setDetailCache(this.configName, siteKey, videoId, detail);
    }

    return detail;
  }
}
