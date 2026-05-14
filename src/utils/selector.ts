import { execFileSync } from 'child_process';
import * as readline from 'readline';
import chalk from 'chalk';

export interface SelectOption {
  label: string;
  value: string;
  extra?: string;
}

export interface SelectResult {
  label: string;
  value: string;
  index: number;
}

function hasFzf(): boolean {
  try {
    execFileSync('which', ['fzf'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function fzfSelect(
  items: SelectOption[],
  options?: {
    prompt?: string;
    header?: string;
    multi?: boolean;
    reverse?: boolean;
    preview?: string;
  }
): Promise<SelectResult | null> {
  if (items.length === 0) return null;

  if (hasFzf()) {
    return fzfNative(items, options);
  }
  return fallbackSelect(items, options);
}

export async function fzfSelectMulti(
  items: SelectOption[],
  options?: {
    prompt?: string;
    header?: string;
    reverse?: boolean;
  }
): Promise<SelectResult[]> {
  if (items.length === 0) return [];

  if (hasFzf()) {
    const results = await fzfNativeMulti(items, options);
    return results;
  }
  const result = await fallbackSelect(items, options);
  return result ? [result] : [];
}

function fzfNative(
  items: SelectOption[],
  options?: { prompt?: string; header?: string; reverse?: boolean }
): SelectResult | null {
  const input = items.map((item, i) => `${i}\t${item.label}`).join('\n');

  const args = [
    '--with-nth=2..',
    '--delimiter=\t',
    '--ansi',
    '--no-multi',
  ];

  if (options?.prompt) args.push(`--prompt=${options.prompt} `);
  if (options?.header) args.push(`--header=${options.header}`);
  if (options?.reverse !== false) args.push('--tac');
  args.push('--height=40%');
  args.push('--layout=reverse');

  try {
    const result = execFileSync('fzf', args, {
      input,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'inherit'],
    }).trim();

    if (!result) return null;
    const tabIdx = result.indexOf('\t');
    const index = parseInt(result.substring(0, tabIdx));
    return {
      label: items[index].label,
      value: items[index].value,
      index,
    };
  } catch {
    return null;
  }
}

function fzfNativeMulti(
  items: SelectOption[],
  options?: { prompt?: string; header?: string; reverse?: boolean }
): SelectResult[] {
  const input = items.map((item, i) => `${i}\t${item.label}`).join('\n');

  const args = [
    '--with-nth=2..',
    '--delimiter=\t',
    '--ansi',
    '--multi',
  ];

  if (options?.prompt) args.push(`--prompt=${options.prompt} `);
  if (options?.header) args.push(`--header=${options.header}`);
  if (options?.reverse !== false) args.push('--tac');
  args.push('--height=40%');
  args.push('--layout=reverse');

  try {
    const result = execFileSync('fzf', args, {
      input,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'inherit'],
    }).trim();

    if (!result) return [];
    return result.split('\n').map(line => {
      const tabIdx = line.indexOf('\t');
      const index = parseInt(line.substring(0, tabIdx));
      return { label: items[index].label, value: items[index].value, index };
    });
  } catch {
    return [];
  }
}

async function fallbackSelect(
  items: SelectOption[],
  options?: { prompt?: string; header?: string; reverse?: boolean }
): Promise<SelectResult | null> {
  const displayItems = options?.reverse !== false ? [...items].reverse() : items;
  const pageSize = 20;
  let page = 0;
  const totalPages = Math.ceil(displayItems.length / pageSize);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  if (options?.header) console.log(chalk.dim(`  ${options.header}`));

  while (true) {
    const start = page * pageSize;
    const pageItems = displayItems.slice(start, start + pageSize);

    console.log();
    pageItems.forEach((item, i) => {
      const idx = start + i + 1;
      console.log(`  ${chalk.gray(`${String(idx).padStart(3)}.`)} ${item.label}`);
    });
    console.log(chalk.dim(`\n  第 ${page + 1}/${totalPages} 页 | n:下页 p:上页 /关键词:搜索 序号:选择 q:取消`));

    const input = await ask(chalk.cyan(`  ${options?.prompt ?? '选择'}> `));
    const trimmed = input.trim();

    if (trimmed === 'q' || trimmed === '') {
      rl.close();
      return null;
    }

    if (trimmed === 'n' && page < totalPages - 1) {
      page++;
      continue;
    }
    if (trimmed === 'p' && page > 0) {
      page--;
      continue;
    }

    if (/^\d+$/.test(trimmed)) {
      const idx = parseInt(trimmed) - 1;
      if (idx >= 0 && idx < displayItems.length) {
        rl.close();
        const originalIdx = options?.reverse !== false
          ? items.length - 1 - idx
          : idx;
        return { label: items[originalIdx].label, value: items[originalIdx].value, index: originalIdx };
      }
    }

    // Search/filter
    if (trimmed.startsWith('/')) {
      const keyword = trimmed.slice(1).toLowerCase();
      const matches = items
        .map((item, i) => ({ ...item, index: i }))
        .filter(item => item.label.toLowerCase().includes(keyword));

      if (matches.length === 0) {
        console.log(chalk.yellow('  未找到匹配项'));
        continue;
      }

      console.log(chalk.bold(`\n  搜索结果 (${matches.length}):`));
      matches.slice(0, 20).forEach((item, i) => {
        console.log(`  ${chalk.gray(`${i + 1}.`)} ${item.label}`);
      });

      const pick = await ask(chalk.cyan('  选择序号> '));
      const pickIdx = parseInt(pick.trim()) - 1;
      if (pickIdx >= 0 && pickIdx < matches.length) {
        rl.close();
        const m = matches[pickIdx];
        return { label: m.label, value: m.value, index: m.index };
      }
      continue;
    }
  }
}

export async function actionMenu(selected: SelectResult): Promise<string | null> {
  const actions: SelectOption[] = [
    { label: '▶ 播放', value: 'play' },
    { label: '🔍 解析视频资源', value: 'parse' },
    { label: '📄 查看详情', value: 'detail' },
    { label: '⭐ 收藏', value: 'fav' },
    { label: '📋 复制 URL', value: 'copy-url' },
    { label: '📋 复制名称', value: 'copy-name' },
  ];

  const result = await fzfSelect(actions, {
    prompt: '操作',
    header: `已选: ${selected.label}`,
    reverse: false,
  });

  return result?.value ?? null;
}

export function copyToClipboard(text: string) {
  try {
    execFileSync('pbcopy', [], { input: text, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    try {
      execFileSync('xclip', ['-selection', 'clipboard'], { input: text, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      console.log(chalk.dim(`  (无法复制到剪贴板) ${text}`));
    }
  }
}
