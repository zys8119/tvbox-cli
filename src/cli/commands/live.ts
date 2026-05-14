import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createServices } from '../../index.js';
import { formatChannels } from '../../utils/format.js';

export function liveCommand(program: Command) {
  program
    .command('live')
    .description('直播源')
    .option('-g, --group <name>', '按分组筛选')
    .option('-s, --search <keyword>', '搜索频道')
    .option('-p, --play <name>', '播放指定频道')
    .action(async (opts) => {
      const { liveService, playerService } = await createServices();
      const spinner = ora('加载直播源...').start();

      try {
        const channels = await liveService.getChannels();
        spinner.stop();

        if (channels.length === 0) {
          console.log(chalk.yellow('\n  没有可用的直播源\n'));
          return;
        }

        if (opts.play) {
          const ch = channels.find(c =>
            c.name.toLowerCase().includes(opts.play.toLowerCase())
          );
          if (ch) {
            console.log(chalk.green(`\n  播放: ${ch.name}`));
            await playerService.play(ch.urls[0]);
          } else {
            console.log(chalk.yellow(`\n  未找到频道: ${opts.play}\n`));
          }
          return;
        }

        let filtered = channels;
        if (opts.group) {
          filtered = channels.filter(c =>
            c.group.toLowerCase().includes(opts.group.toLowerCase())
          );
        }
        if (opts.search) {
          filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(opts.search.toLowerCase())
          );
        }

        formatChannels(filtered);
        console.log(chalk.dim(`  共 ${filtered.length} 个频道\n`));
      } catch (e: any) {
        spinner.fail(`加载失败: ${e.message}`);
      }
    });
}
