import * as cheerio from 'cheerio';
import { BaseSiteAdapter } from './base.js';
import type { Category, VideoItem, VideoDetail, PlayGroup } from '../types/index.js';

export class KongbaiAdapter extends BaseSiteAdapter {
  get supported() { return true; }
  get adapterName() { return 'Kongbai'; }

  private getSiteUrls(): string[] {
    const ext = this.site.ext as Record<string, unknown>;
    const siteUrl = ext['siteUrl'];
    if (Array.isArray(siteUrl)) return siteUrl as string[];
    if (typeof siteUrl === 'string') return [siteUrl];
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

    // Parse navigation links
    $('nav a, .navbar a, .nav-item a, .header-nav a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') ?? '';
      const name = $el.text().trim();
      const match = href.match(/vodtype\/(\d+)/);
      if (match && name) {
        categories.push({ id: match[1], name });
      }
    });

    if (categories.length === 0) {
      // Fallback: common categories
      $('a[href*="vodshow"], a[href*="vodtype"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') ?? '';
        const name = $el.text().trim();
        const match = href.match(/(\d+)/);
        if (match && name && name.length < 10) {
          categories.push({ id: match[1], name });
        }
      });
    }

    return categories;
  }

  async getList(categoryId: string, page: number): Promise<VideoItem[]> {
    const html = await this.fetchWithFallback(`/vodshow/${categoryId}--------${page}---.html`);
    return this.parseVideoList(html);
  }

  async search(keyword: string, page = 1): Promise<VideoItem[]> {
    try {
      const html = await this.fetchWithFallback(`/vodsearch/${encodeURIComponent(keyword)}----------${page}---.html`);
      return this.parseVideoList(html);
    } catch {
      try {
        const html = await this.fetchWithFallback(`/index.php/vod/search.html?wd=${encodeURIComponent(keyword)}&page=${page}`);
        return this.parseVideoList(html);
      } catch {
        return [];
      }
    }
  }

  async getDetail(videoId: string): Promise<VideoDetail> {
    const html = await this.fetchWithFallback(`/voddetail/${videoId}.html`);
    return this.parseDetail(html, videoId);
  }

  private parseVideoList(html: string): VideoItem[] {
    const $ = cheerio.load(html);
    const items: VideoItem[] = [];

    const selectors = [
      '.module-items .module-item',
      '.vodlist li',
      '.stui-vodlist li',
      '.stui-vodlist__box',
      '.public-list-box',
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, el) => {
          const $el = $(el);
          const $link = $el.find('a[href*="vod"]').first();
          const href = $link.attr('href') ?? '';
          const id = this.extractId(href);
          const name = $el.find('.module-item-title, .title, h4, .stui-vodlist__title').first().text().trim()
            || $link.attr('title')?.trim()
            || $link.text().trim();
          const pic = $el.find('img').first().attr('data-src')
            ?? $el.find('img').first().attr('src')
            ?? '';
          const remarks = $el.find('.module-item-note, .pic-text, .stui-vodlist__thumb span').first().text().trim();

          if (name && id) {
            items.push({ id, name, pic, remarks, siteKey: this.site.key });
          }
        });
        break;
      }
    }

    return items;
  }

  private parseDetail(html: string, videoId: string): VideoDetail {
    const $ = cheerio.load(html);

    const name = $('h1').first().text().trim() || '未知';
    const pic = $('.module-info-poster img, .stui-content__thumb img').first().attr('data-src')
      ?? $('.module-info-poster img, .stui-content__thumb img').first().attr('src')
      ?? '';
    const description = $('.module-info-introduction-content, .stui-content__desc').first().text().trim();

    const playList: PlayGroup[] = [];
    const tabNames: string[] = [];

    $('.module-tab-item, .stui-pannel__head h3').each((_, el) => {
      tabNames.push($(el).text().trim());
    });

    $('.module-play-list, .stui-content__playlist').each((i, el) => {
      const episodes: { name: string; url: string }[] = [];
      $(el).find('a').each((_, a) => {
        const epName = $(a).text().trim();
        const epUrl = $(a).attr('href') ?? '';
        if (epName && epUrl) {
          episodes.push({ name: epName, url: epUrl });
        }
      });
      if (episodes.length > 0) {
        playList.push({ name: tabNames[i] || `线路${i + 1}`, episodes });
      }
    });

    return { id: videoId, name, pic, description, playList };
  }

  private extractId(href: string): string {
    const match = href.match(/(\d+)\.html/);
    if (match) return match[1];
    const parts = href.split('/').filter(Boolean);
    return parts[parts.length - 1]?.replace('.html', '') ?? href;
  }
}
