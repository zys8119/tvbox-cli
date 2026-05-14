import * as cheerio from 'cheerio';
import { BaseSiteAdapter } from './base.js';
import type { Category, VideoItem, VideoDetail, PlayGroup } from '../types/index.js';

export class CmsApiAdapter extends BaseSiteAdapter {
  get supported() { return true; }
  get adapterName() { return this.site.type === 0 ? 'CMS-XML' : 'CMS-JSON'; }

  private getApiUrl(): string {
    return this.site.api;
  }

  async getCategories(): Promise<Category[]> {
    const resp = await this.http.get(this.getApiUrl(), {
      params: { ac: this.site.type === 1 ? 'detail' : 'list' },
    });

    if (this.site.type === 1) {
      const data = resp.data;
      if (data.class && Array.isArray(data.class)) {
        return data.class.map((c: { type_id: number; type_name: string }) => ({
          id: String(c.type_id),
          name: c.type_name,
        }));
      }
      return [];
    }

    // Type 0: XML response - parse with cheerio
    const $ = cheerio.load(resp.data, { xmlMode: true });
    const categories: Category[] = [];
    $('class ty').each((_, el) => {
      const id = $(el).attr('id') ?? '';
      const name = $(el).text().trim();
      if (id && name) categories.push({ id, name });
    });
    return categories;
  }

  async getList(categoryId: string, page: number): Promise<VideoItem[]> {
    const resp = await this.http.get(this.getApiUrl(), {
      params: {
        ac: this.site.type === 1 ? 'detail' : 'videolist',
        t: categoryId,
        pg: page,
      },
    });

    return this.site.type === 1
      ? this.parseJsonList(resp.data)
      : this.parseXmlList(resp.data);
  }

  async search(keyword: string, page = 1): Promise<VideoItem[]> {
    const resp = await this.http.get(this.getApiUrl(), {
      params: {
        ac: this.site.type === 1 ? 'detail' : 'videolist',
        wd: keyword,
        pg: page,
      },
    });

    return this.site.type === 1
      ? this.parseJsonList(resp.data)
      : this.parseXmlList(resp.data);
  }

  async getDetail(videoId: string): Promise<VideoDetail> {
    const resp = await this.http.get(this.getApiUrl(), {
      params: { ac: 'detail', ids: videoId },
    });

    return this.site.type === 1
      ? this.parseJsonDetail(resp.data)
      : this.parseXmlDetail(resp.data);
  }

  private parseJsonList(data: any): VideoItem[] {
    const list = data.list ?? data.data ?? [];
    return list.map((item: any) => ({
      id: String(item.vod_id),
      name: item.vod_name,
      pic: item.vod_pic,
      remarks: item.vod_remarks || item.vod_note,
      year: item.vod_year,
      area: item.vod_area,
      type: item.type_name,
      siteKey: this.site.key,
    }));
  }

  private parseXmlList(data: string): VideoItem[] {
    const $ = cheerio.load(data, { xmlMode: true });
    const items: VideoItem[] = [];
    $('video').each((_, el) => {
      const $el = $(el);
      items.push({
        id: $el.find('id').text() || $el.attr('id') || '',
        name: $el.find('name').text() || '',
        pic: $el.find('pic').text() || '',
        remarks: $el.find('note').text() || '',
        siteKey: this.site.key,
      });
    });
    return items;
  }

  private parseJsonDetail(data: any): VideoDetail {
    const list = data.list ?? data.data ?? [];
    if (list.length === 0) return { id: '', name: '未找到', playList: [] };

    const item = list[0];
    const playList: PlayGroup[] = [];

    const playFrom = (item.vod_play_from ?? '').split('$$$');
    const playUrl = (item.vod_play_url ?? '').split('$$$');

    playFrom.forEach((source: string, i: number) => {
      const urlStr = playUrl[i] ?? '';
      const episodes = urlStr.split('#').filter(Boolean).map((ep: string) => {
        const [name, url] = ep.split('$');
        return { name: name ?? '', url: url ?? '' };
      });
      if (episodes.length > 0) {
        playList.push({ name: source || `线路${i + 1}`, episodes });
      }
    });

    return {
      id: String(item.vod_id),
      name: item.vod_name ?? '未知',
      pic: item.vod_pic,
      year: item.vod_year,
      area: item.vod_area,
      type: item.type_name,
      actor: item.vod_actor,
      director: item.vod_director,
      description: item.vod_content?.replace(/<[^>]+>/g, ''),
      playList,
    };
  }

  private parseXmlDetail(data: string): VideoDetail {
    const $ = cheerio.load(data, { xmlMode: true });
    const video = $('video').first();

    const playList: PlayGroup[] = [];
    const dlElements = video.find('dl dd');
    dlElements.each((i, el) => {
      const flag = $(el).attr('flag') ?? `线路${i + 1}`;
      const content = $(el).text().trim();
      const episodes = content.split('#').filter(Boolean).map(ep => {
        const [name, url] = ep.split('$');
        return { name: name ?? '', url: url ?? '' };
      });
      if (episodes.length > 0) {
        playList.push({ name: flag, episodes });
      }
    });

    return {
      id: video.find('id').text() || '',
      name: video.find('name').text() || '未知',
      pic: video.find('pic').text() || '',
      year: video.find('year').text() || '',
      area: video.find('area').text() || '',
      actor: video.find('actor').text() || '',
      director: video.find('director').text() || '',
      description: video.find('des').text()?.replace(/<[^>]+>/g, '') || '',
      playList,
    };
  }
}
