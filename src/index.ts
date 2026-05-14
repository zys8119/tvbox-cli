import { createHttpClient, type ProxyConfig } from './utils/http.js';
import { ConfigLoader } from './config/loader.js';
import { Store } from './store/index.js';
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
  store: Store;
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

let _store: Store | undefined;

export function getStore(): Store {
  if (!_store) {
    _store = new Store();
  }
  return _store;
}

export function createServices(options?: CreateServicesOptions): Services {
  const store = getStore();

  // Determine config source: explicit path > active config from store
  let configSource: string | undefined = options?.configPath;
  if (!configSource) {
    const activeConfig = store.getActiveConfig();
    configSource = activeConfig.path;
  }

  const config = new ConfigLoader(configSource);
  const proxy = options?.proxy ?? _globalProxy;
  const http = createHttpClient({ proxy });

  const siteService = new SiteService(config, http);
  const searchService = new SearchService(siteService, config);
  const detailService = new DetailService(siteService);
  const playerService = new PlayerService();
  const liveService = new LiveService(config, http);
  const parseService = new ParseService(config, http);

  return {
    store,
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
export { Store } from './store/index.js';
export { SiteService } from './services/site.service.js';
export { SearchService } from './services/search.service.js';
export { DetailService } from './services/detail.service.js';
export { PlayerService } from './services/player.service.js';
export { LiveService } from './services/live.service.js';
export { ParseService } from './services/parse.service.js';
export * from './types/index.js';
