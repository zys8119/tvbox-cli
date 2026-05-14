import * as readline from 'readline';
import chalk from 'chalk';
import { createServices, getStore, type Services } from '../index.js';
import { formatSiteList, formatVideoList, formatCategories, formatChannels } from '../utils/format.js';
import type { VideoItem } from '../types/index.js';

export async function interactiveMode() {
  const services = createServices();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  let running = true;
  let currentAbort: AbortController | null = null;

  // Ctrl+C cancels current operation instead of exiting
  rl.on('SIGINT', () => {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
      console.log(chalk.yellow('\n  已取消'));
    } else {
      // No operation running, show hint
      console.log(chalk.dim('\n  按 Ctrl+C 取消操作，输入 quit 退出'));
      rl.prompt();
    }
  });

  const ask = (q: string) => new Promise<string>((resolve, reject) => {
    if (!running) return reject(new Error('closed'));
    rl.question(q, (answer) => resolve(answer));
  });

  rl.on('close', () => {
    running = false;
  });

  console.log(chalk.bold('\n  TVBox CLI - 交互模式\n'));
  console.log(chalk.dim('  输入 help 查看命令，Ctrl+C 取消操作，quit 退出\n'));

  let lastResults: VideoItem[] = [];

  while (running) {
    let input: string;
    try {
      input = await ask(chalk.cyan('  tvbox> '));
    } catch {
      break;
    }
    if (!running) break;
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === 'quit' || trimmed === 'exit' || trimmed === 'q') {
      break;
    }

    const [cmd, ...args] = trimmed.split(/\s+/);

    // Create abort controller for this operation
    currentAbort = new AbortController();
    const signal = currentAbort.signal;

    try {
      switch (cmd) {
        case 'help':
        case 'h':
          printHelp();
          break;

        case 'sites':
        case 'ls':
          await handleSites(services, args);
          break;

        case 'cat':
          await handleCategories(services, args, signal);
          break;

        case 'search':
        case 's':
          lastResults = await handleSearch(services, args, signal);
          break;

        case 'detail':
        case 'd':
          await handleDetail(services, args, lastResults, signal);
          break;

        case 'play':
        case 'p':
          await handlePlay(services, args, lastResults);
          break;

        case 'live':
          await handleLive(services, args, signal);
          break;

        case 'parse':
          await handleParse(services, args);
          break;

        case 'fav':
        case 'favorite':
          handleFav(services, args, lastResults);
          break;

        case 'history':
        case 'hist':
          handleHistory(services);
          break;

        case 'config':
        case 'cfg':
          handleConfig(args);
          break;

        default:
          lastResults = await handleSearch(services, [trimmed], signal);
          break;
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || signal.aborted) {
        // Already printed cancel message in SIGINT handler
      } else {
        console.log(chalk.red(`  错误: ${e.message}\n`));
      }
    } finally {
      currentAbort = null;
    }
  }

  rl.close();
  console.log(chalk.dim('\n  再见!\n'));
}

function printHelp() {
  console.log(chalk.bold('\n  可用命令:\n'));
  console.log('  sites [-a]              列出站点 (-a 显示全部)');
  console.log('  cat <站点key>           浏览分类');
  console.log('  cat <站点key> <分类id>  浏览分类内容');
  console.log('  search <关键词>         搜索 (可简写为 s)');
  console.log('  detail <站点key> <id>   查看详情 (可简写为 d)');
  console.log('  detail <序号>           查看上次搜索结果的详情');
  console.log('  play <url>              播放URL (可简写为 p)');
  console.log('  play <序号>             播放上次搜索结果');
  console.log('  live                    直播源');
  console.log('  live <频道名>           播放直播频道');
  console.log('  parse <url>             解析视频URL');
  console.log('  fav                     查看收藏');
  console.log('  fav add <序号>          收藏搜索结果');
  console.log('  fav rm <序号>           取消收藏');
  console.log('  history                 查看观看记录');
  console.log('  config                  查看配置列表');
  console.log('  config add <名称> <路径> 添加配置');
  console.log('  config use <名称>       切换配置');
  console.log('  help                    显示帮助');
  console.log('  quit                    退出');
  console.log();
}

