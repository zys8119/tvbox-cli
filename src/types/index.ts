export interface TVBoxConfig {
  spider: string;
  wallpaper: string;
  sites: SiteConfig[];
  parses: ParseConfig[];
  lives: LiveConfig[];
  proxy: string[];
  rules: RuleConfig[];
  logo?: string;
}

export type SiteType = 0 | 1 | 3;

export interface SiteConfig {
  key: string;
  name: string;
  type: SiteType;
  api: string;
  ext?: string | Record<string, unknown>;
  searchable?: 0 | 1;
  filterable?: 0 | 1;
  quickSearch?: 0 | 1;
  changeable?: 0 | 1;
  switchable?: 0 | 1;
  playerType?: number;
  jar?: string;
  style?: Record<string, unknown>;
  genre?: string;
}

export interface Category {
  id: string;
  name: string;
  children?: Category[];
}

export interface VideoItem {
  id: string;
  name: string;
  pic?: string;
  remarks?: string;
  year?: string;
  area?: string;
  type?: string;
  siteKey: string;
}

export interface VideoDetail {
  id: string;
  name: string;
  pic?: string;
  year?: string;
  area?: string;
  type?: string;
  actor?: string;
  director?: string;
  description?: string;
  playList: PlayGroup[];
}

export interface PlayGroup {
  name: string;
  episodes: Episode[];
}

export interface Episode {
  name: string;
  url: string;
}

export interface ParseConfig {
  name: string;
  type: number;
  url: string;
  ext?: {
    flag?: string[];
    header?: Record<string, string>;
  };
}

export interface ParseResult {
  url: string;
  header?: Record<string, string>;
}

export interface LiveConfig {
  name: string;
  type: number;
  url: string;
  playerType?: number;
  ua?: string;
  epg?: string;
  logo?: string;
}

export interface LiveChannel {
  name: string;
  group: string;
  urls: string[];
  logo?: string;
}

export interface RuleConfig {
  name: string;
  hosts: string[];
  regex?: string[];
  script?: string[];
}
