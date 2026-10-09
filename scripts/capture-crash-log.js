const { execSync, spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

function writeLine(...messages) {
  process.stdout.write(`${messages.join(" ")}\n`);
}

function writeErrorLine(...messages) {
  process.stderr.write(`${messages.join(" ")}\n`);
}

const PROJECT_ROOT = join(__dirname, "..");
const LOG_FILE = join(PROJECT_ROOT, "crash-log.txt");
const FULL_LOG_FILE = join(PROJECT_ROOT, "crash-log-full.txt");

writeLine("📱 Android 崩溃日志捕获工具（增强版）");
writeLine("=".repeat(50));
writeLine("");

try {
  execSync("adb version", { stdio: "ignore" });
} catch {
  writeErrorLine("❌ 找不到 adb 命令！");
  writeErrorLine("");
  writeErrorLine("请确保：");
  writeErrorLine("  1. 已安装 Android Studio 或 Android SDK Platform Tools");
  writeErrorLine("  2. 已将 adb 添加到 PATH 环境变量");
  writeErrorLine("");
  process.exit(1);
}

let deviceCount = 0;
try {
  const output = execSync("adb devices", { encoding: "utf8" });
  const lines = output.split("\n").filter((l) => l.includes("\tdevice"));
  deviceCount = lines.length;
} catch {
  // ignore
}

if (deviceCount === 0) {
  writeErrorLine("❌ 没有检测到已连接的 Android 设备！");
  writeErrorLine("");
  writeErrorLine("请确保：");
  writeErrorLine("  1. 手机已通过 USB 连接到电脑");
  writeErrorLine("  2. 手机已开启「开发者选项」");
  writeErrorLine("  3. 手机已开启「USB 调试」");
  writeErrorLine("  4. 手机上已授权此电脑的调试权限");
  writeErrorLine("");
  process.exit(1);
}

writeLine(`✅ 检测到 ${deviceCount} 个设备`);
writeLine("");
writeLine("📋 正在捕获崩溃日志...");
writeLine("   请在手机上启动 app 并等待闪退");
writeLine("   捕获完成后按 Ctrl+C 保存日志");
writeLine("");
writeLine("   会生成两个文件：");
writeLine("   - crash-log.txt：关键错误信息");
writeLine("   - crash-log-full.txt：完整日志（用于深度分析）");
writeLine("");

try {
  execSync("adb logcat -c", { stdio: "ignore" });
} catch {
  // ignore
}

const crashLogcat = spawn(
  "adb",
  [
    "logcat",
    "-s",
    "AndroidRuntime:E",
    "ReactNative:E",
    "ReactNativeJS:E",
    "ExpoModulesCore:E",
    "expo:E",
    "System.err:W",
    "FATAL:E",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
  },
);

const fullLogcat = spawn("adb", ["logcat", "-v", "threadtime", "*:W"], {
  stdio: ["ignore", "pipe", "pipe"],
});

const crashLogs = [];
const fullLogs = [];

crashLogcat.stdout.on("data", (data) => {
  const text = data.toString();
  crashLogs.push(text);
  process.stdout.write(text);
});

crashLogcat.stderr.on("data", (data) => {
  const text = data.toString();
  crashLogs.push(text);
  process.stderr.write(text);
});

fullLogcat.stdout.on("data", (data) => {
  fullLogs.push(data.toString());
});

fullLogcat.stderr.on("data", (data) => {
  fullLogs.push(data.toString());
});

process.on("SIGINT", () => {
  writeLine("");
  writeLine("💾 正在保存日志...");

  if (crashLogs.length > 0) {
    writeFileSync(LOG_FILE, crashLogs.join(""), "utf8");
    writeLine(`✅ 关键错误日志已保存到: ${LOG_FILE}`);
  } else {
    writeLine("⚠️ 没有捕获到关键错误日志");
  }

  if (fullLogs.length > 0) {
    writeFileSync(FULL_LOG_FILE, fullLogs.join(""), "utf8");
    writeLine(`✅ 完整日志已保存到: ${FULL_LOG_FILE}`);
  }

  writeLine("");
  writeLine(
    "日志可能包含账号、位置和访问凭据，请先脱敏，再用于缺陷报告或本地分析。",
  );

  crashLogcat.kill();
  fullLogcat.kill();
  process.exit(0);
});

crashLogcat.on("close", (code) => {
  if (code !== null && code !== 0) {
    writeLine(`\n⚠️ crash logcat 退出，代码: ${code}`);
  }
});

fullLogcat.on("close", (code) => {
  if (code !== null && code !== 0) {
    writeLine(`\n⚠️ full logcat 退出，代码: ${code}`);
  }
});
