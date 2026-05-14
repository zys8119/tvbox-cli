import { Command } from 'commander';
import chalk from 'chalk';
import { createServices } from '../../index.js';

export function playCommand(program: Command) {
  program
    .command('play <url>')
    .description('播放视频URL')
    .option('-p, --player <name>', '指定播放器 (mpv/iina/vlc)')
    .option('--parse', '通过解析接口解析后播放')
    .option('--parse-name <name>', '指定解析接口名称')
    .action(async (url: string, opts) => {
      const { playerService, parseService } = createServices();

      let playUrl = url;
      let headers: Record<string, string> | undefined;

      if (opts.parse || opts.parseName) {
        console.log(chalk.dim('  正在解析...'));
        const result = await parseService.parse(url, opts.parseName);
        if (result) {
          playUrl = result.url;
          headers = result.header;
          console.log(chalk.green(`  解析成功: ${playUrl}`));
        } else {
          console.log(chalk.yellow('  解析失败，尝试直接播放原始URL'));
        }
      }

      try {
        await playerService.play(playUrl, {
          player: opts.player,
          headers,
        });
      } catch (e: any) {
        console.log(chalk.red(`  播放失败: ${e.message}`));
        console.log(chalk.dim(`  URL: ${playUrl}`));
      }
    });
}
