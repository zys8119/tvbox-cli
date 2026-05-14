import * as cheerio from 'cheerio';
import { BaseSiteAdapter } from './base.js';
import type { Category, VideoItem, VideoDetail, PlayGroup } from '../types/index.js';

export class DirectUrlAdapter extends BaseSiteAdapter {
  get supported() { return true; }
  get adapterName() { return 'DirectUrl'; }

  private getBaseUrl(): string {
    if (typeof this.site.ext === 'string') {
      return this.site.ext.replace(/\/$/, '');
    }
    if (typeof this.site.ext === 'object' && this.site.ext !== null) {
      const ext = this.site.ext as Record<string, unknown>;
      const siteUrl = ext['siteUrl'];
      if (typeof siteUrl === 'string') return siteUrl.replace(/\/$/, '');
      if (Array.isArray(siteUrl) && siteUrl.length > 0) return (siteUrl[0] as string).replace(/\/$/, '');
    }
    return '';
  }

  async getCategories(): Promise<Category[]> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return [];

    try {
      const resp = await this.http.get(baseUrl, { timeout: 8000 });
      const $ = cheerio.load(resp.data);
      const categories: Category[] = [];

      $('nav a, .navbar a, .nav a, .header-nav a').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') ?? '';
        const name = $el.text().trim();
        const match = href.match(/vodtype\/(\d+)/) || href.match(/type\/(\d+)/) || href.match(/(\d+)\.html/);
        if (match && name && name.length < 10) {
          categories.push({ id: match[1], name });
        }
      });

      return categories;
    } catch {
      return [];
    }
  }

  async getList(categoryId: string, page: number): Promise<VideoItem[]> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return [];

    const patterns = [
      `${baseUrl}/vodshow/${categoryId}--------${page}---.html`,
      `${baseUrl}/vodtype/${categoryId}-${page}.html`,
      `${baseUrl}/type/${categoryId}/${page}.html`,
    ];

    for (const url of patterns) {
      try {
        const resp = await this.http.get(url, { timeout: 8000 });
        const items = this.parseVideoList(resp.data);
        if (items.length > 0) return items;
      } catch { continue; }
    }

    return [];
  }

  async search(keyword: string, page = 1): Promise<VideoItem[]> {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return [];

    const patterns = [
      `${baseUrl}/vodsearch/${encodeURIComponent(keyword)}----------${page}---.html`,
      `${baseUrl}/index.php/vod/search.html?wd=${encodeURIComponent(keyword)}&page=${page}`,
      `${baseUrl}/search/${encodeURIComponent(keyword)}/${page}.html`,
      `${baseUrl}/search.html?wd=${encodeURIComponent(keyword)}`,
    ];

    for (const url of patterns) {
      try {
        const resp = await this.http.get(url, { timeout: 8000 });
        const items = this.parseVideoList(resp.data);
        if (items.length > 0) return items;
      } catch { continue; }
    }

    return [];
  }

  async getDetail(videoId: string): Promise<VideoDetail> {
    const baseUrl = this.getBaseUrl();
    const url = videoId.startsWith('http') ? videoId : `${baseUrl}/voddetail/${videoId}.html`;

    try {
      const resp = await this.http.get(url, { timeout: 8000 });
      return this.parseDetail(resp.data, videoId);
    } catch {
      return { id: videoId, name: '加载失败', playList: [] };
    }
  }

  private parseVideoList(html: string): VideoItem[] {
    const $ = cheerio.load(html);
    const items: VideoItem[] = [];

    const selectors = [
      '.module-items .module-item',
      '.vodlist li',
      '.stui-vodlist li',
      '.stui-vodlist__box',
      '.search-list li',
      '.xing_vb ul li',
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((_, el) => {
          const $el = $(el);
          const $link = $el.find('a[href*="vod"], a[href*="detail"]').first();
          const href = $link.attr('href') ?? '';
          const id = this.extractId(href);
          const name = $el.find('.module-item-title, .title, h4, .stui-vodlist__title, .xing_vb4 a').first().text().trim()
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

    const name = $('h1').first().text().trim()
      || $('.module-info-heading h1').first().text().trim()
      || '未知';
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
          const fullUrl = epUrl.startsWith('http') ? epUrl : `${this.getBaseUrl()}${epUrl}`;
          episodes.push({ name: epName, url: fullUrl });
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
    return href;
  }
}
