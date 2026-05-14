import { Command } from 'commander';
import chalk from 'chalk';
import { createServices } from '../../index.js';
import { formatSiteList } from '../../utils/format.js';

export function sitesCommand(program: Command) {
  program
    .command('sites')
    .description('列出所有站点')
    .option('-a, --all', '显示所有站点（包括不支持的）')
    .action(async (opts) => {
      const { siteService } = await createServices();
      const sites = siteService.listSites();

      if (opts.all) {
        formatSiteList(sites);
      } else {
        const supported = sites.filter(s => s.supported);
        formatSiteList(supported.map(s => ({ ...s, supported: true })));
        console.log(chalk.dim(`  共 ${sites.length} 个站点，${supported.length} 个可用\n`));
      }
    });
}
