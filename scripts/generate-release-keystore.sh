#!/bin/bash

echo "=== 生成 Release Keystore ==="
echo ""

if ! command -v java &>/dev/null; then
    echo "❌ 错误: 未找到 Java 环境"
    echo ""
    echo "请安装 Java JDK 并配置环境变量"
    echo "下载地址: https://www.oracle.com/java/technologies/downloads/"
    echo ""
    echo "或者使用 Android Studio 自带的 Java:"
    echo "1. 打开 Android Studio"
    echo "2. 进入 File → Project Structure → SDK Location"
    echo "3. 查看 JDK 路径"
    echo ""
    echo "然后将以下路径添加到 PATH 环境变量:"
    echo "  Windows: C:\\Program Files\\Android\\Android Studio\\jbr\\bin"
    echo "  Mac: /Applications/Android Studio.app/Contents/jbr/Contents/Home/bin"
    exit 1
fi

if ! command -v keytool &>/dev/null; then
    echo "❌ 错误: 未找到 keytool 命令"
    echo ""
    echo "keytool 是 Java JDK 的一部分，请确保 Java 已正确安装"
    exit 1
fi

KEYSTORE_FILE="${KEYSTORE_PATH:-android/app/release.keystore}"
KEY_ALIAS="${KEY_ALIAS:-waylog}"
STORE_PASSWORD="${KEYSTORE_PASSWORD:-}"
KEY_PASSWORD="${KEY_PASSWORD:-}"
VALIDITY=10000
DNAME="CN=WayLog, OU=Dev, O=WayLog, L=Beijing, ST=Beijing, C=CN"

if [ -z "$STORE_PASSWORD" ] || [ -z "$KEY_PASSWORD" ]; then
    echo "❌ 请先通过环境变量配置 KEYSTORE_PASSWORD 和 KEY_PASSWORD"
    exit 1
fi

if [ -f "$KEYSTORE_FILE" ]; then
    echo "⚠️  警告: Keystore 文件已存在: $KEYSTORE_FILE"
    echo ""
    read -p "是否覆盖? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "操作取消"
        exit 0
    fi
fi

echo "📁 Keystore 文件: $KEYSTORE_FILE"
echo "🔑 密钥别名: $KEY_ALIAS"
echo "🔒 密码: 已从环境变量读取"
echo "📅 有效期: $VALIDITY 天"
echo ""

echo "▶ 生成 keystore..."
keytool -genkeypair \
    -keystore "$KEYSTORE_FILE" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity "$VALIDITY" \
    -storepass "$STORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "$DNAME" \
    -noprompt

if [ $? -ne 0 ]; then
    echo "❌ 生成 keystore 失败"
    exit 1
fi

echo "✅ Keystore 生成成功"
echo ""

echo "📋 签名信息:"
echo "----------------------------------------"

keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$STORE_PASSWORD" -alias "$KEY_ALIAS" 2>/dev/null | grep -E "(MD5|SHA1|SHA256):" | while read line; do
    echo "$line"
done

echo ""
echo "----------------------------------------"
echo ""

MD5_SIGNATURE=$(keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$STORE_PASSWORD" -alias "$KEY_ALIAS" 2>/dev/null | grep "MD5:" | awk '{print $2}' | tr -d ':' | tr '[:upper:]' '[:lower:]')

if [ -n "$MD5_SIGNATURE" ]; then
    echo "✅ 微信开放平台需要的签名 (MD5):"
    echo "   $MD5_SIGNATURE"
    echo ""
    echo "📝 请将此签名配置到:"
    echo "   1. 微信开放平台 (open.weixin.qq.com) → 移动应用 → 应用签名"
    echo "   2. 阿里云控制台 → 号号认证服务 → 包签名"
else
    echo "❌ 无法获取 MD5 签名"
fi

echo ""
echo "=== 生成完成 ==="
echo ""
echo "下一步:"
echo "1. 修改 android/app/build.gradle，配置使用新的 keystore"
echo "2. 更新微信开放平台签名"
echo "3. 更新阿里云短信服务签名"
echo "4. 重新构建应用"
