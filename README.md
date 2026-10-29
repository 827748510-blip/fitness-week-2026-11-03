# 健身周计划 PWA · 2026-11-03～11-09

**打开：** https://827748510-blip.github.io/fitness-week-2026-11-03/

Safari 添加到主屏幕：打开链接 → 分享 →「添加到主屏幕」。

本地键：`fitness-week-2026-11-03`（localStorage）。勾选 / 重量 / 体重自动防抖同步，无需导出 JSON。

## Bot 如何读取最新数据

优先拉取：

1. **实时（首选）：** https://j.jstash.app/9UOvxv7LGyOynCF0eRzE5Q
2. **Gist 镜像：** https://gist.githubusercontent.com/827748510-blip/9d14b42b506ba1fc2635ad2538add3f5/raw/latest.json
3. **仓库镜像：** https://raw.githubusercontent.com/827748510-blip/fitness-week-2026-11-03/main/data/latest.json
4. **本机：** `/home/box/agent-data/agents/a04963cf-3af6-4635-8877-817ab4d31049/fitness/week-2026-11-03/synced.json`

```bash
./scripts/pull-synced.sh   # 从实时源刷新 synced.json，并镜像到 gist + data/latest.json
```

Box 上 `fitness/sync-server/mirror-loop.sh` 每 15 分钟自动拉取一次。

## 安全说明

前端仅含 **jstash bin 级 edit_token**（只能改这一份健身 JSON），**没有** GitHub PAT。知道页面源码的人可以覆盖这份进度（训练勾选/重量/体重）；可接受。jstash 试用 bin 约 2026-11-05 过期前需认领或换新 bin（镜像仍保留在 gist/仓库）。
