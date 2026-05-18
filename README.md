# TVBox CLI

支持：

- TVBox JSON
- type=3 app/vod
- Jar Spider
- m3u8 播放
- 并发搜索
- macOS/Linux

## 安装

```bash
npm install
npm link
```

## 使用

```bash
tvbox search 斗破苍穹
tvbox detail csp_AppYs 123
tvbox play https://xxx.m3u8
```
## 资源

https://cdn.jsdelivr.net/gh/noimank/tvbox/tvboxmuti.json



使用方式：


# 添加多仓地址
tvbox config add muti https://cdn.jsdelivr.net/gh/noimank/tvbox/tvboxmuti.json
tvbox config use muti

# 拉取时自动弹出选择（首次或无缓存时）
tvbox config pull

# 重新选择子配置
tvbox config select