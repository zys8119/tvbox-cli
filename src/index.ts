import { createHttpClient, type ProxyConfig } from './utils/http.js';
import { ConfigLoader } from './config/loader.js';
import { SiteService } from './services/site.service.js';
import { SearchService } from './services/search.service.js';
import { DetailService } from './services/detail.service.js';
import { PlayerService } from './services/player.service.js';
import { LiveService } from './services/live.service.js';
import { ParseService } from './services/parse.service.js';

let _globalProxy: ProxyConfig | undefined;

export function setGlobalProxy(proxy: ProxyConfig | undefined) {
  _globalProxy = proxy;
}

export function getGlobalProxy(): ProxyConfig | undefined {
  return _globalProxy;
}

export interface Services {
  config: ConfigLoader;
  siteService: SiteService;
  searchService: SearchService;
  detailService: DetailService;
  playerService: PlayerService;
  liveService: LiveService;
  parseService: ParseService;
}

export interface CreateServicesOptions {
  configPath?: string;
  proxy?: ProxyConfig;
}

export function createServices(options?: CreateServicesOptions): Services {
  const config = new ConfigLoader(options?.configPath);
  const proxy = options?.proxy ?? _globalProxy;
  const http = createHttpClient({ proxy });

  const siteService = new SiteService(config, http);
  const searchService = new SearchService(siteService, config);
  const detailService = new DetailService(siteService);
  const playerService = new PlayerService();
  const liveService = new LiveService(config, http);
  const parseService = new ParseService(config, http);

  return {
    config,
    siteService,
    searchService,
    detailService,
    playerService,
    liveService,
    parseService,
  };
}

export { ConfigLoader } from './config/loader.js';
export { SiteService } from './services/site.service.js';
export { SearchService } from './services/search.service.js';
export { DetailService } from './services/detail.service.js';
export { PlayerService } from './services/player.service.js';
export { LiveService } from './services/live.service.js';
export { ParseService } from './services/parse.service.js';
export * from './types/index.js';
