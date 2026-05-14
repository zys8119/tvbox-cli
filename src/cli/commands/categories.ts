import { Command } from 'commander';
import ora from 'ora';
import { createServices } from '../../index.js';
import { formatCategories, formatVideoList } from '../../utils/format.js';

export function categoriesCommand(program: Command) {
  program
    .command('cat <siteKey>')
    .description('浏览站点分类')
    .option('-p, --page <n>', '页码', '1')
    .option('-c, --category <id>', '分类ID（不指定则列出分类）')
    .action(async (siteKey: string, opts) => {
      const { siteService } = await createServices();
      const adapter = siteService.getAdapter(siteKey);

      if (!adapter.supported) {
        console.log(`  该站点不支持直接访问`);
        return;
      }

      if (opts.category) {
        const spinner = ora('加载列表...').start();
        try {
          const items = await adapter.getList(opts.category, parseInt(opts.page));
          spinner.stop();
          formatVideoList(items);
        } catch (e: any) {
          spinner.fail(`加载失败: ${e.message}`);
        }
      } else {
        const spinner = ora('加载分类...').start();
        try {
          const categories = await adapter.getCategories();
          spinner.stop();
          formatCategories(categories);
        } catch (e: any) {
          spinner.fail(`加载失败: ${e.message}`);
        }
      }
    });
}
