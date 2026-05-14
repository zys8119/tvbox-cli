import type { AxiosInstance } from 'axios';
import type { LiveChannel, LiveConfig } from '../types/index.js';
import { ConfigLoader } from '../config/loader.js';

export class LiveService {
  constructor(
    private config: ConfigLoader,
    private http: AxiosInstance,
  ) {}

  async getChannels(): Promise<LiveChannel[]> {
    const lives = this.config.getLives();
    const channels: LiveChannel[] = [];

    for (const live of lives) {
      try {
        if (live.type === 0) {
          const resp = await this.http.get(live.url, {
            timeout: 10000,
            headers: live.ua ? { 'User-Agent': live.ua } : {},
          });
          channels.push(...this.parseTxtLive(resp.data));
        }
      } catch {
        // Skip failed live sources
      }
    }

    return channels;
  }

  async getChannelsByGroup(): Promise<Map<string, LiveChannel[]>> {
    const channels = await this.getChannels();
    const groups = new Map<string, LiveChannel[]>();

    for (const ch of channels) {
      const list = groups.get(ch.group) ?? [];
      list.push(ch);
      groups.set(ch.group, list);
    }

    return groups;
  }

  getLiveConfigs(): LiveConfig[] {
    return this.config.getLives();
  }

  private parseTxtLive(txt: string): LiveChannel[] {
    const lines = txt.split('\n');
    let currentGroup = '未分组';
    const channels: LiveChannel[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.includes(',#genre#')) {
        currentGroup = trimmed.split(',')[0].trim();
      } else if (trimmed.includes(',http')) {
        const commaIdx = trimmed.indexOf(',');
        if (commaIdx > 0) {
          const name = trimmed.substring(0, commaIdx).trim();
          const urlPart = trimmed.substring(commaIdx + 1).trim();
          const urls = urlPart.split('#').filter(u => u.startsWith('http'));
          if (name && urls.length > 0) {
            channels.push({ name, group: currentGroup, urls });
          }
        }
      }
    }

    return channels;
  }
}
