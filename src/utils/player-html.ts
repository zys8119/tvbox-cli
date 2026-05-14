import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { openInBrowser } from '../utils/selector.js';
import chalk from 'chalk';

export function generatePlayerHtml(url: string, title?: string): string {
  const pageTitle = title ?? '在线播放';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui; }
#player { width: 100%; max-width: 1200px; aspect-ratio: 16/9; background: #111; }
video { width: 100%; height: 100%; }
.info { position: fixed; top: 12px; left: 12px; color: #fff8; font-size: 13px; z-index: 10; }
</style>
</head>
<body>
<div class="info">${pageTitle}</div>
<div id="player">
  <video id="video" controls autoplay></video>
</div>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
const url = ${JSON.stringify(url)};
const video = document.getElementById('video');

if (url.includes('.m3u8')) {
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
  }
} else {
  video.src = url;
}
</script>
</body>
</html>`;
}

export function openPlayerInBrowser(url: string, title?: string) {
  const html = generatePlayerHtml(url, title);
  const filePath = resolve(tmpdir(), `tvbox-player-${Date.now()}.html`);
  writeFileSync(filePath, html, 'utf-8');
  console.log(chalk.green(`  已生成播放页: ${filePath}`));
  openInBrowser(filePath);
}
