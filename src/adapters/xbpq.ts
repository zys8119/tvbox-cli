import * as cheerio from 'cheerio';
import type { AxiosInstance } from 'axios';
import { BaseSiteAdapter } from './base.js';
import type { SiteConfig, Category, VideoItem, VideoDetail, PlayGroup } from '../types/index.js';
import { MOBILE_UA } from '../utils/http.js';

interface XBPQExt {
  '请求头'?: string;
  '编码'?: string;
  '分类': string;
  '类型'?: string;
  '分类url': string;
  '简介'?: string;
}

export class XBPQAdapter extends BaseSiteAdapter {
  get supported() { return true; }
  get adapterName() { return 'XBPQ'; }

  private getExt(): XBPQExt {
    return this.site.ext as unknown as XBPQExt;
  }

  private getBaseUrl(): string {
    const template = this.getExt()['分类url'];
    const match = template.match(/^(https?:\/\/[^/]+)/);
    return match ? match[1] : '';
  }

  private getHeaders(): Record<string, string> {
    const headerStr = this.getExt()['请求头'];
    if (!headerStr) return {};
    const parts = headerStr.split('$');
    if (parts.length < 2) return {};
    const [key, value] = parts;
    const resolved = value === 'MOBILE_UA' ? MOBILE_UA : value;
    return { [key]: resolved };
  }

  async getCategories(): Promise<Category[]> {
    const ext = this.getExt();
    const catStr = ext['分类'];
    if (!catStr) return [];

    const mainCats: Category[] = catStr.split('#').map(item => {
      const [name, id] = item.split('$');
      return { id, name };
    });

    // Parse sub-types if available
    const typeStr = ext['类型'];
    if (typeStr) {
      const groups = typeStr.split('||');
      mainCats.forEach((cat, i) => {
        if (groups[i]) {
          cat.children = groups[i].split('#').map(sub => {
            const [name, id] = sub.split('$');
            return { id, name };
          });
        }
      });
    }

    return mainCats;
  }

  async getList(categoryId: string, page: number): Promise<VideoItem[]> {
    const template = this.getExt()['分类url'];
    const url = template
      .replace('{cateId}', categoryId)
      .replace('{catePg}', String(page))
      .replace(/{area}/g, '')
      .replace(/{by}/g, '')
      .replace(/{class}/g, '')
      .replace(/{lang}/g, '')
      .replace(/{letter}/g, '')
      .replace(/{year}/g, '');

    const resp = await this.http.get(url, { headers: this.getHeaders() });
    return this.parseListPage(resp.data);
  }

  async search(keyword: string, page = 1): Promise<VideoItem[]> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/vodsearch/${encodeURIComponent(keyword)}----------${page}---.html`;
    try {
      const resp = await this.http.get(url, { headers: this.getHeaders() });
      return this.parseListPage(resp.data);
    } catch {
      // Try alternative search URL pattern
      const url2 = `${baseUrl}/vodsearch.html?wd=${encodeURIComponent(keyword)}&page=${page}`;
      const resp = await this.http.get(url2, { headers: this.getHeaders() });
      return this.parseListPage(resp.data);
    }
  }

  async getDetail(videoId: string): Promise<VideoDetail> {
    const baseUrl = this.getBaseUrl();
    let url: string;
    if (videoId.startsWith('http')) {
      url = videoId;
    } else if (videoId.startsWith('/')) {
      url = `${baseUrl}${videoId}`;
    } else {
      url = `${baseUrl}/voddetail/${videoId}/`;
    }
    const resp = await this.http.get(url, { headers: this.getHeaders() });
    return this.parseDetailPage(resp.data, videoId);
  }

  private parseListPage(html: string): VideoItem[] {
    const $ = cheerio.load(html);
    const items: VideoItem[] = [];

    // Search result cards (module-card-item)
    const cardItems = $('.module-card-item');
    if (cardItems.length > 0) {
      cardItems.each((_, el) => {
        const $el = $(el);
        const $link = $el.find('a[href*="vod"]').first();
        const href = $link.attr('href') ?? '';
        const id = this.extractId(href);
        const name = $el.find('.module-card-item-title, .module-card-item-info .title').first().text().trim()
          || $link.attr('title')?.trim()
          || '';
        const pic = $el.find('img').first().attr('data-src')
          ?? $el.find('img').first().attr('src')
          ?? '';
        const remarks = $el.find('.module-item-note, .module-card-item-class').first().text().trim();

        if (name && id) {
          items.push({ id, name, pic, remarks, siteKey: this.site.key });
        }
      });
      return items;
    }

    // Common selectors for CMS-style sites
    const selectors = [
      '.module-items .module-item',
      '.vodlist li',
      '.module-list .module-items',
      '.stui-vodlist li',
      '.stui-pannel .stui-vodlist__box',
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

    // Fallback: try to find any links with voddetail pattern
    if (items.length === 0) {
      $('a[href*="voddetail"], a[href*="detail"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href') ?? '';
        const id = this.extractId(href);
        const name = $el.attr('title')?.trim() || $el.text().trim();
        if (name && id && name.length > 1) {
          items.push({ id, name, siteKey: this.site.key });
        }
      });
    }

    return items;
  }

  private parseDetailPage(html: string, videoId: string): VideoDetail {
    const $ = cheerio.load(html);

    const name = $('.module-info-heading h1, .stui-content__detail h1, .video-info-header h1').first().text().trim()
      || $('h1').first().text().trim();
    const pic = $('.module-info-poster img, .stui-content__thumb img, .video-info-media img').first().attr('data-src')
      ?? $('.module-info-poster img, .stui-content__thumb img').first().attr('src')
      ?? '';
    const description = $('.module-info-introduction-content, .stui-content__desc, .video-info-content').first().text().trim();

    // Extract metadata
    const infoText = $('.module-info-items, .stui-content__detail .data, .video-info-aux').text();
    const yearMatch = infoText.match(/(\d{4})/);
    const year = yearMatch?.[1];

    // Parse play lists
    const playList: PlayGroup[] = [];
    const tabNames: string[] = [];

    $('.module-tab-items-box .module-tab-item, .stui-pannel__head h3, .playlist-tab a').each((_, el) => {
      tabNames.push($(el).text().trim());
    });

    $('.module-play-list, .stui-content__playlist, .playlist-list').each((i, el) => {
      const episodes: { name: string; url: string }[] = [];
      $(el).find('a').each((_, a) => {
        const epName = $(a).text().trim();
        const epUrl = $(a).attr('href') ?? '';
        if (epName && epUrl) {
          episodes.push({ name: epName, url: epUrl.startsWith('http') ? epUrl : `${this.getBaseUrl()}${epUrl}` });
        }
      });
      if (episodes.length > 0) {
        playList.push({
          name: tabNames[i] || `线路${i + 1}`,
          episodes,
        });
      }
    });

    return {
      id: videoId,
      name: name || '未知',
      pic,
      year,
      description,
      playList,
    };
  }

  private extractId(href: string): string {
    // Match /voddetail/44693/ or /voddetail/44693.html
    const match = href.match(/voddetail\/(\d+)/);
    if (match) return match[1];
    const match2 = href.match(/(\d+)\.html/);
    if (match2) return match2[1];
    const parts = href.split('/').filter(Boolean);
    return parts[parts.length - 1]?.replace('.html', '') ?? href;
  }
}
