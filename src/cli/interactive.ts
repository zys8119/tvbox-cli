import * as readline from 'readline';
import chalk from 'chalk';
import { createServices, getStore, type Services } from '../index.js';
import { fzfSelect, actionMenu, copyToClipboard, openInBrowser } from '../utils/selector.js';
import { openPlayerInBrowser } from '../utils/player-html.js';
import type { SelectOption } from '../utils/selector.js';
import type { VideoItem } from '../types/index.js';

export async function interactiveMode() {
  const services = await createServices();

  const commands = ['sites', 'search', 'cat', 'detail', 'play', 'live', 'parse', 'fav', 'history', 'config', 'clear', 'help', 'quit'];
  const aliases: Record<string, string> = { s: 'search', d: 'detail', p: 'play', ls: 'sites', h: 'help', q: 'quit', hist: 'history', cfg: 'config' };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    completer: (line: string) => {
      const trimmed = line.trimStart();
      const parts = trimmed.split(/\s+/);

      if (parts.length <= 1) {
        const allCmds = [...commands, ...Object.keys(aliases)];
        const hits = allCmds.filter(c => c.startsWith(trimmed));
        return [hits.length ? hits : allCmds, trimmed];
      }

      const cmd = parts[0];
      if (cmd === 'config' || cmd === 'cfg') {
        const sub = parts[1] ?? '';
        const subs = ['ls', 'add', 'use', 'rm'];
        const hits = subs.filter(s => s.startsWith(sub));
        return [hits.map(h => `${cmd} ${h}`), line];
      }

      if (cmd === 'fav' || cmd === 'favorite') {
        const sub = parts[1] ?? '';
        const subs = ['add', 'rm'];
        const hits = subs.filter(s => s.startsWith(sub));
        return [hits.map(h => `${cmd} ${h}`), line];
      }

      if ((cmd === 'cat' || cmd === 'search' || cmd === 's') && parts.length === 2) {
        const partial = parts[1] ?? '';
        const siteKeys = services.siteService.listSites()
          .filter(s => s.supported)
          .map(s => s.key)
          .filter(k => k.startsWith(partial));
        return [siteKeys.map(k => `${cmd} ${k}`), line];
      }

      return [[], line];
    },
  });

  let running = true;
  let currentAbort: AbortController | null = null;

  rl.on('SIGINT', () => {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
      console.log(chalk.yellow('\n  已取消'));
    } else {
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
          await handleSites(services);
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
          await handleLive(services, signal);
          break;

        case 'parse':
          await handleParse(services, args);
          break;

        case 'fav':
        case 'favorite':
          await handleFav(services, args, lastResults);
          break;

        case 'history':
        case 'hist':
          await handleHistory(services);
          break;

        case 'config':
        case 'cfg':
          handleConfig(args);
          break;

        case 'clear':
          handleClear(args);
          break;

        default:
          lastResults = await handleSearch(services, [trimmed], signal);
          break;
      }
    } catch (e: any) {
      if (e.name === 'AbortError' || signal.aborted) {
        // cancelled
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
  console.log('  sites               列出站点 (fzf选择 → 浏览分类)');
  console.log('  cat <站点key>       浏览分类');
  console.log('  search <关键词>     搜索 (可简写为 s)');
  console.log('  detail <序号>       查看详情 (可简写为 d)');
  console.log('  play <url>          播放URL (可简写为 p)');
  console.log('  live                直播源');
  console.log('  parse <url>         解析视频URL');
  console.log('  fav                 收藏夹');
  console.log('  fav add <序号>      收藏搜索结果');
  console.log('  history             观看记录');
  console.log('  config              配置管理');
  console.log('  clear [cache|history|all]  清理缓存/历史');
  console.log('  help                显示帮助');
  console.log('  quit                退出');
  console.log();
}

// ─── Video item action menu (shared by search/fav/history) ───

async function videoItemAction(services: Services, item: VideoItem): Promise<void> {
  const result = { label: item.name, value: item.id, index: 0 };
  const action = await actionMenu(result);
  if (!action) return;

  switch (action) {
    case 'detail':
      await showDetail(services, item.siteKey, item.id);
      break;
    case 'play': {
      console.log(chalk.dim('  获取播放地址...'));
      const detail = await services.detailService.getDetail(item.siteKey, item.id);
      if (detail.playList.length > 0 && detail.playList[0].episodes.length > 0) {
        const ep = detail.playList[0].episodes[detail.playList[0].episodes.length - 1];
        await services.playerService.play(ep.url);
      } else {
        console.log(chalk.yellow('  没有可播放的内容'));
      }
      break;
    }
    case 'parse': {
      console.log(chalk.dim('  获取视频资源...'));
      const detail = await services.detailService.getDetail(item.siteKey, item.id);
      await showDetail(services, item.siteKey, item.id, detail);
      break;
    }
    case 'fav': {
      const store = getStore();
      store.addFavorite(item.siteKey, item.id, item.name, item.pic);
      console.log(chalk.green(`  已收藏: ${item.name}`));
      break;
    }
    case 'copy-url':
      copyToClipboard(item.id);
      console.log(chalk.green(`  已复制 ID: ${item.id}`));
      break;
    case 'copy-name':
      copyToClipboard(item.name);
      console.log(chalk.green(`  已复制: ${item.name}`));
      break;
    case 'open':
      openInBrowser(item.id.startsWith('http') ? item.id : `https://www.google.com/search?q=${encodeURIComponent(item.name)}`);
      break;
  }
}

// ─── Sites ───

async function handleSites(services: Services) {
  const sites = services.siteService.listSites().filter(s => s.supported);
  const items: SelectOption[] = sites.map(s => ({
    label: `${s.name} ${chalk.dim(`[${s.adapter}]`)}`,
    value: s.key,
  }));

  const selected = await fzfSelect(items, {
    prompt: '站点',
    header: `${sites.length} 个可用站点`,
    reverse: false,
  });

  if (!selected) return;

  // Selected a site → browse its categories
  const adapter = services.siteService.getAdapter(selected.value);
  console.log(chalk.dim('  加载分类...'));
  const categories = await adapter.getCategories();

  if (categories.length === 0) {
    console.log(chalk.yellow('  该站点无分类'));
    return;
  }

  const catItems: SelectOption[] = categories.map(c => ({
    label: c.name,
    value: c.id,
  }));

  const catResult = await fzfSelect(catItems, {
    prompt: '分类',
    header: `${selected.value} - 选择分类`,
    reverse: false,
  });

  if (!catResult) return;

  console.log(chalk.dim('  加载列表...'));
  const videos = await adapter.getList(catResult.value, 1);
  if (videos.length === 0) {
    console.log(chalk.yellow('  该分类暂无内容'));
    return;
  }

  await selectFromVideoList(services, videos);
}

// ─── Categories ───

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
    await selectFromVideoList(services, items);
  } else {
    console.log(chalk.dim('  加载分类...'));
    if (signal?.aborted) return;
    const categories = await adapter.getCategories();
    if (signal?.aborted) return;

    const catItems: SelectOption[] = categories.map(c => ({
      label: c.name,
      value: c.id,
    }));

    const catResult = await fzfSelect(catItems, {
      prompt: '分类',
      header: siteKey,
      reverse: false,
    });

    if (!catResult) return;

    console.log(chalk.dim('  加载列表...'));
    const items = await adapter.getList(catResult.value, 1);
    await selectFromVideoList(services, items);
  }
}

