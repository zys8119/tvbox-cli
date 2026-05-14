import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { TVBoxConfig, SiteConfig, ParseConfig, LiveConfig, RuleConfig } from '../types/index.js';

export class ConfigLoader {
  private config: TVBoxConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? resolve(process.cwd(), 'config/tvbox.json');
  }

  load(): TVBoxConfig {
    if (this.config) return this.config;
    const raw = readFileSync(this.configPath, 'utf-8');
    this.config = JSON.parse(raw) as TVBoxConfig;
    return this.config;
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
