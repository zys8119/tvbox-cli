import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createServices } from '../../index.js';
import { formatVideoList } from '../../utils/format.js';

export function searchCommand(program: Command) {
  program
    .command('search <keyword>')
    .description('搜索视频')
    .option('-s, --site <key>', '指定站点搜索')
    .option('-c, --concurrency <n>', '并发数', '5')
    .option('-t, --timeout <ms>', '超时时间(ms)', '10000')
    .action(async (keyword: string, opts) => {
      const { searchService } = await createServices();
      const spinner = ora(`搜索 "${keyword}"...`).start();

      try {
        const results = await searchService.searchAll(keyword, {
          siteKeys: opts.site ? [opts.site] : undefined,
          concurrency: parseInt(opts.concurrency),
          timeout: parseInt(opts.timeout),
        });

        spinner.stop();
        formatVideoList(results);
      } catch (e: any) {
        spinner.fail(`搜索失败: ${e.message}`);
      }
    });
}
