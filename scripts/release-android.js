//
//
//
//
//
const { execSync } = require("node:child_process");
const {
  copyFileSync,
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const { basename, join, resolve } = require("node:path");
const { request } = require("node:https");
const os = require("node:os");
const {
  RELEASE_ANDROID_ABIS,
  RELEASE_ANDROID_ABI_PROPERTY,
} = require("../plugins/withAndroidReleaseAbis");

function writeLine(...messages) {
  process.stdout.write(`${messages.join(" ")}\n`);
}

function writeErrorLine(...messages) {
  process.stderr.write(`${messages.join(" ")}\n`);
}

function parseJson(value, context) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${context} 不是有效 JSON`, { cause: error });
  }
}

function parseUrl(value, context) {
  try {
    return new URL(value);
  } catch (error) {
    throw new Error(`${context} 不是有效 URL`, { cause: error });
  }
}

const PGYER_UPLOAD_URL = "https://www.pgyer.com/apiv2/app/upload";

const PROJECT_ROOT = resolve(__dirname, "..");

const TMP_DIR = join(PROJECT_ROOT, ".tmp");

const GRADLE_TIMEOUT = 30 * 60 * 1000;

function loadEnvFile(filePath) {
  const result = {};
  if (!existsSync(filePath)) return result;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }
  return result;
}

const envLocal = loadEnvFile(join(PROJECT_ROOT, ".env.local"));

function getEnv(name) {
  return process.env[name]?.trim() || envLocal[name] || "";
}

const PGYER_API_KEY = getEnv("PGYER_API_KEY");

const PGYER_PASSWORD = getEnv("PGYER_INSTALL_PASSWORD");

function getGithubToken() {
  return getEnv("GITHUB_TOKEN") || getEnv("GH_TOKEN");
}

function parseArgs() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const positional = [];
  let description = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--description" || arg === "--message" || arg === "-m") {
      description = args[i + 1] || "";
      i++;
      continue;
    }

    if (arg.startsWith("-")) {
      continue;
    }

    positional.push(arg);
  }

  const KNOWN_SUBCOMMANDS = ["pgyer", "github", "build-only"];
  const extraPositional = positional.filter(
    (p) => !KNOWN_SUBCOMMANDS.includes(p),
  );

  return {
    buildOnly:
      args.includes("--build-only") || positional.includes("build-only"),
    pgyer: args.includes("--pgyer") || positional.includes("pgyer"),
    github: args.includes("--github") || positional.includes("github"),
    description: description || extraPositional.join(" "),
  };
}

function hasCommand(command) {
  const checker = process.platform === "win32" ? "where" : "command -v";
  try {
    execSync(`${checker} ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getLocalBinCommand(command) {
  const executable = process.platform === "win32" ? `${command}.CMD` : command;
  const commandPath = join(PROJECT_ROOT, "node_modules", ".bin", executable);
  return existsSync(commandPath) ? `"${commandPath}"` : null;
}

function log(message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  writeLine(`[${time}] ${message}`);
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function generateVersion() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${d}-${h}${min}`;
}

function generateVersionCode() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  return parseInt(`${y}${m}${d}${h}`, 10);
}

function injectVersionToAppJson(version, versionCode) {
  const appJsonPath = join(PROJECT_ROOT, "app.json");
  const original = readFileSync(appJsonPath, "utf-8");
  const appJson = parseJson(original, "app.json");
  let finalized = false;

  const originalVersion = appJson.expo.version;
  const originalVersionCode = appJson.expo.android?.versionCode;

  appJson.expo.version = version;
  if (!appJson.expo.android) {
    appJson.expo.android = {};
  }
  appJson.expo.android.versionCode = versionCode;

  writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, "utf-8");
  log(
    `📝 已将版本号注入 app.json: version=${version}, versionCode=${versionCode}`,
  );

  const restore = () => {
    if (finalized) {
      return;
    }
    finalized = true;
    const current = parseJson(
      readFileSync(appJsonPath, "utf-8"),
      "恢复版本号时的 app.json",
    );
    current.expo.version = originalVersion;
    if (originalVersionCode !== undefined) {
      if (!current.expo.android) current.expo.android = {};
      current.expo.android.versionCode = originalVersionCode;
    } else if (current.expo.android) {
      delete current.expo.android.versionCode;
    }
    writeFileSync(
      appJsonPath,
      `${JSON.stringify(current, null, 2)}\n`,
      "utf-8",
    );
    log("📝 已恢复 app.json 原始版本号");
  };

  const keep = () => {
    if (finalized) {
      return;
    }
    finalized = true;
    log("📝 已保留 app.json 发布版本号");
  };

  return { keep, restore };
}

function findApk() {
  const androidDir = join(PROJECT_ROOT, "android");
  const results = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    const { readdirSync, statSync: stat } = require("node:fs");
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        if (stat(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith(".apk") && full.includes("release")) {
          results.push(full);
        }
      } catch {
        /* skip permission errors */
      }
    }
  }

  walk(androidDir);

  if (results.length === 0) return null;
  const preferred = results.find((p) => p.endsWith("app-release.apk"));
  return preferred || results[0];
}

function checkEnvironment() {
  log("🔍 检查构建环境...");

  const androidHome =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    join(os.homedir(), "AppData", "Local", "Android", "Sdk");

  if (!existsSync(androidHome)) {
    writeErrorLine("");
    writeErrorLine("❌ 找不到 Android SDK！");
    writeErrorLine("");
    writeErrorLine("请安装 Android Studio 并确保 SDK 已下载：");
    writeErrorLine("  https://developer.android.com/studio");
    writeErrorLine("");
    writeErrorLine("安装后在系统环境变量中设置：");
    writeErrorLine(`  ANDROID_HOME = ${androidHome}`);
    writeErrorLine("");
    process.exit(1);
  }

  log(`  ✅ Android SDK: ${androidHome}`);

  process.env.ANDROID_HOME = androidHome;

  const localPropsPath = join(PROJECT_ROOT, "android", "local.properties");
  const sdkDirLine = `sdk.dir=${androidHome.replace(/\\/g, "\\\\")}`;
  let localPropsContent = "";
  if (existsSync(localPropsPath)) {
    localPropsContent = readFileSync(localPropsPath, "utf8");
    if (/^sdk\.dir=/m.test(localPropsContent)) {
      localPropsContent = localPropsContent.replace(
        /^sdk\.dir=.*$/m,
        sdkDirLine,
      );
    } else {
      localPropsContent += `\n${sdkDirLine}\n`;
    }
  } else {
    localPropsContent = `${sdkDirLine}\n`;
  }
  require("node:fs").writeFileSync(localPropsPath, localPropsContent, "utf8");

  let javaHome = process.env.JAVA_HOME;
  let javaBin = "java";

  if (javaHome) {
    javaBin = join(javaHome, "bin", "java");
  } else {
    const jbrPaths = [
      join(
        os.homedir(),
        "AppData",
        "Local",
        "Programs",
        "Android Studio",
        "jbr",
      ),
      "C:\\Program Files\\Android\\Android Studio\\jbr",
      "C:\\Program Files (x86)\\Android\\Android Studio\\jbr",
    ];
    for (const p of jbrPaths) {
      if (existsSync(join(p, "bin", "java.exe"))) {
        javaHome = p;
        javaBin = join(p, "bin", "java");
        log(`  ℹ️  自动检测到 Android Studio 自带 JDK: ${p}`);
        break;
      }
    }
  }

  if (javaHome) {
    process.env.JAVA_HOME = javaHome;
    const binDir = join(javaHome, "bin");
    if (process.env.PATH && !process.env.PATH.includes(binDir)) {
      process.env.PATH = `${binDir};${process.env.PATH}`;
    }
  }

  let javaFound = false;
  try {
    const javaVer = execSync(`"${javaBin}" -version 2>&1`, {
      encoding: "utf8",
    });
    log(`  ✅ Java: ${javaVer.split("\n")[0] || "已安装"}`);
    javaFound = true;
  } catch {}

  if (!javaFound) {
    writeErrorLine("❌ 找不到 Java，请安装 JDK 17+");
    writeErrorLine("");
    writeErrorLine("推荐方式：");
    writeErrorLine("  1. 安装 Android Studio（自带 JDK）");
    writeErrorLine("     https://developer.android.com/studio");
    writeErrorLine("  2. 或单独安装 JDK 17+");
    writeErrorLine("     https://adoptium.net");
    writeErrorLine("  3. 或设置 JAVA_HOME 环境变量指向 JDK 目录");
    writeErrorLine("");
    process.exit(1);
  }

  const gradlewPath = join(PROJECT_ROOT, "android", "gradlew.bat");
  if (!existsSync(gradlewPath)) {
    log("  ⚠️  android/ 工程不存在，稍后将执行 prebuild");
  }

  log("");
}

function runPrebuild() {
  const androidDir = join(PROJECT_ROOT, "android");
  const alreadyExists = existsSync(androidDir);

  if (alreadyExists) {
    log("📂 android/ 工程已存在，同步 app.json 配置变更（版本号等）...");
  } else {
    log("🏗️  生成原生 Android 工程（expo prebuild）...");
  }

  try {
    const expoCommand = getLocalBinCommand("expo") || "pnpm exec expo";
    execSync(`${expoCommand} prebuild --platform android`, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      stdio: "inherit",
      timeout: 120_000,
    });
    log("✅ Prebuild 完成");
    log("");
  } catch (err) {
    writeErrorLine("❌ Prebuild 失败:", err.message);
    process.exit(1);
  }
}

function ensureKeystore() {
  const configuredStorePassword = getEnv("KEYSTORE_PASSWORD");
  const configuredKeyAlias = getEnv("KEY_ALIAS");
  const configuredKeyPassword = getEnv("KEY_PASSWORD");

  const envKeystore = getEnv("KEYSTORE_PATH");
  if (envKeystore && existsSync(envKeystore)) {
    if (
      !configuredStorePassword ||
      !configuredKeyAlias ||
      !configuredKeyPassword
    ) {
      writeErrorLine(
        "❌ 使用 KEYSTORE_PATH 时还必须配置 KEYSTORE_PASSWORD、KEY_ALIAS 和 KEY_PASSWORD",
      );
      process.exit(1);
    }

    log(`🔑 使用已有签名: ${envKeystore}`);
    return {
      keyAlias: configuredKeyAlias,
      keyPassword: configuredKeyPassword,
      path: envKeystore,
      storePassword: configuredStorePassword,
    };
  }

  const canonicalKeystorePath = join(
    PROJECT_ROOT,
    "android",
    "app",
    "release.keystore",
  );

  if (existsSync(canonicalKeystorePath)) {
    if (
      !configuredStorePassword ||
      !configuredKeyAlias ||
      !configuredKeyPassword
    ) {
      writeErrorLine(
        "❌ 使用 android/app/release.keystore 时仍必须配置 KEYSTORE_PASSWORD、KEY_ALIAS 和 KEY_PASSWORD",
      );
      process.exit(1);
    }

    log(`🔑 使用项目固定签名: ${canonicalKeystorePath}`);
    return {
      keyAlias: configuredKeyAlias,
      keyPassword: configuredKeyPassword,
      path: canonicalKeystorePath,
      storePassword: configuredStorePassword,
    };
  }

  writeErrorLine("❌ 未找到正式 Android 发布签名，已停止构建。");
  writeErrorLine("");
  writeErrorLine("请恢复正式 keystore 并配置签名凭据后重试：");
  writeErrorLine(
    "  在 .env.local / 系统环境变量中配置 KEYSTORE_PASSWORD、KEY_ALIAS、KEY_PASSWORD",
  );
  writeErrorLine(
    "  keystore 可放在 android/app/release.keystore，或通过 KEYSTORE_PATH 指定绝对路径",
  );
  writeErrorLine("");
  writeErrorLine(
    "为避免微信开放平台签名不一致，发布脚本不会再生成或复用 .tmp/release.keystore。",
  );
  process.exit(1);
}

function configureSigning(credentials) {
  log("🔐 配置 Gradle 签名...");

  const gradlePropsPath = join(PROJECT_ROOT, "android", "gradle.properties");
  let content = "";

  if (existsSync(gradlePropsPath)) {
    content = readFileSync(gradlePropsPath, "utf8");
  }

  const lines = content.split("\n").filter((line) => {
    const trimmed = line.trim();
    return (
      !trimmed.includes("release-android.js") &&
      !trimmed.startsWith("RELEASE_STORE_FILE=") &&
      !trimmed.startsWith("RELEASE_STORE_PASSWORD=") &&
      !trimmed.startsWith("RELEASE_KEY_ALIAS=") &&
      !trimmed.startsWith("RELEASE_KEY_PASSWORD=")
    );
  });

  const normalizedPath = credentials.path.replace(/\\/g, "\\\\");
  lines.push("");
  lines.push("# Signing config injected by release-android.js");
  lines.push(`RELEASE_STORE_FILE=${normalizedPath}`);
  lines.push(`RELEASE_STORE_PASSWORD=${credentials.storePassword}`);
  lines.push(`RELEASE_KEY_ALIAS=${credentials.keyAlias}`);
  lines.push(`RELEASE_KEY_PASSWORD=${credentials.keyPassword}`);

  require("node:fs").writeFileSync(
    gradlePropsPath,
    `${lines.join("\n")}\n`,
    "utf8",
  );
  log("✅ 签名配置完成");
  log("");
}

function configureReleaseAndroidAbis() {
  log(`Android release ABIs: ${RELEASE_ANDROID_ABIS}`);

  const gradlePropsPath = join(PROJECT_ROOT, "android", "gradle.properties");
  const propertyLine = `${RELEASE_ANDROID_ABI_PROPERTY}=${RELEASE_ANDROID_ABIS}`;
  const content = existsSync(gradlePropsPath)
    ? readFileSync(gradlePropsPath, "utf8")
    : "";
  const lines = content.split(/\r?\n/);
  const nextLines = [];
  let wroteProperty = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${RELEASE_ANDROID_ABI_PROPERTY}=`)) {
      if (!wroteProperty) {
        nextLines.push(propertyLine);
        wroteProperty = true;
      }
      continue;
    }

    nextLines.push(line);
  }

  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === "") {
    nextLines.pop();
  }

  if (!wroteProperty) {
    if (nextLines.length > 0) {
      nextLines.push("");
    }
    nextLines.push("# Release APK ABIs are fixed by release-android.js.");
    nextLines.push(propertyLine);
  }

  writeFileSync(gradlePropsPath, `${nextLines.join("\n")}\n`, "utf8");
  log("Android release ABI configuration is ready");
  log("");
}

