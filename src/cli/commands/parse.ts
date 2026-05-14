import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createServices } from '../../index.js';

export function parseCommand(program: Command) {
  program
    .command('parse <url>')
    .description('通过解析接口解析视频URL')
    .option('-n, --name <name>', '指定解析接口')
    .option('-a, --all', '尝试所有解析接口')
    .option('-l, --list', '列出可用解析接口')
    .action(async (url: string, opts) => {
      const { parseService } = await createServices();

      if (opts.list) {
        const parses = parseService.getAllParses();
        console.log(chalk.bold('\n  可用解析接口:\n'));
        parses.forEach((p, i) => {
          const typeLabel = p.type === 0 ? '单接口' : p.type === 3 ? '聚合' : `类型${p.type}`;
          console.log(`  ${chalk.gray(`${i + 1}.`)} ${p.name} ${chalk.dim(`[${typeLabel}]`)} ${chalk.dim(p.url)}`);
        });
        console.log();
        return;
      }

      if (opts.all) {
        const spinner = ora('尝试所有解析接口...').start();
        const results = await parseService.parseWithAll(url);
        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow('\n  所有解析接口均失败\n'));
          return;
        }

        console.log(chalk.bold(`\n  解析成功 (${results.length} 个):\n`));
        results.forEach((r, i) => {
          console.log(`  ${chalk.gray(`${i + 1}.`)} ${chalk.cyan(r.name)}`);
          console.log(`     ${chalk.green(r.result!.url)}`);
        });
        console.log();
        return;
      }

      const spinner = ora('解析中...').start();
      const result = await parseService.parse(url, opts.name);
      spinner.stop();

      if (result) {
        console.log(chalk.green(`\n  解析成功:`));
        console.log(`  URL: ${result.url}`);
        if (result.header) {
          console.log(`  Headers: ${JSON.stringify(result.header)}`);
        }
        console.log();
      } else {
        console.log(chalk.yellow('\n  解析失败\n'));
      }
    });
}
