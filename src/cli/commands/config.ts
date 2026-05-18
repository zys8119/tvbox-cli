import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getStore } from '../../index.js';
import { ConfigLoader } from '../../config/loader.js';
import { createMultiRepoResolver } from '../../config/multi-repo.js';

export function configCommand(program: Command) {
  const cmd = program
    .command('config')
    .description('管理配置源');

  cmd
    .command('list')
    .alias('ls')
    .description('列出所有配置')
    .action(() => {
      const store = getStore();
      const configs = store.getConfigs();
      const active = store.getActiveConfigName();

      console.log(chalk.bold('\n  配置列表:\n'));
      configs.forEach((c, i) => {
        const marker = c.name === active ? chalk.green(' ●') : '  ';
        const typeLabel = c.type === 'remote' ? chalk.cyan('[远程]') : chalk.dim('[本地]');
        console.log(`${marker} ${chalk.gray(`${i + 1}.`)} ${chalk.bold(c.name)} ${typeLabel}`);
        console.log(`     ${chalk.dim(c.path)}`);
        const multiRepoUrl = store.getSetting(`multirepo_selected:${c.name}`);
        if (multiRepoUrl) {
          console.log(`     ${chalk.dim('└─ 子源:')} ${chalk.dim(multiRepoUrl)}`);
        }
      });
      console.log();
    });

  cmd
    .command('add <name> <path>')
    .description('添加配置 (本地路径或 HTTP URL)')
    .action((name: string, path: string) => {
      const store = getStore();
      const type = path.startsWith('http') ? 'remote' : 'local';
      store.addConfig(name, path, type);
      console.log(chalk.green(`\n  已添加配置: ${name} [${type}]\n`));
    });

  cmd
    .command('remove <name>')
    .alias('rm')
    .description('删除配置')
    .action((name: string) => {
      const store = getStore();
      try {
        store.removeConfig(name);
        console.log(chalk.green(`\n  已删除配置: ${name}\n`));
      } catch (e: any) {
        console.log(chalk.red(`\n  ${e.message}\n`));
      }
    });

  cmd
    .command('use <name>')
    .description('切换当前使用的配置')
    .action((name: string) => {
      const store = getStore();
      try {
        store.setActiveConfig(name);
        console.log(chalk.green(`\n  已切换到配置: ${name}\n`));
      } catch (e: any) {
        console.log(chalk.red(`\n  ${e.message}\n`));
      }
    });

  cmd
    .command('pull [name]')
    .description('拉取远程配置到本地缓存')
    .action(async (name?: string) => {
      const store = getStore();
      const configEntry = name
        ? store.getConfigs().find(c => c.name === name)
        : store.getActiveConfig();

      if (!configEntry) {
        console.log(chalk.red(`\n  配置 "${name}" 不存在\n`));
        return;
      }

      if (configEntry.type !== 'remote') {
        console.log(chalk.yellow(`\n  "${configEntry.name}" 是本地配置，无需拉取\n`));
        return;
      }

      const spinner = ora(`拉取配置: ${configEntry.path}`).start();
      try {
        const resolver = createMultiRepoResolver(store, configEntry.name);
        const loader = new ConfigLoader(configEntry.path, { resolveMultiRepo: resolver });
        spinner.stop();
        const config = await loader.loadAsync();
        spinner.start();
        spinner.succeed(`配置已缓存 (${config.sites?.length ?? 0} 个站点)`);
      } catch (e: any) {
        spinner.fail(`拉取失败: ${e.message}`);
      }
    });

  cmd
    .command('select [name]')
    .description('重新选择多仓配置中的子配置源')
    .action(async (name?: string) => {
      const store = getStore();
      const configEntry = name
        ? store.getConfigs().find(c => c.name === name)
        : store.getActiveConfig();

      if (!configEntry) {
        console.log(chalk.red(`\n  配置 "${name}" 不存在\n`));
        return;
      }

      store.deleteSetting(`multirepo_selected:${configEntry.name}`);

      const spinner = ora(`加载配置: ${configEntry.path}`).start();
      try {
        const resolver = createMultiRepoResolver(store, configEntry.name);
        const loader = new ConfigLoader(configEntry.path, { resolveMultiRepo: resolver });
        spinner.stop();
        const config = await loader.loadAsync();
        console.log(chalk.green(`\n  已选择子配置 (${config.sites?.length ?? 0} 个站点)\n`));
      } catch (e: any) {
        spinner.stop();
        console.log(chalk.red(`\n  选择失败: ${e.message}\n`));
      }
    });
}