function runGradleBuild() {
  log("🏗️  开始 Gradle 编译...");
  log("  （首次编译会下载依赖，预计 5-15 分钟）");
  log("");

  const startTime = Date.now();

  try {
    const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
    const gradlewPath = join(PROJECT_ROOT, "android", gradlew);

    const buildEnv = {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "production",
      ...envLocal,
    };

    execSync(`"${gradlewPath}" assembleRelease --no-daemon --stacktrace`, {
      cwd: join(PROJECT_ROOT, "android"),
      encoding: "utf8",
      stdio: "inherit",
      timeout: GRADLE_TIMEOUT,
      env: buildEnv,
    });

    const elapsed = formatDuration(Date.now() - startTime);
    log("");
    log(`✅ Gradle 编译完成（总耗时: ${elapsed}）`);

    const apkPath = findApk();
    if (!apkPath) {
      writeErrorLine("❌ 编译完成但未找到 APK 文件！");
      process.exit(1);
    }

    const size = formatSize(statSync(apkPath).size);
    log(`📱 APK: ${apkPath}`);
    log(`📦 大小: ${size}`);
    log("");

    return apkPath;
  } catch (err) {
    writeErrorLine("");
    writeErrorLine("❌ Gradle 编译失败！");
    const output = `${err.stderr || ""}\n${err.stdout || ""}`;
    const lines = output.split("\n").filter((l) => l.trim());
    if (lines.length > 0) {
      writeErrorLine("错误详情:");
      const keyLines = lines.filter((l) =>
        /(FAILURE|Error|Exception|What went wrong|BUILD FAILED)/i.test(l),
      );
      const showLines = keyLines.length > 0 ? keyLines : lines.slice(-20);
      showLines.forEach((l) => {
        writeErrorLine("  ", l);
      });
    }
    process.exit(1);
  }
}

