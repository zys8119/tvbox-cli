import type { AxiosInstance } from 'axios';
import type { SiteConfig, Category, VideoItem, VideoDetail } from '../types/index.js';

export interface SiteAdapter {
  readonly supported: boolean;
  readonly adapterName: string;
  getCategories(): Promise<Category[]>;
  getList(categoryId: string, page: number, filters?: Record<string, string>): Promise<VideoItem[]>;
  search(keyword: string, page?: number): Promise<VideoItem[]>;
  getDetail(videoId: string): Promise<VideoDetail>;
  resolvePlayUrl?(episodeUrl: string): Promise<string>;
}

export abstract class BaseSiteAdapter implements SiteAdapter {
  protected site: SiteConfig;
  protected http: AxiosInstance;

  constructor(site: SiteConfig, http: AxiosInstance) {
    this.site = site;
    this.http = http;
  }

  abstract get supported(): boolean;
  abstract get adapterName(): string;
  abstract getCategories(): Promise<Category[]>;
  abstract getList(categoryId: string, page: number, filters?: Record<string, string>): Promise<VideoItem[]>;
  abstract search(keyword: string, page?: number): Promise<VideoItem[]>;
  abstract getDetail(videoId: string): Promise<VideoDetail>;
}