async function handleSites(services: Services, args: string[]) {
  const sites = services.siteService.listSites();
  const showAll = args.includes('-a') || args.includes('--all');

  if (showAll) {
    formatSiteList(sites);
  } else {
    const supported = sites.filter(s => s.supported);
    formatSiteList(supported.map(s => ({ ...s, supported: true })));
    console.log(chalk.dim(`  共 ${sites.length} 个站点，${supported.length} 个可用\n`));
  }
}

async function handleCategories(services: Services, args: string[], signal?: AbortSignal) {
  if (args.length === 0) {
    console.log(chalk.yellow('  用法: cat <站点key> [分类id] [页码]'));
    return;
  }

  const siteKey = args[0];
  const categoryId = args[1];
  const page = parseInt(args[2] ?? '1');
  const adapter = services.siteService.getAdapter(siteKey);

  if (!adapter.supported) {
    console.log(chalk.yellow('  该站点不支持直接访问'));
    return;
  }

  if (categoryId) {
    console.log(chalk.dim('  加载列表...'));
    if (signal?.aborted) return;
    const items = await adapter.getList(categoryId, page);
    if (signal?.aborted) return;
    formatVideoList(items);
  } else {
    console.log(chalk.dim('  加载分类...'));
    if (signal?.aborted) return;
    const categories = await adapter.getCategories();
    if (signal?.aborted) return;
    formatCategories(categories);
  }
}

async function handleSearch(services: Services, args: string[], signal?: AbortSignal): Promise<VideoItem[]> {
  if (args.length === 0) {
    console.log(chalk.yellow('  用法: search <关键词> [-s 站点key]'));
    return [];
  }

  const siteIdx = args.indexOf('-s');
  let siteKeys: string[] | undefined;
  let keyword: string;

  if (siteIdx >= 0 && args[siteIdx + 1]) {
    siteKeys = [args[siteIdx + 1]];
    keyword = args.filter((_, i) => i !== siteIdx && i !== siteIdx + 1).join(' ');
  } else {
    keyword = args.join(' ');
  }

  console.log(chalk.dim(`  搜索 "${keyword}"...`));
  const results = await services.searchService.searchAll(keyword, { siteKeys, signal });
  if (signal?.aborted) return [];
  formatVideoList(results);
  return results;
}

async function handleDetail(services: Services, args: string[], lastResults: VideoItem[], signal?: AbortSignal) {
  if (args.length === 1 && /^\d+$/.test(args[0])) {
    const idx = parseInt(args[0]) - 1;
    if (idx >= 0 && idx < lastResults.length) {
      const item = lastResults[idx];
      console.log(chalk.dim('  加载详情...'));
      if (signal?.aborted) return;
      const detail = await services.detailService.getDetail(item.siteKey, item.id);
      if (signal?.aborted) return;
      printDetail(detail);
      return;
    }
    console.log(chalk.yellow('  序号超出范围'));
    return;
  }

  if (args.length < 2) {
    console.log(chalk.yellow('  用法: detail <站点key> <videoId> 或 detail <序号>'));
    return;
  }

  console.log(chalk.dim('  加载详情...'));
  if (signal?.aborted) return;
  const detail = await services.detailService.getDetail(args[0], args[1]);
  if (signal?.aborted) return;
  printDetail(detail);
}

