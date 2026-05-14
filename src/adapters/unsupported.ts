import { BaseSiteAdapter } from './base.js';
import type { Category, VideoItem, VideoDetail } from '../types/index.js';

export class UnsupportedAdapter extends BaseSiteAdapter {
  get supported() { return false; }
  get adapterName() { return 'Unsupported'; }

  async getCategories(): Promise<Category[]> {
    return [];
  }

  async getList(): Promise<VideoItem[]> {
    return [];
  }

  async search(): Promise<VideoItem[]> {
    return [];
  }

  async getDetail(videoId: string): Promise<VideoDetail> {
    return { id: videoId, name: '不支持的站点类型', playList: [] };
  }
}
