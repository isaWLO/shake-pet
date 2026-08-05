# 演示素材放置说明

这个目录专门存放 GitHub README 使用的截图和 GIF。

推荐准备以下文件：

| 文件名 | 内容建议 |
| --- | --- |
| `demo.gif` | 8–15 秒：添加图片、晃动瓶子、锁定窗口 |
| `main-window.png` | 装有多张图片的主界面 |
| `cutout-editor.png` | 擦除笔与恢复笔界面 |

## 替换首页占位图

README 目前使用：

```markdown
![摇摇乐演示区域](docs/media/preview-placeholder.svg)
```

添加 `demo.gif` 后改成：

```markdown
![摇摇乐演示](docs/media/demo.gif)
```

## 添加两张并排截图

在 README 的“效果预览”部分加入：

```html
<p align="center">
  <img src="docs/media/main-window.png" width="48%" alt="摇摇乐主界面">
  <img src="docs/media/cutout-editor.png" width="48%" alt="手动抠图界面">
</p>
```

建议截图使用 PNG；GIF 尽量保持简短，并在提交前确认其中没有私人桌面信息。