function getRepoInfo() {
  const envRepo = getEnv("GITHUB_REPOSITORY");
  if (envRepo) {
    const [owner, repo] = envRepo.split("/");
    if (owner && repo) {
      return { owner, repo };
    }
  }

  try {
    const url = execSync("git remote get-url origin", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();

    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    const match = url.match(/github\.com[/:](.+?)\/(.+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {}
  return null;
}

function createGithubApiError(prefix, statusCode, responseText) {
  let detail = responseText?.trim() || "空响应";

  try {
    const parsed = JSON.parse(responseText);
    if (parsed && typeof parsed === "object") {
      const message = parsed.message || "";
      const extra = Array.isArray(parsed.errors)
        ? parsed.errors
            .map((item) => {
              if (!item) return "";
              if (typeof item === "string") return item;
              return [item.resource, item.field, item.code, item.message]
                .filter(Boolean)
                .join("/");
            })
            .filter(Boolean)
            .join("; ")
        : "";

      detail = [message, extra].filter(Boolean).join(" | ") || detail;
    }
  } catch {}

  const error = new Error(`${prefix} (HTTP ${statusCode}): ${detail}`);
  error.statusCode = statusCode;
  error.responseText = responseText;
  return error;
}

function githubRequest(
  url,
  { method = "GET", token, headers = {}, body, expectedStatus = [200] },
) {
  const requestUrl =
    url instanceof URL ? url : parseUrl(url, "GitHub API 请求地址");
  const payload =
    body == null
      ? null
      : Buffer.isBuffer(body)
        ? body
        : typeof body === "string"
          ? Buffer.from(body, "utf8")
          : Buffer.from(JSON.stringify(body), "utf8");

  const finalHeaders = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "waylog-release-script",
    "X-GitHub-Api-Version": "2022-11-28",
    ...headers,
  };

  if (payload && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] =
      Buffer.isBuffer(body) || typeof body === "string"
        ? "application/octet-stream"
        : "application/json; charset=utf-8";
  }

  if (payload) {
    finalHeaders["Content-Length"] = String(payload.length);
  }

  return new Promise((resolve, reject) => {
    const req = request(
      requestUrl,
      {
        method,
        headers: finalHeaders,
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        res.on("end", () => {
          const responseText = Buffer.concat(chunks).toString("utf8");
          const statusCode = res.statusCode || 0;

          if (!expectedStatus.includes(statusCode)) {
            reject(
              createGithubApiError(
                `GitHub API 请求失败: ${method} ${requestUrl.origin}${requestUrl.pathname}`,
                statusCode,
                responseText,
              ),
            );
            return;
          }

          let json = null;
          if (responseText) {
            try {
              json = JSON.parse(responseText);
            } catch {
              json = null;
            }
          }

          resolve({
            headers: res.headers,
            json,
            statusCode,
            text: responseText,
          });
        });
      },
    );

    req.on("error", (err) => {
      reject(new Error(`GitHub API 请求失败: ${err.message}`));
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function ensureGithubReleaseViaApi(repoInfo, tag, title, notes, token) {
  const baseUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`;

  try {
    const created = await githubRequest(`${baseUrl}/releases`, {
      body: {
        tag_name: tag,
        name: title,
        body: notes,
        draft: false,
        prerelease: false,
      },
      expectedStatus: [201],
      method: "POST",
      token,
    });

    return created.json;
  } catch (err) {
    if (err.statusCode !== 422) {
      throw err;
    }

    const existing = await githubRequest(
      `${baseUrl}/releases/tags/${encodeURIComponent(tag)}`,
      {
        expectedStatus: [200],
        method: "GET",
        token,
      },
    );

    return existing.json;
  }
}

async function uploadGithubAssetViaApi(
  repoInfo,
  release,
  assetPath,
  assetName,
  token,
) {
  const existingAsset = Array.isArray(release.assets)
    ? release.assets.find((item) => item?.name === assetName)
    : null;

  if (existingAsset?.id) {
    await githubRequest(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/releases/assets/${existingAsset.id}`,
      {
        expectedStatus: [204],
        method: "DELETE",
        token,
      },
    );
  }

  const uploadUrl = parseUrl(
    String(release.upload_url || "").replace(/\{.*$/, ""),
    "GitHub Release 上传地址",
  );
  uploadUrl.searchParams.set("name", assetName);

  const uploaded = await githubRequest(uploadUrl, {
    body: readFileSync(assetPath),
    expectedStatus: [201],
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
    },
    method: "POST",
    token,
  });

  return uploaded.json;
}

async function uploadToGithubRelease(apkPath, version, description) {
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    throw new Error("无法获取 GitHub 仓库信息，请确认已设置 git remote origin");
  }

  log("📦 上传到 GitHub Releases...");

  const tag = `v${version}`;
  const apkName = `WayLog-v${version}.apk`;
  const releaseUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/releases/tag/${tag}`;

  const releaseApkPath = join(TMP_DIR, apkName);
  copyFileSync(apkPath, releaseApkPath);

  const notes = description || `手动构建 ${version}`;

  try {
    if (hasCommand("gh")) {
      const repo = `${repoInfo.owner}/${repoInfo.repo}`;
      execSync(
        `gh release create "${tag}" "${releaseApkPath}"` +
          ` --title "v${version}"` +
          ` --notes "${notes}"` +
          ` --repo ${repo}`,
        {
          cwd: PROJECT_ROOT,
          encoding: "utf8",
          stdio: "pipe",
          timeout: 120_000,
          env: { ...process.env, ...envLocal },
        },
      );
    } else {
      const token = getGithubToken();
      if (!token) {
        throw new Error(
          "未找到 GitHub CLI（gh），且未配置 GITHUB_TOKEN 或 GH_TOKEN，无法上传到 GitHub Releases。",
        );
      }

      log("  使用 GITHUB_TOKEN/GH_TOKEN 直传 GitHub Releases API...");

      const release = await ensureGithubReleaseViaApi(
        repoInfo,
        tag,
        `v${version}`,
        notes,
        token,
      );

      await uploadGithubAssetViaApi(
        repoInfo,
        release,
        releaseApkPath,
        apkName,
        token,
      );
    }

    log(`✅ GitHub Release 创建完成`);
    log(`🔗 ${releaseUrl}`);

    if (existsSync(releaseApkPath)) {
      unlinkSync(releaseApkPath);
    }

    return { releaseUrl, tag };
  } catch (err) {
    if (existsSync(releaseApkPath)) {
      unlinkSync(releaseApkPath);
    }
    const msg = err.stderr || err.stdout || err.message;
    throw new Error(`GitHub Release 创建失败:\n${msg}`);
  }
}

function buildMultipartBody(fields, file, boundary) {
  const CRLF = "\r\n";
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${CRLF}`));
    parts.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}`,
      ),
    );
    parts.push(Buffer.from(`${value}${CRLF}`));
  }

  const fileBuffer = readFileSync(file.path);
  const fileName = basename(file.path);
  parts.push(Buffer.from(`--${boundary}${CRLF}`));
  parts.push(
    Buffer.from(
      `Content-Disposition: form-data; name="${file.name}"; filename="${fileName}"${CRLF}`,
    ),
  );
  parts.push(
    Buffer.from(`Content-Type: application/octet-stream${CRLF}${CRLF}`),
  );
  parts.push(fileBuffer);
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`));

  return Buffer.concat(parts);
}

