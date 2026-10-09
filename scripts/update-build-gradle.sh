#!/bin/bash

set -euo pipefail

echo "此脚本已停用：Expo prebuild 会通过 plugins/withAndroidReleaseSigning.js 注入签名配置。"
echo "请配置 KEYSTORE_PATH、KEYSTORE_PASSWORD、KEY_ALIAS、KEY_PASSWORD 后运行 pnpm apk。"
exit 1