// ─── Search ───

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

  if (results.length === 0) {
    console.log(chalk.yellow('  没有找到结果'));
    return [];
  }

  console.log(chalk.dim(`  找到 ${results.length} 个结果`));
  await selectFromVideoList(services, results);
  return results;
}

// ─── Detail ───

async function handleDetail(services: Services, args: string[], lastResults: VideoItem[], signal?: AbortSignal) {
  if (args.length === 1 && /^\d+$/.test(args[0])) {
    const idx = parseInt(args[0]) - 1;
    if (idx >= 0 && idx < lastResults.length) {
      const item = lastResults[idx];
      if (signal?.aborted) return;
      await showDetail(services, item.siteKey, item.id);
      return;
    }
    console.log(chalk.yellow('  序号超出范围'));
    return;
  }

  if (args.length < 2) {
    // No args → fzf select from last results
    if (lastResults.length > 0) {
      await selectFromVideoList(services, lastResults);
      return;
    }
    console.log(chalk.yellow('  用法: detail <站点key> <videoId> 或 detail <序号>'));
    return;
  }

  if (signal?.aborted) return;
  await showDetail(services, args[0], args[1]);
}

// ─── Show detail with episode selection (loops until Esc/cancel) ───

async function showDetail(services: Services, siteKey: string, videoId: string, preloaded?: any) {
  const detail = preloaded ?? await (async () => {
    console.log(chalk.dim('  加载详情...'));
    return services.detailService.getDetail(siteKey, videoId);
  })();

  console.log(chalk.bold(`\n  ${detail.name}`));
  if (detail.year) console.log(chalk.dim(`  ${detail.year} ${detail.area ?? ''} ${detail.type ?? ''}`));
  if (detail.description) {
    const desc = detail.description.length > 150 ? detail.description.substring(0, 150) + '...' : detail.description;
    console.log(chalk.dim(`  ${desc}`));
  }

  if (!detail.playList?.length) {
    console.log(chalk.yellow('\n  无播放源\n'));
    return;
  }

  // Select source line
  let group = detail.playList[0];
  if (detail.playList.length > 1) {
    const sourceItems: SelectOption[] = detail.playList.map((g: any) => ({
      label: `${g.name} (${g.episodes.length}集)`,
      value: g.name,
    }));
    const sourceResult = await fzfSelect(sourceItems, {
      prompt: '线路',
      header: detail.name,
      reverse: false,
    });
    if (!sourceResult) return;
    group = detail.playList[sourceResult.index];
  }

  // Loop: select episode → action → back to episode list
  while (true) {
    const epItems: SelectOption[] = group.episodes.map((ep: any) => ({
      label: `${ep.name}  ${chalk.dim(ep.url)}`,
      value: ep.url,
    }));

    const epResult = await fzfSelect(epItems, {
      prompt: group.name,
      header: `${detail.name} | ${group.episodes.length}集 | 倒序(最新在前) | Esc返回`,
      reverse: true,
    });

    if (!epResult) break; // Esc/cancel → exit loop

    // Action menu (also loops until cancel)
    const acted = await episodeActionMenu(services, siteKey, videoId, detail.name, group, epResult);
    if (!acted) continue; // action cancelled → back to episode list
  }
}