function printDetail(detail: any) {
  console.log(chalk.bold(`\n  ${detail.name}\n`));
  if (detail.year) console.log(`  年份: ${detail.year}`);
  if (detail.area) console.log(`  地区: ${detail.area}`);
  if (detail.type) console.log(`  类型: ${detail.type}`);
  if (detail.actor) console.log(`  演员: ${detail.actor}`);
  if (detail.director) console.log(`  导演: ${detail.director}`);
  if (detail.description) {
    const desc = detail.description.length > 200
      ? detail.description.substring(0, 200) + '...'
      : detail.description;
    console.log(`  简介: ${chalk.dim(desc)}`);
  }

  if (detail.playList?.length > 0) {
    console.log(chalk.bold('\n  播放列表:'));
    detail.playList.forEach((group: any) => {
      console.log(chalk.cyan(`\n  [${group.name}] (${group.episodes.length}集)`));
      const displayEps = group.episodes.slice(0, 20);
      displayEps.forEach((ep: any, ei: number) => {
        console.log(`    ${chalk.gray(`${ei + 1}.`)} ${ep.name} ${chalk.dim(ep.url)}`);
      });
      if (group.episodes.length > 20) {
        console.log(chalk.dim(`    ... 共 ${group.episodes.length} 集`));
      }
    });
  }
  console.log();
}

async function handlePlay(services: Services, args: string[], lastResults: VideoItem[]) {
  if (args.length === 0) {
    console.log(chalk.yellow('  用法: play <url> 或 play <序号>'));
    return;
  }

  let url = args[0];

  if (/^\d+$/.test(url)) {
    const idx = parseInt(url) - 1;
    if (idx >= 0 && idx < lastResults.length) {
      const item = lastResults[idx];
      console.log(chalk.dim('  获取播放地址...'));
      const detail = await services.detailService.getDetail(item.siteKey, item.id);

      if (detail.playList.length > 0 && detail.playList[0].episodes.length > 0) {
        url = detail.playList[0].episodes[0].url;
        console.log(chalk.dim(`  播放: ${detail.name} - ${detail.playList[0].episodes[0].name}`));
      } else {
        console.log(chalk.yellow('  没有可播放的内容'));
        return;
      }
    } else {
      console.log(chalk.yellow('  序号超出范围'));
      return;
    }
  }

  const useParser = args.includes('--parse');
  if (useParser) {
    const result = await services.parseService.parse(url);
    if (result) {
      url = result.url;
      console.log(chalk.green(`  解析成功`));
    }
  }

  await services.playerService.play(url);
}

async function handleLive(services: Services, args: string[], signal?: AbortSignal) {
  console.log(chalk.dim('  加载直播源...'));
  if (signal?.aborted) return;
  const channels = await services.liveService.getChannels();
  if (signal?.aborted) return;

  if (channels.length === 0) {
    console.log(chalk.yellow('\n  没有可用的直播源\n'));
    return;
  }

  if (args.length > 0) {
    const keyword = args.join(' ');
    const ch = channels.find(c => c.name.toLowerCase().includes(keyword.toLowerCase()));
    if (ch) {
      console.log(chalk.green(`\n  播放: ${ch.name}`));
      await services.playerService.play(ch.urls[0]);
    } else {
      const filtered = channels.filter(c => c.name.toLowerCase().includes(keyword.toLowerCase()));
      if (filtered.length > 0) {
        formatChannels(filtered);
      } else {
        console.log(chalk.yellow(`\n  未找到频道: ${keyword}\n`));
      }
    }
    return;
  }

  formatChannels(channels);
  console.log(chalk.dim(`  共 ${channels.length} 个频道\n`));
}

async function handleParse(services: Services, args: string[]) {
  if (args.length === 0) {
    const parses = services.parseService.getAllParses();
    console.log(chalk.bold('\n  可用解析接口:\n'));
    parses.forEach((p, i) => {
      const typeLabel = p.type === 0 ? '单接口' : p.type === 3 ? '聚合' : `类型${p.type}`;
      console.log(`  ${chalk.gray(`${i + 1}.`)} ${p.name} ${chalk.dim(`[${typeLabel}]`)}`);
    });
    console.log();
    return;
  }

  const url = args[0];
  console.log(chalk.dim('  解析中...'));
  const result = await services.parseService.parse(url);

  if (result) {
    console.log(chalk.green(`\n  解析成功: ${result.url}\n`));
  } else {
    console.log(chalk.yellow('\n  解析失败\n'));
  }
}

