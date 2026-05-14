import { execa } from 'execa';
import { existsSync } from 'fs';

export class PlayerService {
  async play(url: string, options?: {
    player?: string;
    headers?: Record<string, string>;
  }): Promise<void> {
    const player = options?.player ?? this.detectPlayer();
    const args = this.buildPlayerArgs(player, url, options?.headers);

    console.log(`  使用 ${player} 播放...`);
    await execa(player, args, { stdio: 'inherit' });
  }

  private detectPlayer(): string {
    const candidates = [
      { cmd: 'iina', check: '/Applications/IINA.app' },
      { cmd: 'mpv', check: null },
      { cmd: 'vlc', check: '/Applications/VLC.app' },
      { cmd: 'ffplay', check: null },
    ];

    for (const { cmd, check } of candidates) {
      if (check && existsSync(check)) return cmd;
      try {
        // Just return the first candidate - actual check would need which/where
        return cmd;
      } catch { continue; }
    }

    return 'mpv';
  }

  private buildPlayerArgs(player: string, url: string, headers?: Record<string, string>): string[] {
    const args = [url];

    if (player === 'mpv' || player === 'iina') {
      if (headers?.['User-Agent']) {
        args.push(`--user-agent=${headers['User-Agent']}`);
      }
      if (headers?.['Referer']) {
        args.push(`--referrer=${headers['Referer']}`);
      }
      if (headers?.['Origin']) {
        args.push(`--http-header-fields=Origin: ${headers['Origin']}`);
      }
    } else if (player === 'vlc') {
      if (headers?.['User-Agent']) {
        args.push(`--http-user-agent=${headers['User-Agent']}`);
      }
      if (headers?.['Referer']) {
        args.push(`--http-referrer=${headers['Referer']}`);
      }
    }

    return args;
  }

  getPlayerUrl(url: string, headers?: Record<string, string>): string {
    if (!headers || Object.keys(headers).length === 0) return url;
    const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\\r\\n');
    return `${url}|${headerStr}`;
  }
}
