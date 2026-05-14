import { Command } from 'commander';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sitesCommand } from './commands/sites.js';
import { categoriesCommand } from './commands/categories.js';
import { searchCommand } from './commands/search.js';
import { detailCommand } from './commands/detail.js';
import { playCommand } from './commands/play.js';
import { liveCommand } from './commands/live.js';
import { parseCommand } from './commands/parse.js';
import { configCommand } from './commands/config.js';
import { interactiveMode } from './interactive.js';
import { setGlobalProxy } from '../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('tvbox')
  .description('TVBox CLI - 终端视频源浏览播放工具')
  .version(pkg.version, '-v, --version')
  .option('--proxy <url>', '网络代理 (如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080)')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.proxy) {
      setGlobalProxy({ url: opts.proxy });
    }
  });

sitesCommand(program);
categoriesCommand(program);
searchCommand(program);
detailCommand(program);
playCommand(program);
liveCommand(program);
parseCommand(program);
configCommand(program);

program.action(async () => {
  const opts = program.opts();
  if (opts.proxy) {
    setGlobalProxy({ url: opts.proxy });
  }
  await interactiveMode();
});

program.parseAsync().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