async function episodeActionMenu(
  services: Services,
  siteKey: string,
  videoId: string,
  detailName: string,
  group: any,
  epResult: { label: string; value: string; index: number },
): Promise<boolean> {
  const epActions: SelectOption[] = [
    { label: '▶ 播放 (本地播放器)', value: 'play' },
    { label: '🔍 解析后播放', value: 'parse-play' },
    { label: '🌐 在线播放 (浏览器 HLS)', value: 'browser-play' },
    { label: '🌐 在浏览器中打开链接', value: 'open' },
    { label: '📋 复制播放地址', value: 'copy-url' },
    { label: '📋 复制名称', value: 'copy-name' },
  ];

  const action = await fzfSelect(epActions, {
    prompt: '操作',
    header: `${group.episodes[epResult.index].name} | Esc返回列表`,
    reverse: false,
  });

  if (!action) return false; // Esc → back to episode list

  const epUrl = epResult.value;
  const epName = group.episodes[epResult.index].name;

  switch (action.value) {
    case 'play':
      getStore().addHistory(siteKey, videoId, detailName, epName);
      await services.playerService.play(epUrl);
      break;
    case 'parse-play': {
      console.log(chalk.dim('  解析中...'));
      const parsed = await services.parseService.parse(epUrl);
      if (parsed) {
        console.log(chalk.green(`  解析成功: ${parsed.url}`));
        getStore().addHistory(siteKey, videoId, detailName, epName);
        await services.playerService.play(parsed.url, { headers: parsed.header });
      } else {
        console.log(chalk.yellow('  解析失败，尝试直接播放'));
        await services.playerService.play(epUrl);
      }
      break;
    }
    case 'browser-play':
      getStore().addHistory(siteKey, videoId, detailName, epName);
      openPlayerInBrowser(epUrl, `${detailName} - ${epName}`);
      break;
    case 'open':
      openInBrowser(epUrl);
      break;
    case 'copy-url':
      copyToClipboard(epUrl);
      console.log(chalk.green(`  已复制: ${epUrl}`));
      break;
    case 'copy-name':
      copyToClipboard(epName);
      console.log(chalk.green(`  已复制: ${epName}`));
      break;
  }

  return true;
}

// ─── Shared: select from video list ───

