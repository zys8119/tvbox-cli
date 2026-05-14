import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import axios from 'axios';
import type { TVBoxConfig, SiteConfig, ParseConfig, LiveConfig, RuleConfig } from '../types/index.js';
import type { ConfigEntry } from '../store/index.js';

const CACHE_DIR = resolve(homedir(), '.tvbox', 'cache');

export class ConfigLoader {
  private config: TVBoxConfig | null = null;
  private configSource: string;
  private isRemote: boolean;

  constructor(source?: string | ConfigEntry) {
    if (!source) {
      this.configSource = resolve(process.cwd(), 'config/tvbox.json');
      this.isRemote = false;
    } else if (typeof source === 'string') {
      this.configSource = source;
      this.isRemote = source.startsWith('http');
    } else {
      this.configSource = source.path;
      this.isRemote = source.type === 'remote';
    }
  }

  load(): TVBoxConfig {
    if (this.config) return this.config;

    if (this.isRemote) {
      const cached = this.loadFromCache();
      if (cached) {
        this.config = cached;
        return this.config;
      }
      throw new Error(`远程配置未缓存，请先执行 config pull: ${this.configSource}`);
    }

    const raw = readFileSync(this.configSource, 'utf-8');
    this.config = JSON.parse(raw) as TVBoxConfig;
    return this.config;
  }

  async loadAsync(): Promise<TVBoxConfig> {
    if (this.config) return this.config;

    if (this.isRemote) {
      this.config = await this.fetchRemote();
      this.saveToCache(this.config);
      return this.config;
    }

    const raw = readFileSync(this.configSource, 'utf-8');
    this.config = JSON.parse(raw) as TVBoxConfig;
    return this.config;
  }

  private async fetchRemote(): Promise<TVBoxConfig> {
    const resp = await axios.get(this.configSource, {
      timeout: 15000,
      headers: { 'User-Agent': 'TVBox-CLI/1.0' },
    });
    return resp.data as TVBoxConfig;
  }

  private getCachePath(): string {
    const hash = Buffer.from(this.configSource).toString('base64url').slice(0, 32);
    return resolve(CACHE_DIR, `${hash}.json`);
  }

  private loadFromCache(): TVBoxConfig | null {
    const cachePath = this.getCachePath();
    if (!existsSync(cachePath)) return null;
    const raw = readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw) as TVBoxConfig;
  }

  private saveToCache(config: TVBoxConfig) {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    writeFileSync(this.getCachePath(), JSON.stringify(config), 'utf-8');
  }

  reload() {
    this.config = null;
  }

  getSource(): string {
    return this.configSource;
  }

  isRemoteConfig(): boolean {
    return this.isRemote;
  }

  getSites(): SiteConfig[] {
    return this.load().sites;
  }

  getSearchableSites(): SiteConfig[] {
    return this.load().sites.filter(s => s.searchable === 1);
  }

  getParses(): ParseConfig[] {
    return this.load().parses;
  }

  getLives(): LiveConfig[] {
    return this.load().lives;
  }

  getRules(): RuleConfig[] {
    return this.load().rules;
  }

  getSiteByKey(key: string): SiteConfig | undefined {
    return this.load().sites.find(s => s.key === key);
  }

  getProxy(): string[] {
    return this.load().proxy;
  }
}
