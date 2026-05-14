import { Command } from 'commander';
import { sitesCommand } from './commands/sites.js';
import { categoriesCommand } from './commands/categories.js';
import { searchCommand } from './commands/search.js';
import { detailCommand } from './commands/detail.js';
import { playCommand } from './commands/play.js';
import { liveCommand } from './commands/live.js';
import { parseCommand } from './commands/parse.js';
import { interactiveMode } from './interactive.js';

const program = new Command();

program
  .name('tvbox')
  .description('TVBox CLI - 终端视频源浏览播放工具')
  .version('1.0.0');

sitesCommand(program);
categoriesCommand(program);
searchCommand(program);
detailCommand(program);
playCommand(program);
liveCommand(program);
parseCommand(program);

program.action(async () => {
  await interactiveMode();
});

program.parse();