async function selectFromVideoList(services: Services, items: VideoItem[]) {
  if (items.length === 0) return;

  const options: SelectOption[] = items.map(item => ({
    label: `${item.name} ${item.remarks ? chalk.yellow(`[${item.remarks}]`) : ''} ${chalk.cyan(`@${item.siteKey}`)}`,
    value: `${item.siteKey}::${item.id}`,
  }));

  // Loop: select video → action → back to list
  while (true) {
    const selected = await fzfSelect(options, {
      prompt: '选择',
      header: `${items.length} 个结果 | Esc退出`,
      reverse: false,
    });

    if (!selected) break; // Esc → exit

    const item = items[selected.index];
    await videoItemAction(services, item);
  }
}

// ─── Play ───

async function handlePlay(services: Services, args: string[], lastResults: VideoItem[]) {
  if (args.length === 0) {
    if (lastResults.length > 0) {
      await selectFromVideoList(services, lastResults);
      return;
    }
    console.log(chalk.yellow('  用法: play <url> 或 play <序号>'));
    return;
  }

  let url = args[0];

  if (/^\d+$/.test(url)) {
    const idx = parseInt(url) - 1;
    if (idx >= 0 && idx < lastResults.length) {
      const item = lastResults[idx];
      await showDetail(services, item.siteKey, item.id);
      return;
    }
    console.log(chalk.yellow('  序号超出范围'));
    return;
  }

  await services.playerService.play(url);
}

// ─── Live ───

async function handleLive(services: Services, signal?: AbortSignal) {
  console.log(chalk.dim('  加载直播源...'));
  if (signal?.aborted) return;
  const channels = await services.liveService.getChannels();
  if (signal?.aborted) return;

  if (channels.length === 0) {
    console.log(chalk.yellow('  没有可用的直播源'));
    return;
  }

  const items: SelectOption[] = channels.map(ch => ({
    label: `${ch.name} ${chalk.dim(`[${ch.group}]`)}`,
    value: ch.urls[0],
  }));

  const selected = await fzfSelect(items, {
    prompt: '频道',
    header: `${channels.length} 个频道`,
    reverse: false,
  });

  if (!selected) return;

  const actions: SelectOption[] = [
    { label: '▶ 播放', value: 'play' },
    { label: '📋 复制地址', value: 'copy' },
  ];

  const action = await fzfSelect(actions, {
    prompt: '操作',
    header: channels[selected.index].name,
    reverse: false,
  });

  if (action?.value === 'play') {
    await services.playerService.play(selected.value);
  } else if (action?.value === 'copy') {
    copyToClipboard(selected.value);
    console.log(chalk.green(`  已复制`));
  }
}

// ─── Parse ───

async function handleParse(services: Services, args: string[]) {
  if (args.length === 0) {
    const parses = services.parseService.getAllParses();
    const items: SelectOption[] = parses.map(p => {
      const typeLabel = p.type === 0 ? '单接口' : p.type === 3 ? '聚合' : `类型${p.type}`;
      return { label: `${p.name} [${typeLabel}]`, value: p.url };
    });

    const selected = await fzfSelect(items, {
      prompt: '解析接口',
      header: `${parses.length} 个解析接口`,
      reverse: false,
    });

    if (selected) {
      copyToClipboard(selected.value);
      console.log(chalk.green(`  已复制: ${selected.value}`));
    }
    return;
  }

  const url = args[0];
  console.log(chalk.dim('  解析中...'));
  const result = await services.parseService.parse(url);

  if (result) {
    console.log(chalk.green(`  解析成功: ${result.url}`));
    const actions: SelectOption[] = [
      { label: '▶ 播放', value: 'play' },
      { label: '📋 复制地址', value: 'copy' },
    ];
    const action = await fzfSelect(actions, { prompt: '操作', reverse: false });
    if (action?.value === 'play') {
      await services.playerService.play(result.url, { headers: result.header });
    } else if (action?.value === 'copy') {
      copyToClipboard(result.url);
      console.log(chalk.green(`  已复制`));
    }
  } else {
    console.log(chalk.yellow('  解析失败'));
  }
}

// ─── Favorites ───

