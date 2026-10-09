#!/bin/bash

echo "=== Android 应用签名获取工具 ==="
echo ""

if ! command -v java &> /dev/null; then
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

if ! command -v keytool &> /dev/null; then
    echo "❌ 错误: 未找到 keytool 命令"
    echo ""
    echo "keytool 是 Java JDK 的一部分，请确保 Java 已正确安装"
    exit 1
fi

KEYSTORE_FILE="android/app/debug.keystore"
STORE_PASSWORD="android"
KEY_ALIAS="androiddebugkey"

if [ ! -f "$KEYSTORE_FILE" ]; then
    echo "❌ 错误: 未找到 keystore 文件: $KEYSTORE_FILE"
    exit 1
fi

echo "📁 Keystore 文件: $KEYSTORE_FILE"
echo ""

echo "📋 签名信息:"
echo "----------------------------------------"

keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$STORE_PASSWORD" -alias "$KEY_ALIAS" 2>/dev/null | grep -E "(MD5|SHA1|SHA256):" | while read line; do
    echo "$line"
done

echo ""
echo "----------------------------------------"
echo ""

MD5_SIGNATURE=$(keytool -list -v -keystore "$KEYSTORE_FILE" -storepass "$STORE_PASSWORD" -alias "$KEY_ALIAS" 2>/dev/null | grep "MD5:" | awk '{print $2}' | tr -d ':')

if [ -n "$MD5_SIGNATURE" ]; then
    echo "✅ 微信开放平台需要的签名 (MD5):"
    echo "   $MD5_SIGNATURE"
    echo ""
    echo "📝 请将此签名配置到微信开放平台:"
    echo "   1. 登录微信开放平台 (open.weixin.qq.com)"
    echo "   2. 进入移动应用管理"
    echo "   3. 修改应用签名"
    echo "   4. 粘贴上面的 MD5 签名"
else
    echo "❌ 无法获取 MD5 签名"
    echo ""
    echo "请手动运行以下命令查看签名:"
    echo "  keytool -list -v -keystore $KEYSTORE_FILE -storepass $STORE_PASSWORD -alias $KEY_ALIAS"
fi

echo ""
echo "=== 签名获取完成 ==="
