import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createServices } from '../../index.js';

export function detailCommand(program: Command) {
  program
    .command('detail <siteKey> <videoId>')
    .description('查看视频详情')
    .action(async (siteKey: string, videoId: string) => {
      const { detailService } = await createServices();
      const spinner = ora('加载详情...').start();

      try {
        const detail = await detailService.getDetail(siteKey, videoId);
        spinner.stop();

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

        if (detail.playList.length > 0) {
          console.log(chalk.bold('\n  播放列表:'));
          detail.playList.forEach((group, gi) => {
            console.log(chalk.cyan(`\n  [${group.name}] (${group.episodes.length}集)`));
            const displayEps = group.episodes.slice(0, 20);
            displayEps.forEach((ep, ei) => {
              console.log(`    ${chalk.gray(`${ei + 1}.`)} ${ep.name}`);
            });
            if (group.episodes.length > 20) {
              console.log(chalk.dim(`    ... 共 ${group.episodes.length} 集`));
            }
          });
        }
        console.log();
      } catch (e: any) {
        spinner.fail(`加载失败: ${e.message}`);
      }
    });
}
