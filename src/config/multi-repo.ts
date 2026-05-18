import { fzfSelect } from '../utils/selector.js';
import type { Store } from '../store/index.js';
import type { MultiRepoEntry } from '../types/index.js';

export function createMultiRepoResolver(store: Store, configName: string) {
  const settingsKey = `multirepo_selected:${configName}`;

  return async (entries: MultiRepoEntry[]): Promise<string | null> => {
    const saved = store.getSetting(settingsKey);
    if (saved) {
      const stillExists = entries.find(e => e.url === saved);
      if (stillExists) return saved;
    }

    const items = entries.map(e => ({
      label: e.name,
      value: e.url,
    }));

    const selected = await fzfSelect(items, {
      prompt: '选择配置源',
      header: '多仓配置 - 请选择要使用的配置',
      reverse: false,
    });

    if (!selected) return null;

    store.setSetting(settingsKey, selected.value);
    return selected.value;
  };
}