function uploadToPgyer(apkPath, version, description) {
  return new Promise((resolve, reject) => {
    const fileSize = statSync(apkPath).size;
    log(`📤 上传到蒲公英（文件大小: ${formatSize(fileSize)}）...`);

    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    const fields = { _api_key: PGYER_API_KEY };

    if (PGYER_PASSWORD) {
      fields.installPassword = PGYER_PASSWORD;
    }
    if (version) {
      fields.buildVersion = version;
    }
    if (description) {
      fields.buildUpdateDescription = description;
    }

    const body = buildMultipartBody(
      fields,
      { path: apkPath, name: "file" },
      boundary,
    );

    const urlObj = parseUrl(PGYER_UPLOAD_URL, "蒲公英上传地址");
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
    };

    log("  （上传中，请耐心等待...）");

    const req = request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 0) {
            const shortUrl = `https://www.pgyer.com/${result.data.buildShortCutUrl || result.data.buildKey}`;
            log(`✅ 上传成功！`);
            log(`🔗 下载链接: ${shortUrl}`);
            log(`📱 应用: ${result.data.buildName || "-"}`);
            log(`📌 版本: ${result.data.buildVersion || "-"}`);
            if (PGYER_PASSWORD) {
              log(`🔐 下载密码已设置`);
            }
            resolve({ ...result.data, shortUrl });
          } else {
            reject(
              new Error(
                `蒲公英返回错误: code=${result.code}, message=${result.message || "未知"}`,
              ),
            );
          }
        } catch {
          reject(new Error(`蒲公英响应解析失败: ${data.slice(0, 300)}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`上传失败: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

async function main() {
  const startTime = Date.now();
  let { buildOnly, pgyer, github, description } = parseArgs();
  let hasPublishedArtifact = false;
  const version = generateVersion();
  const versionCode = generateVersionCode();

  const appJsonVersionState = injectVersionToAppJson(version, versionCode);
  process.once("exit", appJsonVersionState.restore);
  process.once("SIGINT", () => {
    appJsonVersionState.restore();
    process.exit(130);
  });

  if (!buildOnly && !pgyer && !github) {
    buildOnly = true;
  }

  const mode =
    pgyer && github
      ? "蒲公英 + GitHub Releases"
      : github
        ? "GitHub Releases"
        : pgyer
          ? "蒲公英"
          : "仅构建（不上传）";

  writeLine("");
  writeLine("╔══════════════════════════════════════╗");
  writeLine("║   🚀 一路记 Android 本地发布工具      ║");
  writeLine("╚══════════════════════════════════════╝");
  writeLine("");
  writeLine(`  📌 版本: ${version}`);
  writeLine(`  📁 项目: ${PROJECT_ROOT}`);
  writeLine(`  🔧 模式: ${mode}`);
  writeLine("");

  checkEnvironment();

  if (pgyer && !PGYER_API_KEY) {
    writeErrorLine("❌ 缺少 PGYER_API_KEY 环境变量。");
    writeErrorLine("");
    writeErrorLine("获取方式：");
    writeErrorLine("  1. 登录蒲公英 https://www.pgyer.com");
    writeErrorLine("  2. 进入「账号设置」→「API Key」");
    writeErrorLine("  3. 复制 API Key");
    writeErrorLine("  4. 添加到 .env.local：PGYER_API_KEY=你的key");
    writeErrorLine("");
    writeErrorLine("提示：");
    writeErrorLine("  pnpm apk build-only           仅构建，不上传");
    writeErrorLine(
      "  pnpm apk github               仅上传到 GitHub Releases（无需蒲公英）",
    );
    writeErrorLine("");
    process.exit(1);
  }

  if (github && !hasCommand("gh") && !getGithubToken()) {
    writeErrorLine(
      "❌ 找不到 GitHub CLI（gh），且未配置 GITHUB_TOKEN / GH_TOKEN，无法上传到 GitHub Releases。",
    );
    writeErrorLine("");
    writeErrorLine("解决方式：");
    writeErrorLine("  1. 仅本地构建：pnpm apk");
    writeErrorLine("  2. 上传蒲公英：pnpm apk pgyer");
    writeErrorLine("  3. 安装并登录 gh：");
    writeErrorLine("     https://cli.github.com/");
    writeErrorLine("  4. 或在 .env.local 中配置 GITHUB_TOKEN=你的 token");
    writeErrorLine("     也可使用 GH_TOKEN，需具备仓库 Contents 写权限");
    writeErrorLine("");
    process.exit(1);
  }

  try {
    runPrebuild();
    configureReleaseAndroidAbis();
    const signingCredentials = ensureKeystore();
    configureSigning(signingCredentials);
    const apkPath = runGradleBuild();

    if (buildOnly) {
      appJsonVersionState.restore();
      const elapsed = formatDuration(Date.now() - startTime);
      writeLine("╔══════════════════════════════════════╗");
      writeLine("║   ✅ 构建完成！                       ║");
      writeLine("╚══════════════════════════════════════╝");
      writeLine("");
      writeLine(`  ⏱️  耗时: ${elapsed}`);
      writeLine(`  📱 APK: ${apkPath}`);
      writeLine("");
      writeLine("  使用 pnpm apk pgyer 可上传到蒲公英");
      writeLine("  使用 pnpm apk github 可上传到 GitHub Releases");
      writeLine("");
      return;
    }

    let pgyerResult = null;
    if (pgyer) {
      pgyerResult = await uploadToPgyer(
        apkPath,
        version,
        description || `日常构建 ${version}`,
      );
      hasPublishedArtifact = true;
    }

    let githubResult = null;
    if (github) {
      githubResult = await uploadToGithubRelease(apkPath, version, description);
      hasPublishedArtifact = true;
    }

    appJsonVersionState.keep();
    const elapsed = formatDuration(Date.now() - startTime);
    writeLine("");
    writeLine("╔══════════════════════════════════════╗");
    writeLine("║   🎉 发布完成！                       ║");
    writeLine("╚══════════════════════════════════════╝");
    writeLine("");
    writeLine(`  ⏱️  总耗时: ${elapsed}`);
    writeLine(`  📌 版本: ${version}`);
    if (pgyerResult) {
      writeLine(`  🚀 蒲公英: ${pgyerResult.shortUrl}`);
    }
    if (githubResult) {
      writeLine(`  📦 GitHub: ${githubResult.releaseUrl}`);
    }
    writeLine("");

    if (existsSync(apkPath)) {
      unlinkSync(apkPath);
      log("🧹 已清理临时 APK");
    }
  } catch (err) {
    if (hasPublishedArtifact) {
      appJsonVersionState.keep();
    } else {
      appJsonVersionState.restore();
    }
    writeErrorLine("");
    writeErrorLine("╔══════════════════════════════════════╗");
    writeErrorLine("║   ❌ 发布失败                         ║");
    writeErrorLine("╚══════════════════════════════════════╝");
    writeErrorLine("");
    writeErrorLine(`错误: ${err.message}`);
    writeErrorLine("");
    process.exit(1);
  } finally {
    process.removeListener("exit", appJsonVersionState.restore);
  }
}

main();
