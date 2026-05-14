import * as cheerio from 'cheerio';
import { BaseSiteAdapter } from './base.js';
import type { Category, VideoItem, VideoDetail, PlayGroup } from '../types/index.js';

export class CzzyAdapter extends BaseSiteAdapter {
  get supported() { return true; }
  get adapterName() { return 'Czzy'; }

  private getSiteUrls(): string[] {
    const ext = this.site.ext as Record<string, unknown>;
    const sites = ext['sites'];
    if (typeof sites === 'string') {
      return sites.split(',').map(s => s.trim());
    }
    return [];
  }

  private async fetchWithFallback(path: string): Promise<string> {
    const urls = this.getSiteUrls();
    for (const base of urls) {
      try {
        const url = `${base.replace(/\/$/, '')}${path}`;
        const resp = await this.http.get(url, { timeout: 8000 });
        return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      } catch { continue; }
    }
    throw new Error(`All mirrors failed for ${this.site.key}`);
  }

  async getCategories(): Promise<Category[]> {
    const html = await this.fetchWithFallback('/');
    const $ = cheerio.load(html);
    const categories: Category[] = [];

    $('nav a, .nav a, .header-nav a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') ?? '';
      const name = $el.text().trim();
      const match = href.match(/\/(\w+)\/?$/);
      if (match && name && !['/', '#'].includes(href)) {
        categories.push({ id: match[1], name });
      }
    });

    if (categories.length === 0) {
      categories.push(
        { id: 'movie', name: '电影' },
        { id: 'tv', name: '电视剧' },
        { id: 'anime', name: '动漫' },
        { id: 'variety', name: '综艺' },
      );
    }

    return categories;
  }

  async getList(categoryId: string, page: number): Promise<VideoItem[]> {
    const html = await this.fetchWithFallback(`/${categoryId}/page/${page}`);
    return this.parseVideoList(html);
  }

  async search(keyword: string): Promise<VideoItem[]> {
    try {
      const html = await this.fetchWithFallback(`/?s=${encodeURIComponent(keyword)}`);
      return this.parseVideoList(html);
    } catch {
      return [];
    }
  }

  async getDetail(videoId: string): Promise<VideoDetail> {
    const url = videoId.startsWith('http') ? videoId : `/${videoId}`;
    const html = await this.fetchWithFallback(url);
    return this.parseDetail(html, videoId);
  }

  private parseVideoList(html: string): VideoItem[] {
    const $ = cheerio.load(html);
    const items: VideoItem[] = [];

    $('.mi_cont .mi_ne_kd ul li, .bt_img ul li, article').each((_, el) => {
      const $el = $(el);
      const $link = $el.find('a').first();
      const href = $link.attr('href') ?? '';
      const name = $link.attr('title')?.trim() || $el.find('h2, .dytit, .title').first().text().trim();
      const pic = $el.find('img').first().attr('data-src')
        ?? $el.find('img').first().attr('src')
        ?? '';
      const remarks = $el.find('.hdinfo span, .jidi span, .pic_b span').first().text().trim();

      if (name && href) {
        items.push({
          id: href,
          name,
          pic,
          remarks,
          siteKey: this.site.key,
        });
      }
    });

    return items;
  }

  private parseDetail(html: string, videoId: string): VideoDetail {
    const $ = cheerio.load(html);

    const name = $('h1').first().text().trim() || '未知';
    const pic = $('.dyimg img, .thumb img').first().attr('src') ?? '';
    const description = $('.yp_context, .des2, .content').first().text().trim();

    const playList: PlayGroup[] = [];
    const episodes: { name: string; url: string }[] = [];

    $('.paly_list_btn a, .mi_paly_box a, .player_list a').each((_, a) => {
      const epName = $(a).text().trim();
      const epUrl = $(a).attr('href') ?? '';
      if (epName && epUrl) {
        episodes.push({ name: epName, url: epUrl });
      }
    });

    if (episodes.length > 0) {
      playList.push({ name: '默认线路', episodes });
    }

    return { id: videoId, name, pic, description, playList };
  }
}
