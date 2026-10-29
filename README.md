# 健身周计划 PWA · 2026-11-03～11-09

**打开：** https://827748510-blip.github.io/fitness-week-2026-11-03/

Safari 添加到主屏幕：打开链接 → 分享 →「添加到主屏幕」。

本地键：`fitness-tracker-v2`（localStorage），兼容迁移旧键 `fitness-week-2026-11-03`。勾选 / 重量 / 体重自动防抖同步，无需导出 JSON。

清空本周记录会先保存本机状态，再同步给教练，保留其它周归档及其体重、力量记录。若当前有上传，清空后的状态会在它结束后上传；失败可点「立即同步」重试，重新打开也会补传本机状态。

## 本地验证（离线模拟）

这是静态 PWA，无依赖安装或编译步骤。不要用 `scripts/pull-synced.sh` 测试：它会访问实时记录并写入远端镜像。

```bash
node --test tests/regression.test.cjs
```

测试直接执行页面脚本，使用虚拟 DOM、本机存储、计时器与 fetch；不接触真实记录或网络。覆盖清空/取消、旧防抖、失败与重试、重开补传、上传排队、保存失败和全部 7 天标签（含 5 个时区）。

可选浏览器验证需本机已有 `playwright-cli` 和 Chrome；在独立终端启动本地服务，再运行：

```bash
python3 -m http.server 18741 --bind 127.0.0.1
# 另一终端：
mkdir -p output/playwright
playwright-cli -s=fitness-reset-test open about:blank --browser chrome
playwright-cli -s=fitness-reset-test run-code --filename tests/browser-smoke.js
playwright-cli -s=fitness-reset-test eval '() => globalThis.fitnessSmokeReport'
playwright-cli -s=fitness-reset-test close
```

浏览器脚本创建独立临时上下文、禁用 Service Worker，在导航前拦截全部外部请求，仅向模拟同步端写入人工测试数据。截图位于 `output/playwright/`。不要把验证脚本改成访问线上页面或真实同步服务。

上传顺序保证限于当前页面生命周期；现有远端接口是无版本条件的整份 PUT，跨设备/跨标签页并发或页面关闭时已发送但未确认的请求，仍需服务端版本控制才能保证全局顺序。本次保持原认证与载荷协议。

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
