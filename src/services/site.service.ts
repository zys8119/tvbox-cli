import type { AxiosInstance } from 'axios';
import type { SiteConfig } from '../types/index.js';
import type { SiteAdapter } from '../adapters/base.js';
import { AdapterRegistry } from '../adapters/registry.js';
import { ConfigLoader } from '../config/loader.js';

export class SiteService {
  private registry: AdapterRegistry;

  constructor(
    private config: ConfigLoader,
    private http: AxiosInstance,
  ) {
    this.registry = new AdapterRegistry();
  }

  listSites(): Array<{ key: string; name: string; adapter: string; supported: boolean }> {
    return this.config.getSites().map(s => {
      const adapter = this.registry.createAdapter(s, this.http);
      return {
        key: s.key,
        name: s.name,
        adapter: adapter.adapterName,
        supported: adapter.supported,
      };
    });
  }

  listSupportedSites(): Array<{ key: string; name: string; adapter: string; supported: boolean }> {
    return this.listSites().filter(s => s.supported);
  }

  getAdapter(siteKey: string): SiteAdapter {
    const site = this.config.getSiteByKey(siteKey);
    if (!site) throw new Error(`站点未找到: ${siteKey}`);
    return this.registry.createAdapter(site, this.http);
  }

  getSiteConfig(siteKey: string): SiteConfig | undefined {
    return this.config.getSiteByKey(siteKey);
  }
}
