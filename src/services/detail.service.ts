import type { VideoDetail } from '../types/index.js';
import type { SiteService } from './site.service.js';

export class DetailService {
  constructor(private siteService: SiteService) {}

  async getDetail(siteKey: string, videoId: string): Promise<VideoDetail> {
    const adapter = this.siteService.getAdapter(siteKey);
    return adapter.getDetail(videoId);
  }
}
