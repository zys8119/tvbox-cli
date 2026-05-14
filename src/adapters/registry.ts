import type { AxiosInstance } from 'axios';
import type { SiteConfig } from '../types/index.js';
import type { SiteAdapter } from './base.js';
import { XBPQAdapter } from './xbpq.js';
import { KongbaiAdapter } from './kongbai.js';
import { CzzyAdapter } from './czzy.js';
import { DirectUrlAdapter } from './direct-url.js';
import { CmsApiAdapter } from './cms-api.js';
import { UnsupportedAdapter } from './unsupported.js';

export class AdapterRegistry {
  createAdapter(site: SiteConfig, http: AxiosInstance): SiteAdapter {
    if (site.type === 0 || site.type === 1) {
      return new CmsApiAdapter(site, http);
    }

    const api = site.api;

    if (api === 'csp_XBPQ') {
      return new XBPQAdapter(site, http);
    }

    if (api === 'csp_kongbai' || api === 'csp_Wogg') {
      return new KongbaiAdapter(site, http);
    }

    if (api === 'csp_CzzyAmns') {
      return new CzzyAdapter(site, http);
    }

    if (api === 'csp_SaoHuo' || api === 'csp_Dm84' || api === 'csp_MeijuMi') {
      return new DirectUrlAdapter(site, http);
    }

    if (['csp_Qiwei', 'csp_Star2', 'csp_PanTa', 'csp_PanSouFish'].includes(api)) {
      return new DirectUrlAdapter(site, http);
    }

    // Check if ext has a siteUrl we can use
    if (typeof site.ext === 'object' && site.ext !== null) {
      const ext = site.ext as Record<string, unknown>;
      if (ext['siteUrl']) {
        if (Array.isArray(ext['siteUrl'])) {
          return new KongbaiAdapter(site, http);
        }
        return new DirectUrlAdapter(site, http);
      }
      if (ext['sites'] && typeof ext['sites'] === 'string') {
        return new CzzyAdapter(site, http);
      }
    }

    // ext is a plain URL string (like csp_SaoHuo)
    if (typeof site.ext === 'string' && site.ext.startsWith('http')) {
      return new DirectUrlAdapter(site, http);
    }

    return new UnsupportedAdapter(site, http);
  }
}
