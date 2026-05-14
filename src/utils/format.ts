import chalk from 'chalk';
import type { VideoItem, Category, LiveChannel } from '../types/index.js';

export function formatSiteList(sites: Array<{ key: string; name: string; adapter: string; supported: boolean }>) {
  const supported = sites.filter(s => s.supported);
  const unsupported = sites.filter(s => !s.supported);

  console.log(chalk.bold(`\n  支持的站点 (${supported.length}):\n`));
  supported.forEach((s, i) => {
    console.log(`  ${chalk.gray(`${String(i + 1).padStart(2)}.`)} ${s.name} ${chalk.dim(`[${s.key}]`)} ${chalk.cyan(s.adapter)}`);
  });

  if (unsupported.length > 0) {
    console.log(chalk.bold(`\n  不支持的站点 (${unsupported.length}):\n`));
    unsupported.forEach((s, i) => {
      console.log(`  ${chalk.gray(`${String(i + 1).padStart(2)}.`)} ${chalk.dim(s.name)} ${chalk.dim(`[${s.key}]`)}`);
    });
  }
  console.log();
}

export function formatVideoList(items: VideoItem[]) {
  if (items.length === 0) {
    console.log(chalk.yellow('\n  没有找到结果\n'));
    return;
  }
  console.log(chalk.bold(`\n  找到 ${items.length} 个结果:\n`));
  items.forEach((item, i) => {
    const remarks = item.remarks ? chalk.yellow(` [${item.remarks}]`) : '';
    const site = chalk.cyan(` @${item.siteKey}`);
    console.log(`  ${chalk.gray(`${String(i + 1).padStart(2)}.`)} ${chalk.bold(item.name)}${remarks}${site}`);
  });
  console.log();
}

export function formatCategories(categories: Category[]) {
  console.log(chalk.bold('\n  分类列表:\n'));
  categories.forEach((cat, i) => {
    console.log(`  ${chalk.gray(`${String(i + 1).padStart(2)}.`)} ${cat.name} ${chalk.dim(`[${cat.id}]`)}`);
  });
  console.log();
}

export function formatChannels(channels: LiveChannel[]) {
  const groups = new Map<string, LiveChannel[]>();
  for (const ch of channels) {
    const list = groups.get(ch.group) ?? [];
    list.push(ch);
    groups.set(ch.group, list);
  }

  for (const [group, chs] of groups) {
    console.log(chalk.bold(`\n  ${group}:`));
    chs.forEach((ch, i) => {
      console.log(`    ${chalk.gray(`${String(i + 1).padStart(2)}.`)} ${ch.name}`);
    });
  }
  console.log();
}
