# dsh-plan-toggle

DeepSeek Harness plugin: two shortcuts and two composer buttons for working with
the `plan-mode` skill.

- **Toggle plan-mode in the draft** — adds or removes a `/plan-mode` line at the
  top of the composer draft, so the skill is carried for exactly this turn.
- **Send implement plan** — sends `implement plan` straight to the session,
  without touching your draft.

## Install

```
plugin_manager install_bundle → point it at this directory (or a clone of it)
```

## 键位

| 端 | 切换 plan-mode skill | 发送 implement plan |
| --- | --- | --- |
| Desktop（Windows / macOS / Linux） | `Alt+P` | `Alt+I` |
| Web（Windows / macOS） | `Ctrl/Cmd+Shift+P` | `Ctrl/Cmd+Alt+I` |

不想记快捷键就用鼠标：输入框左侧有**「计划」**按钮，右侧有**「开工」**按钮，行为与快捷键一致。

### 切换 plan-mode skill（Alt+P）

按一下，当前会话的输入框里：

- 没有 `/plan-mode` 这行 → 插到最前面，后面带一个空格，可直接接写需求；
- 已有这行 → 删掉，其余内容原样保留。

**开关状态就是那行字本身**——看得见、改得动、随时可撤销。

```
/plan-mode 
帮我重构这个模块
```

发出去，这一轮就带上 skill 的规划流程。

### 发送 implement plan（Alt+I）

计划看过了、决定开工，按一下直接发出 `implement plan`，不用打这行字。

**不碰草稿**：走的是 `conversation.sendSession`，和 composer 发送同一条宿主路径，但不读取、不覆盖、不恢复草稿。你正在写的东西原封不动留在输入框里。

草稿处于提交中时按键放行，不会重复发送。

## 装了什么

一个 bundle，一个插件行 `toggle-plan`，一个客户端插件。没有预设、没有宿主端逻辑（`lib/index.js` 只是让包在 Loader 里有个入口）。

> 客户端插件是**单个自包含 bundle**：模块表只认平台 seed（`react` 等）、已物化模块或已注册的包工厂，包内相对路径 `require("./x")` 不可用。所有代码因此集中在一个 `lib/client.js` 里，不要拆文件。

## 卸载

```
plugin_manager remove_bundle → dsh-plan-toggle
```

## 键位自定义

设置 → 快捷键，搜索 “plan-mode” 或 “implement plan” 即可改键。

## 边界

- **不写磁盘**：不改 skill 文件的 frontmatter，不改任何配置。
- **不影响其他会话**：只作用当前主视图那个会话。
- **不切换原生 plan 模式**：与 `/plan` 那套机制无关。
- **不误伤正文**：只有独占一行的 `/plan-mode` 才算标记；正文里提到它（如「请用 /plan-mode 规划」）不会被当成开关。
- **不吞草稿**：发送 implement plan 完全不经过草稿，原内容保留。

## License

MIT
