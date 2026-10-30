# 练习日常 · 健身周计划 PWA · 2026-11-03～11-09

**打开：** https://827748510-blip.github.io/fitness-week-2026-11-03/

当前版本：`2026-10-30-gallery-v12`。默认进入手机训练工作台，原计划日期不变。动作卡支持静态姿势／肌群图切换、器械变式、清晰图放大与返回；页头可打开完整 32 动作图集。原文字指导、重量／次数记录、撤销、本周归档和既有同步协议保留。

6 张姿势图仍为待确认：F01 / F04 / F14 / F24 / F26 / F27。肌群为定性区域示意，不表示 EMG、用力百分比或精确解剖；F20 肌群图只展示仰卧四肢抬起的起始位。全部图片来自已核验的 Library 包，压缩预览按需加载，点击后才请求清晰图。

发布与验证说明：[图集版说明](docs/RELEASE_GALLERY_V12.md)。原动画探索记录保留在 TRAINING_STAGE_NOTE.md，当前主操作采用静态图。

Safari 添加到主屏幕：打开链接 → 分享 →「添加到主屏幕」。

本地键：`fitness-tracker-v2`（localStorage），兼容迁移旧键 `fitness-week-2026-11-03`。勾选 / 重量 / 体重自动防抖同步，无需导出 JSON。

清空本周记录会先保存本机状态，再同步给教练，保留其它周归档及其体重、力量记录。若当前有上传，清空后的状态会在它结束后上传；失败可点「立即同步」重试，重新打开也会补传本机状态。

重量统计仅接受单个非负十进制数及可选 `kg`、`公斤`、`千克` 单位，例如 `50kg`、`12.5 公斤`。含组次、范围、其它单位或自由备注的实际重量保留原文，不生成统计数值；不会自动更改已存 v2 数值记录。图片可用 Enter / 空格打开，Esc 或关闭按钮退出并返回触发图片。

## 本地验证（离线模拟）

这是静态 PWA，无依赖安装或编译步骤。不要用 `scripts/pull-synced.sh` 测试：它会访问实时记录并写入远端镜像。

```bash
node --test tests/*.test.cjs
```

测试直接执行页面脚本，使用虚拟 DOM、本机存储、计时器与 fetch；不接触真实记录或网络。覆盖清空/取消、旧防抖、失败与重试、重开补传、上传排队、保存失败、历史保留、重量解析与迁移、灯箱键盘/焦点和全部 7 天标签（含 5 个时区）。

云端浏览器检查使用已安装的 Playwright / Chromium，不访问真实同步服务。先在独立终端分别运行原静态服务与隔离演示服务：

```bash
python3 -m http.server 18741 --bind 127.0.0.1
python3 scripts/serve-review.py
```

然后运行：

```bash
node tests/run-cloud-browser.cjs
node tests/cloud-sw-browser.cjs
```

真实 Service Worker 检查自带仅监听回环地址的临时 18743 服务，从既有发布基线升级到新版并模拟离线；所有用户数据均为合成，外部请求阻断或模拟，不读取实时记录。结果保存在 `output/playwright/`，当前交付证据见 `docs/verification/`。不新增 GitHub 托管测试流程。

上传顺序保证限于当前页面生命周期；现有远端接口是无版本条件的整份 PUT，跨设备/跨标签页并发或页面关闭时已发送但未确认的请求，仍需服务端版本控制才能保证全局顺序。本次保持原认证与载荷协议。

## 手机训练工作台 · 本地审阅

`feat/toy-training-stage` 第二轮依据五张 UI 参考重排为手机训练工作台，提供日期、当前动作、组次/重量记录、固定主操作和悬浮底部导航。`a_row`、`a_chest`、`c_lateral` 为原创 Canvas 2.5D 自动循环示意；其余保留原图，Smith 暂无匹配示范。原训练数据仍为 v2，组次明细为可备份的本机 sidecar，暂不跨设备同步。

安全体验：`python3 scripts/serve-review.py` 后访问 `http://127.0.0.1:18742/`。此入口使用独立记录键和模拟同步；不要在原始静态源页填写试用记录。完整范围、来源、验证与剩余差距见 [TRAINING_STAGE_NOTE.md](TRAINING_STAGE_NOTE.md)。新增回归：`tests/workspace-browser-smoke.js`（18742），其余回归仍使用说明中的 18741 本机测试服务并拦截真实同步。

## Bot 如何读取最新数据

优先拉取：

1. **实时（首选）：** https://j.jstash.app/REDACTED_BIN_ID
2. **Gist 镜像：** https://gist.githubusercontent.com/827748510-blip/REDACTED_MIRROR_ID/raw/latest.json
3. **仓库镜像：** https://sync.invalid/mirror-disabled
4. **本机：** `/home/box/agent-data/agents/a04963cf-3af6-4635-8877-817ab4d31049/fitness/week-2026-11-03/synced.json`

```bash
./scripts/pull-synced.sh   # 从实时源刷新 synced.json，并镜像到 gist + data/latest.json
```

Box 上 `fitness/sync-server/mirror-loop.sh` 每 15 分钟自动拉取一次。

## 安全说明

前端仅含 **jstash bin 级 edit_token**（只能改这一份健身 JSON），**没有** GitHub PAT。知道页面源码的人可以覆盖这份进度（训练勾选/重量/体重）；可接受。jstash 试用 bin 约 2026-11-05 过期前需认领或换新 bin（镜像仍保留在 gist/仓库）。
