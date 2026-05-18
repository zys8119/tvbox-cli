import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import axios from 'axios';
import { isMultiRepoConfig, type TVBoxConfig, type SiteConfig, type ParseConfig, type LiveConfig, type RuleConfig, type MultiRepoEntry } from '../types/index.js';
import type { ConfigEntry } from '../store/index.js';

const CACHE_DIR = resolve(homedir(), '.tvbox', 'cache');

export interface ConfigLoaderOptions {
  resolveMultiRepo?: (entries: MultiRepoEntry[]) => Promise<string | null>;
}

export class ConfigLoader {
  private config: TVBoxConfig | null = null;
  private configSource: string;
  private isRemote: boolean;
  private resolveMultiRepo?: (entries: MultiRepoEntry[]) => Promise<string | null>;

  constructor(source?: string | ConfigEntry, options?: ConfigLoaderOptions) {
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
    this.resolveMultiRepo = options?.resolveMultiRepo;
  }

  load(): TVBoxConfig {
    if (this.config) return this.config;

    if (this.isRemote) {
      const cached = this.loadFromCache();
      if (cached) {
        this.config = cached;
        return this.config;
      }
      // No cache — cannot load synchronously, throw with guidance
      throw new Error(`远程配置未缓存，请先执行 config pull: ${this.configSource}`);
    }

    const raw = readFileSync(this.configSource, 'utf-8');
    this.config = JSON.parse(raw) as TVBoxConfig;
    return this.config;
  }

  async loadAsync(): Promise<TVBoxConfig> {
    if (this.config) return this.config;

    if (this.isRemote) {
      const cached = this.loadFromCache();
      if (cached) {
        this.config = cached;
        return this.config;
      }

      const raw = await this.fetchRemoteRaw();
      this.config = await this.resolveConfig(raw);
      this.saveToCache(this.config);
      return this.config;
    }

    const raw = JSON.parse(readFileSync(this.configSource, 'utf-8'));
    this.config = await this.resolveConfig(raw);
    return this.config;
  }

  private async fetchRemoteRaw(): Promise<unknown> {
    const resp = await axios.get(this.configSource, {
      timeout: 15000,
      headers: { 'User-Agent': 'TVBox-CLI/1.0' },
    });
    return resp.data;
  }

  private async resolveConfig(raw: unknown): Promise<TVBoxConfig> {
    if (isMultiRepoConfig(raw)) {
      if (!this.resolveMultiRepo) {
        throw new Error('检测到多仓配置，但未提供选择器。请通过交互模式或 config select 命令选择子配置。');
      }
      const selectedUrl = await this.resolveMultiRepo(raw.urls);
      if (!selectedUrl) {
        throw new Error('未选择子配置源');
      }
      const resp = await axios.get(selectedUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'TVBox-CLI/1.0' },
      });
      const subConfig = resp.data;
      if (typeof subConfig !== 'object' || subConfig === null || !Array.isArray(subConfig.sites)) {
        throw new Error(`子配置源返回的数据无效 (缺少 sites 字段): ${selectedUrl}`);
      }
      return subConfig as TVBoxConfig;
    }
    return raw as TVBoxConfig;
  }

  private getCachePath(): string {
    const hash = Buffer.from(this.configSource).toString('base64url').slice(0, 32);
    return resolve(CACHE_DIR, `${hash}.json`);
  }

  private loadFromCache(): TVBoxConfig | null {
    const cachePath = this.getCachePath();
    if (!existsSync(cachePath)) return null;
    const raw = readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (isMultiRepoConfig(parsed)) return null;
    return parsed as TVBoxConfig;
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
    return this.load().sites ?? [];
  }

  getSearchableSites(): SiteConfig[] {
    return (this.load().sites ?? []).filter(s => s.searchable === 1);
  }

  getParses(): ParseConfig[] {
    return this.load().parses ?? [];
  }

  getLives(): LiveConfig[] {
    return this.load().lives ?? [];
  }

  getRules(): RuleConfig[] {
    return this.load().rules ?? [];
  }

  getSiteByKey(key: string): SiteConfig | undefined {
    return (this.load().sites ?? []).find(s => s.key === key);
  }

  getProxy(): string[] {
    return this.load().proxy ?? [];
  }
}