async function handleFav(services: Services, args: string[], lastResults: VideoItem[]) {
  const store = getStore();

  if (args[0] === 'add' && args[1]) {
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

  const favs = store.getFavorites();
  if (favs.length === 0) {
    console.log(chalk.yellow('  收藏夹为空'));
    return;
  }

  const items: SelectOption[] = favs.map(f => ({
    label: `${f.name} ${chalk.cyan(`@${f.siteKey}`)} ${chalk.dim(f.addedAt)}`,
    value: `${f.siteKey}::${f.videoId}`,
  }));

  const selected = await fzfSelect(items, {
    prompt: '收藏',
    header: `${favs.length} 个收藏`,
    reverse: false,
  });

  if (!selected) return;

  const fav = favs[selected.index];
  const favActions: SelectOption[] = [
    { label: '📄 查看详情', value: 'detail' },
    { label: '▶ 播放最新集', value: 'play' },
    { label: '❌ 取消收藏', value: 'remove' },
  ];

  const action = await fzfSelect(favActions, {
    prompt: '操作',
    header: fav.name,
    reverse: false,
  });

  if (!action) return;

  switch (action.value) {
    case 'detail':
      await showDetail(services, fav.siteKey, fav.videoId);
      break;
    case 'play': {
      console.log(chalk.dim('  获取播放地址...'));
      const detail = await services.detailService.getDetail(fav.siteKey, fav.videoId);
      if (detail.playList.length > 0 && detail.playList[0].episodes.length > 0) {
        const lastEp = detail.playList[0].episodes[detail.playList[0].episodes.length - 1];
        store.addHistory(fav.siteKey, fav.videoId, fav.name, lastEp.name);
        await services.playerService.play(lastEp.url);
      } else {
        console.log(chalk.yellow('  没有可播放的内容'));
      }
      break;
    }
    case 'remove':
      store.removeFavorite(fav.siteKey, fav.videoId);
      console.log(chalk.green(`  已取消收藏: ${fav.name}`));
      break;
  }
}

// ─── History ───

async function handleHistory(services: Services) {
  const store = getStore();
  const history = store.getHistory();

  if (history.length === 0) {
    console.log(chalk.yellow('  暂无观看记录'));
    return;
  }

  const items: SelectOption[] = history.map(h => {
    const ep = h.episode ? `[${h.episode}]` : '';
    return {
      label: `${h.name} ${ep} ${chalk.cyan(`@${h.siteKey}`)} ${chalk.dim(h.watchedAt)}`,
      value: `${h.siteKey}::${h.videoId}`,
    };
  });

  const selected = await fzfSelect(items, {
    prompt: '历史',
    header: `${history.length} 条记录`,
    reverse: false,
  });

  if (!selected) return;

  const h = history[selected.index];
  const histActions: SelectOption[] = [
    { label: '📄 查看详情 (继续观看)', value: 'detail' },
    { label: '▶ 播放最新集', value: 'play' },
    { label: '⭐ 收藏', value: 'fav' },
    { label: '🗑 清除全部记录', value: 'clear' },
  ];

  const action = await fzfSelect(histActions, {
    prompt: '操作',
    header: h.name,
    reverse: false,
  });

  if (!action) return;

  switch (action.value) {
    case 'detail':
      await showDetail(services, h.siteKey, h.videoId);
      break;
    case 'play': {
      console.log(chalk.dim('  获取播放地址...'));
      const detail = await services.detailService.getDetail(h.siteKey, h.videoId);
      if (detail.playList.length > 0 && detail.playList[0].episodes.length > 0) {
        const lastEp = detail.playList[0].episodes[detail.playList[0].episodes.length - 1];
        store.addHistory(h.siteKey, h.videoId, h.name, lastEp.name);
        await services.playerService.play(lastEp.url);
      }
      break;
    }
    case 'fav':
      store.addFavorite(h.siteKey, h.videoId, h.name);
      console.log(chalk.green(`  已收藏: ${h.name}`));
      break;
    case 'clear':
      store.clearHistory();
      console.log(chalk.green('  已清除全部记录'));
      break;
  }
}

// ─── Config ───

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

function handleClear(args: string[]) {
  const store = getStore();
  const target = args[0] ?? 'cache';

  switch (target) {
    case 'cache':
      store.clearExpiredCache();
      store.clearAllCache();
      console.log(chalk.green('  已清理所有搜索和详情缓存'));
      break;
    case 'history':
      store.clearHistory();
      console.log(chalk.green('  已清理观看记录'));
      break;
    case 'all':
      store.clearAllCache();
      store.clearHistory();
      console.log(chalk.green('  已清理所有缓存和观看记录'));
      break;
    default:
      console.log(chalk.yellow('  用法: clear [cache|history|all]'));
  }
}
