//
//
const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join, resolve } = require("node:path");

function writeLine(...messages) {
  process.stdout.write(`${messages.join(" ")}\n`);
}

function writeErrorLine(...messages) {
  process.stderr.write(`${messages.join(" ")}\n`);
}

const PROJECT_ROOT = resolve(__dirname, "..");
const APK_PATH = join(
  PROJECT_ROOT,
  "android",
  "app",
  "build",
  "outputs",
  "apk",
  "release",
  "app-release.apk",
);

function log(message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  writeLine(`[${time}] ${message}`);
}

function hasCommand(command) {
  try {
    const checker = process.platform === "win32" ? "where" : "command -v";
    execSync(`${checker} ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, options = {}) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      cwd: options.cwd || PROJECT_ROOT,
      timeout: options.timeout || 120_000,
      ...options,
    });
  } catch (err) {
    if (options.ignoreError) return null;
    throw err;
  }
}

function checkAdb() {
  log("🔍 检查 adb 环境...");

  if (!hasCommand("adb")) {
    const commonPaths = [
      join(
        process.env.LOCALAPPDATA || "",
        "Android",
        "Sdk",
        "platform-tools",
        "adb.exe",
      ),
      join(
        process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "",
        "platform-tools",
        "adb.exe",
      ),
    ];

    const found = commonPaths.find((p) => existsSync(p));
    if (found) {
      process.env.PATH = `${join(found, "..")};${process.env.PATH}`;
      log(`  ✅ 找到 adb: ${found}`);
    } else {
      writeErrorLine("");
      writeErrorLine("❌ 找不到 adb 命令！");
      writeErrorLine("");
      writeErrorLine("解决方式：");
      writeErrorLine("  1. 确保已安装 Android SDK platform-tools");
      writeErrorLine("  2. 将 adb 添加到系统 PATH：");
      writeErrorLine(`     %LOCALAPPDATA%\\Android\\Sdk\\platform-tools`);
      writeErrorLine("");
      process.exit(1);
    }
  } else {
    log("  ✅ adb 已安装");
  }

  try {
    const output = runCommand("adb devices", { silent: true });
    const lines = output.split("\n").filter((l) => l.includes("\tdevice"));
    if (lines.length === 0) {
      writeErrorLine("");
      writeErrorLine("❌ 未检测到 Android 设备！");
      writeErrorLine("");
      writeErrorLine("请确保：");
      writeErrorLine("  1. 手机已通过 USB 连接电脑");
      writeErrorLine("  2. 手机已开启「开发者选项」→「USB 调试」");
      writeErrorLine("  3. 手机上已点击「允许 USB 调试」弹窗");
      writeErrorLine("");
      process.exit(1);
    }
    log(`  ✅ 检测到 ${lines.length} 台设备`);
    lines.forEach((l) => {
      const serial = l.split("\t")[0];
      log(`     📱 ${serial}`);
    });
  } catch {
    writeErrorLine("❌ adb 设备检测失败，请检查 adb 连接");
    process.exit(1);
  }

  log("");
}

function buildApk() {
  log("🏗️  开始构建 APK...");
  log("");

  try {
    runCommand("pnpm apk", { timeout: 30 * 60 * 1000 });
    log("");
  } catch (err) {
    writeErrorLine("");
    writeErrorLine("❌ APK 构建失败！");
    writeErrorLine(err.message);
    process.exit(1);
  }

  if (!existsSync(APK_PATH)) {
    writeErrorLine(`❌ 构建完成但未找到 APK: ${APK_PATH}`);
    process.exit(1);
  }

  log(`✅ APK 构建成功: ${APK_PATH}`);
  log("");
}

function installApk() {
  log("📲 覆盖安装到手机...");

  try {
    const output = runCommand(`adb install -r "${APK_PATH}"`, {
      timeout: 60_000,
    });
    if (output?.includes("Success")) {
      log("✅ 安装成功！");
    }
  } catch {
    writeErrorLine("");
    writeErrorLine("❌ 安装失败！");
    writeErrorLine("");
    writeErrorLine("可能原因：");
    writeErrorLine("  1. 手机存储空间不足");
    writeErrorLine("  2. 签名冲突（如果之前安装了不同签名的版本）");
    writeErrorLine("  3. 手机上弹出了安装确认弹窗，请在手机上确认");
    writeErrorLine("");
    writeErrorLine("尝试手动安装：");
    writeErrorLine(`  adb install -r "${APK_PATH}"`);
    writeErrorLine("");
    process.exit(1);
  }

  log("");
}

function main() {
  writeLine("");
  writeLine("╔══════════════════════════════════════╗");
  writeLine("║   📱 一路记 Android 调试安装工具      ║");
  writeLine("╚══════════════════════════════════════╝");
  writeLine("");

  const startTime = Date.now();

  checkAdb();
  buildApk();
  installApk();

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const duration = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;

  writeLine("╔══════════════════════════════════════╗");
  writeLine("║   🎉 调试安装完成！                   ║");
  writeLine("╚══════════════════════════════════════╝");
  writeLine("");
  writeLine(`  ⏱️  总耗时: ${duration}`);
  writeLine("  📱 应用已安装到手机，可以开始调试");
  writeLine("");

  log("🚀 尝试启动应用...");
  try {
    runCommand(
      "adb shell monkey -p top.waylog.app -c android.intent.category.LAUNCHER 1",
      { silent: true },
    );
    log("✅ 应用已启动");
  } catch {
    log("⚠️  自动启动失败，请手动打开应用");
  }

  writeLine("");
}

main();
