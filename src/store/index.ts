import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const DATA_DIR = resolve(homedir(), '.tvbox');
const DB_PATH = resolve(DATA_DIR, 'tvbox.db');

export interface FavoriteItem {
  id?: number;
  siteKey: string;
  videoId: string;
  name: string;
  pic?: string;
  addedAt: string;
}

export interface HistoryItem {
  id?: number;
  siteKey: string;
  videoId: string;
  name: string;
  episode?: string;
  watchedAt: string;
}

export interface ConfigEntry {
  id?: number;
  name: string;
  path: string;
  type: 'local' | 'remote';
}

export interface AppSettings {
  proxy?: string;
  player?: string;
  searchTimeout?: number;
  searchConcurrency?: number;
}

export class Store {
  private db: Database.Database;

  constructor() {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'local'
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_key TEXT NOT NULL,
        video_id TEXT NOT NULL,
        name TEXT NOT NULL,
        pic TEXT,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(site_key, video_id)
      );

      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_key TEXT NOT NULL,
        video_id TEXT NOT NULL,
        name TEXT NOT NULL,
        episode TEXT,
        watched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS search_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_name TEXT NOT NULL,
        keyword TEXT NOT NULL,
        results TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(config_name, keyword)
      );

      CREATE TABLE IF NOT EXISTS detail_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_name TEXT NOT NULL,
        site_key TEXT NOT NULL,
        video_id TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(config_name, site_key, video_id)
      );
    `);

    // Ensure default config exists
    const defaultConfig = this.db.prepare('SELECT id FROM configs WHERE name = ?').get('default');
    if (!defaultConfig) {
      this.db.prepare('INSERT INTO configs (name, path, type) VALUES (?, ?, ?)').run(
        'default',
        resolve(process.cwd(), 'config/tvbox.json'),
        'local'
      );
    }

    // Ensure active_config setting exists
    const active = this.db.prepare("SELECT value FROM settings WHERE key = 'active_config'").get();
    if (!active) {
      this.db.prepare("INSERT INTO settings (key, value) VALUES ('active_config', 'default')").run();
    }
  }

  // Configs
  getConfigs(): ConfigEntry[] {
    return this.db.prepare('SELECT * FROM configs ORDER BY id').all() as ConfigEntry[];
  }

  getActiveConfigName(): string {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'active_config'").get() as { value: string } | undefined;
    return row?.value ?? 'default';
  }

  getActiveConfig(): ConfigEntry {
    const name = this.getActiveConfigName();
    const config = this.db.prepare('SELECT * FROM configs WHERE name = ?').get(name) as ConfigEntry | undefined;
    return config ?? this.db.prepare('SELECT * FROM configs WHERE name = ?').get('default') as ConfigEntry;
  }

  setActiveConfig(name: string) {
    const exists = this.db.prepare('SELECT id FROM configs WHERE name = ?').get(name);
    if (!exists) throw new Error(`配置 "${name}" 不存在`);
    this.db.prepare("UPDATE settings SET value = ? WHERE key = 'active_config'").run(name);
  }

  addConfig(name: string, path: string, type: 'local' | 'remote') {
    this.db.prepare(
      'INSERT OR REPLACE INTO configs (name, path, type) VALUES (?, ?, ?)'
    ).run(name, path, type);
  }

  removeConfig(name: string) {
    if (name === 'default') throw new Error('不能删除默认配置');
    this.db.prepare('DELETE FROM configs WHERE name = ?').run(name);
    const active = this.getActiveConfigName();
    if (active === name) {
      this.setActiveConfig('default');
    }
  }

  // Favorites
  getFavorites(): FavoriteItem[] {
    return this.db.prepare(
      'SELECT id, site_key as siteKey, video_id as videoId, name, pic, added_at as addedAt FROM favorites ORDER BY added_at DESC'
    ).all() as FavoriteItem[];
  }

  addFavorite(siteKey: string, videoId: string, name: string, pic?: string) {
    this.db.prepare(
      'INSERT OR IGNORE INTO favorites (site_key, video_id, name, pic) VALUES (?, ?, ?, ?)'
    ).run(siteKey, videoId, name, pic ?? null);
  }

  removeFavorite(siteKey: string, videoId: string) {
    this.db.prepare('DELETE FROM favorites WHERE site_key = ? AND video_id = ?').run(siteKey, videoId);
  }

  isFavorite(siteKey: string, videoId: string): boolean {
    const row = this.db.prepare('SELECT id FROM favorites WHERE site_key = ? AND video_id = ?').get(siteKey, videoId);
    return !!row;
  }

  // History
  getHistory(limit = 50): HistoryItem[] {
    return this.db.prepare(
      'SELECT id, site_key as siteKey, video_id as videoId, name, episode, watched_at as watchedAt FROM history ORDER BY watched_at DESC LIMIT ?'
    ).all(limit) as HistoryItem[];
  }

  addHistory(siteKey: string, videoId: string, name: string, episode?: string) {
    // Remove old entry for same video
    this.db.prepare('DELETE FROM history WHERE site_key = ? AND video_id = ?').run(siteKey, videoId);
    this.db.prepare(
      'INSERT INTO history (site_key, video_id, name, episode) VALUES (?, ?, ?, ?)'
    ).run(siteKey, videoId, name, episode ?? null);
    // Keep max 200
    this.db.prepare(
      'DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY watched_at DESC LIMIT 200)'
    ).run();
  }

  clearHistory() {
    this.db.prepare('DELETE FROM history').run();
  }

  // Settings
  getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string) {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  deleteSetting(key: string) {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  getSettings(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      proxy: map['proxy'],
      player: map['player'],
      searchTimeout: map['search_timeout'] ? parseInt(map['search_timeout']) : undefined,
      searchConcurrency: map['search_concurrency'] ? parseInt(map['search_concurrency']) : undefined,
    };
  }

  // Search cache (1 day TTL)
  getSearchCache(configName: string, keyword: string): any[] | null {
    const row = this.db.prepare(
      "SELECT results FROM search_cache WHERE config_name = ? AND keyword = ? AND datetime(created_at, '+1 day') > datetime('now')"
    ).get(configName, keyword) as { results: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.results);
  }

  setSearchCache(configName: string, keyword: string, results: any[]) {
    this.db.prepare(
      'INSERT OR REPLACE INTO search_cache (config_name, keyword, results, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
    ).run(configName, keyword, JSON.stringify(results));
  }

  // Detail cache (1 day TTL)
  getDetailCache(configName: string, siteKey: string, videoId: string): any | null {
    const row = this.db.prepare(
      "SELECT detail FROM detail_cache WHERE config_name = ? AND site_key = ? AND video_id = ? AND datetime(created_at, '+1 day') > datetime('now')"
    ).get(configName, siteKey, videoId) as { detail: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.detail);
  }

  setDetailCache(configName: string, siteKey: string, videoId: string, detail: any) {
    this.db.prepare(
      'INSERT OR REPLACE INTO detail_cache (config_name, site_key, video_id, detail, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(configName, siteKey, videoId, JSON.stringify(detail));
  }

  clearExpiredCache() {
    this.db.prepare("DELETE FROM search_cache WHERE datetime(created_at, '+1 day') <= datetime('now')").run();
    this.db.prepare("DELETE FROM detail_cache WHERE datetime(created_at, '+1 day') <= datetime('now')").run();
  }

  clearAllCache() {
    this.db.prepare('DELETE FROM search_cache').run();
    this.db.prepare('DELETE FROM detail_cache').run();
  }

  close() {
    this.db.close();
  }
}
