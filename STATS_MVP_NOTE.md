# 长期记录 + 统计 MVP 说明（STATS MVP）

## 变更概要

在同一单页 PWA 上新增「统计」页与长期记录能力：体重趋势图、历史完成率、主要力量项目进展。
原有「本周」页、灯箱、纵向卡片布局、jstash 自动同步、localStorage 保存、PWA 离线缓存全部保留。

## 存储 Schema v2（向后兼容）

新键：`fitness-tracker-v2`（旧键 `fitness-week-2026-11-03` 自动迁移读取，不删除）。

```json
{
  "schemaVersion": 2,
  "weekKey": "2026-11-03",
  "days": { "2026-11-03": { "done": false, "weight": "", "cardioDone": false, "exercises": { "a_legpress": { "done": false, "actual": "" } } } },
  "weeks": { "2026-11-03": { "days": { /* 该周归档快照 */ } } },
  "weightLog": [ { "date": "YYYY-MM-DD", "kg": 90.5 } ],
  "liftLog":   [ { "date": "YYYY-MM-DD", "exerciseId": "a_legpress", "name": "腿举 / 哈克或史密斯深蹲", "kg": 92 } ]
}
```

### 规则

1. **加载迁移**：无 `schemaVersion`/`weeks` 的旧 state → 当前 `days` 拷入 `weeks[weekKey]`；
   `day.weight` 数值化后灌入 `weightLog`；`exercise.actual` 去非数字字符（保留 `.`）后能 parse 的灌入 `liftLog`。
2. **每次保存**：`days` 镜像到 `weeks[weekKey].days`；设体重时按 `date` upsert `weightLog`（清空则删除该日条目）；
   设实际重量时按 `(date, exerciseId)` upsert `liftLog`（无法 parse 为数字则不记）。
3. **清空本周**：只清当前 7 天的 `days` 及这些日期对应的 `weightLog`/`liftLog` 条目；其它周归档不受影响。
4. 数值解析容错：`"92kg"`、`"50 公斤"` → 92 / 50；`"n/a"`、空串 → 忽略。

## UI

- 顶部粘性分段控件：「本周」（默认）|「统计」。
- **本周**：原有交互不变（勾选、体重、实际重量、灯箱、底部粘性栏）。
- **统计**：
  - 体重趋势：`weightLog` 按日期排序的 SVG 折线（`pathLength=1` + dashoffset 描线动画），
    显示最新体重与较首次差值；不足 2 个点显示空状态。
  - 完成率：遍历 `weeks` 全部归档天（含本周镜像），done/总数百分比；另显示「本周 X/7」。
  - 主要力量项目：`a_legpress`、`a_chest`、`a_row`、`b_squat`、`c_rdl`，
    显示最近重量、记录次数、最近 5 次迷你趋势线；无数据则跳过/显示空状态。

## 教练如何读取同步数据

- 同步目标、URL、token 均未改动（jstash bin `9UOvxv7LGyOynCF0eRzE5Q`，改动后约 1–2 秒防抖上传）。
- `buildPayload()` 现在携带完整 state，教练侧读取 `state` 即可：

```
payload.state.schemaVersion   // 2
payload.state.weekKey         // 当前周
payload.state.days            // 当前周（与 weeks[weekKey] 同步镜像）
payload.state.weeks           // 所有周归档：{ "2026-11-03": { days: {...} } }
payload.state.weightLog       // [ { date, kg } ]
payload.state.liftLog         // [ { date, exerciseId, name, kg } ]
```

- 兼容旧客户端：若读到无 `schemaVersion` 的 payload，按旧格式 `state.days` 处理即可。
- SW 缓存版本已升级为 `fitness-week-2026-11-03-v5-stats`，用户下次打开即刷新缓存。

## 验证

- 纯逻辑冒烟（node + DOM/localStorage 桩）：新建、增删改体重/重量、reset 保留历史、
  旧键迁移、payload 完整性均通过（见仓库提交说明）。
