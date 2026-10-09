# 第三方声明

WayLog 的第一方代码、文档及仓库内品牌与印章 PNG/JPG 素材按根目录 [MIT 许可证](LICENSE) 分发。维护者已确认这些图片为自有或 AI 生成素材，并授权随项目按 MIT 分发。第三方作品的权利和许可不会因被本项目使用而变为 MIT。

## 仓库中的上游代码补丁

| 上游与锁定版本 | 本项目中的用途 | 保留的许可 |
| :-- | :-- | :-- |
| `@earendil-works/pi-ai` / `pi-agent-core` 0.84.3 | `patches/` 中的 React Native / Hermes 适配，包含上游代码 | [MIT；Copyright (c) 2025 Mario Zechner](licenses/PI-MIT.txt) |
| `react-native-wechat-lib` 1.1.27 | `patches/react-native-wechat-lib.patch` 中的原生模块兼容修改 | [MIT；Copyright (c) 2019 little-snow-fox](licenses/REACT-NATIVE-WECHAT-LIB-MIT.txt) |

补丁仅修改适配行为，上游版权声明与许可证继续适用。重新分发相关代码时保留对应声明。

## 图标、字体与网站 CDN

App 通过锁定的 `@expo/vector-icons` 15.1.1 使用 Material Icons 和 Font Awesome；该包装模块的 MIT 许可不能替代字体本身的许可。

| 资源 | 使用位置 | 上游许可与来源 |
| :-- | :-- | :-- |
| Material Icons | App 地点、导航和操作图标 | [Apache 2.0](https://github.com/google/material-design-icons/blob/master/LICENSE) |
| Font Awesome 4 字体 | App 微信登录图标 | [SIL OFL 1.1；配套代码为 MIT](https://fontawesome.com/v4/license/)；品牌图标仅用于表示对应服务，不表示其认可本项目 |
| Lora 字体 | `os-web/index.html` 通过 Google Fonts 加载 | [SIL OFL 1.1](https://github.com/google/fonts/blob/main/ofl/lora/OFL.txt) |
| GSAP 3.12.5、ScrollTrigger、ScrollToPlugin | `os-web/index.html` 通过 CDN 加载 | [该版本上游说明](https://github.com/greensock/GSAP/blob/3.12.5/README.md#license)所指向的 [GSAP Standard License](https://gsap.com/community/standard-license/)；属于自定义许可，不是 MIT |

源码仓库未直接收录这些字体文件或 CDN 脚本。若在安装包、网站产物或离线包中分发它们，保留相应版权、许可及适用的 NOTICE；字体和品牌标识遵守各自的使用条件。

## 安装依赖与构建工具

依赖版本由 `pnpm-lock.yaml` 固定，每个包仍使用其自身许可证。本文件列出需要区分的实例，不代替全部依赖的许可证清单。

| 锁定组件 | 包中声明的许可 | 使用边界 |
| :-- | :-- | :-- |
| `@sentry/cli` 3.5.1 | FSL-1.1-MIT | Sentry 构建工具，含用途限制及未来 MIT 条款；不能按当前 MIT 重新标注 |
| `lightningcss` 1.32.0 | MPL-2.0 | CSS 构建工具，分发或修改其组件时检查对应条款 |
| `@img/sharp-libvips-darwin-arm64` 1.2.4 | LGPL-3.0-or-later | 平台图像处理组件示例，分发其二进制时检查对应条款；其他平台按实际安装版本核对 |
| `caniuse-lite` 1.0.30001800 | CC-BY-4.0 | 浏览器兼容性数据，分发时保留适用的署名 |

这些组件由包管理器安装，未复制进源码仓库。发布 APK、容器或网站产物时，根据实际包含的组件收集许可证、版权与 NOTICE，并检查二进制分发要求；依赖升级后重新核对。

## 外部服务内容

高德地图、Unsplash、Pixabay 和其他服务在运行时提供的数据、图片及品牌标识适用各自的服务条款和素材许可。API 接入权限不等于可将服务内容按本项目 MIT 转授。公开示例不包含用户数据、供应商图片快照或真实服务密钥；贡献素材时提供来源及分发依据，无法确认权利的素材不纳入仓库。
