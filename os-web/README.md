# WayLog 官网

WayLog（一路记）的静态展示站，位于 [PraxisGrove/WayLog](https://github.com/PraxisGrove/WayLog) monorepo 中。App 与贡献说明见 [根 README](../README.md)。

## 结构

```text
os-web/
├── index.html       # 页面、样式与浏览器交互
├── assets/          # 公开展示素材
└── scripts/         # 静态构建与本地预览
```

构建脚本将 `index.html` 和 `assets/` 复制到 `dist/`，不依赖服务端渲染或后端环境变量。`dist/` 是生成产物，不提交到 Git。

## 本地开发

在仓库根目录安装依赖后执行：

```bash
# 预览源文件，默认 http://localhost:4173
pnpm --filter @waylog/os-web dev

# 生成 os-web/dist/
pnpm --filter @waylog/os-web build

# 预览构建产物
pnpm --filter @waylog/os-web preview
```

预览端口可通过 `PORT` 调整。修改后检查移动端布局、导航链接、图片加载与交互；公开素材使用有权分发的内容，截图中移除个人信息和真实账号。

## 静态部署

将 `os-web/dist/` 部署到静态托管服务即可。Vercel 配置示例：

| 设置 | 值 |
| --- | --- |
| Git Repository | `PraxisGrove/WayLog` 或自己的 Fork |
| Root Directory | `os-web` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | `dist` |

发布前检查下载、仓库、联系与政策链接是否属于目标部署环境。App Web 导出是根目录的 `dist/`，与这里的官网产物分别部署。

默认下载入口指向公开 GitHub Releases。独立部署时同时更新页面中的下载按钮、二维码数据、Open Graph URL/图片、联系与政策链接，使用自有托管地址和发行产物；仓库地址不是静态官网的部署地址。字体与 CDN 脚本的许可见 [第三方声明](../THIRD_PARTY_NOTICES.md)。