function handleFav(_services: Services, args: string[], lastResults: VideoItem[]) {
  const store = getStore();

  if (args.length === 0) {
    const favs = store.getFavorites();
    if (favs.length === 0) {
      console.log(chalk.yellow('\n  收藏夹为空\n'));
      return;
    }
    console.log(chalk.bold(`\n  收藏夹 (${favs.length}):\n`));
    favs.forEach((f, i) => {
      console.log(`  ${chalk.gray(`${i + 1}.`)} ${f.name} ${chalk.cyan(`@${f.siteKey}`)} ${chalk.dim(f.addedAt)}`);
    });
    console.log();
    return;
  }

  const subCmd = args[0];

  if (subCmd === 'add' && args[1]) {
    const idx = parseInt(args[1]) - 1;
    if (idx >= 0 && idx < lastResults.length) {
      const item = lastResults[idx];
      store.addFavorite(item.siteKey, item.id, item.name, item.pic);
      console.log(chalk.green(`  已收藏: ${item.name}`));
    } else {
      console.log(chalk.yellow('  序号超出范围'));
    }
    return;
  }

  if (subCmd === 'rm' && args[1]) {
    const favs = store.getFavorites();
    const idx = parseInt(args[1]) - 1;
    if (idx >= 0 && idx < favs.length) {
      store.removeFavorite(favs[idx].siteKey, favs[idx].videoId);
      console.log(chalk.green(`  已取消收藏: ${favs[idx].name}`));
    } else {
      console.log(chalk.yellow('  序号超出范围'));
    }
    return;
  }

  console.log(chalk.yellow('  用法: fav / fav add <序号> / fav rm <序号>'));
}

function handleHistory(_services: Services) {
  const store = getStore();
  const history = store.getHistory();

  if (history.length === 0) {
    console.log(chalk.yellow('\n  暂无观看记录\n'));
    return;
  }

  console.log(chalk.bold(`\n  观看记录 (${history.length}):\n`));
  history.forEach((h, i) => {
    const ep = h.episode ? chalk.dim(` [${h.episode}]`) : '';
    console.log(`  ${chalk.gray(`${i + 1}.`)} ${h.name}${ep} ${chalk.cyan(`@${h.siteKey}`)} ${chalk.dim(h.watchedAt)}`);
  });
  console.log();
}

function handleConfig(args: string[]) {
  const store = getStore();

  if (args.length === 0 || args[0] === 'ls') {
    const configs = store.getConfigs();
    const active = store.getActiveConfigName();
    console.log(chalk.bold('\n  配置列表:\n'));
    configs.forEach((c, i) => {
      const marker = c.name === active ? chalk.green('●') : ' ';
      const typeLabel = c.type === 'remote' ? chalk.cyan('[远程]') : chalk.dim('[本地]');
      console.log(`  ${marker} ${chalk.gray(`${i + 1}.`)} ${chalk.bold(c.name)} ${typeLabel} ${chalk.dim(c.path)}`);
    });
    console.log();
    return;
  }

  const subCmd = args[0];

  if (subCmd === 'add' && args[1] && args[2]) {
    const type = args[2].startsWith('http') ? 'remote' : 'local';
    store.addConfig(args[1], args[2], type as 'local' | 'remote');
    console.log(chalk.green(`  已添加配置: ${args[1]} [${type}]`));
    return;
  }

  if (subCmd === 'use' && args[1]) {
    try {
      store.setActiveConfig(args[1]);
      console.log(chalk.green(`  已切换到: ${args[1]}`));
    } catch (e: any) {
      console.log(chalk.red(`  ${e.message}`));
    }
    return;
  }

  if (subCmd === 'rm' && args[1]) {
    try {
      store.removeConfig(args[1]);
      console.log(chalk.green(`  已删除: ${args[1]}`));
    } catch (e: any) {
      console.log(chalk.red(`  ${e.message}`));
    }
    return;
  }

  console.log(chalk.yellow('  用法: config [ls] / config add <名称> <路径或URL> / config use <名称> / config rm <名称>'));
}
