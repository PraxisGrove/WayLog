#!/usr/bin/env node

const http = require("node:http");
const https = require("node:https");

const DEFAULT_BASE_URL = "http://localhost:8098";
const CHECKLIST_TRIP_TITLE = "测试行程";

const CHECKLIST = [
  {
    id: "add-place",
    title: "添加地点",
    command: `把圆通山加入${CHECKLIST_TRIP_TITLE}第七天`,
    expected: "出现地点候选，选择候选后第七天新增圆通山。",
  },
  {
    id: "delete-place",
    title: "删除地点",
    command: `删除${CHECKLIST_TRIP_TITLE}第七天的圆通山`,
    expected: "出现高风险删除提案，确认后第七天不再包含圆通山。",
  },
  {
    id: "update-note",
    title: "修改备注",
    command: `把${CHECKLIST_TRIP_TITLE}第七天旮旯食堂的备注改成回归备注{stamp}`,
    expected: "出现更新提案，确认后第七天明细显示新备注。",
  },
  {
    id: "update-time",
    title: "修改时间",
    command: `把${CHECKLIST_TRIP_TITLE}第七天旮旯食堂的时间改成19:{minute}`,
    expected: "出现更新提案，确认后第七天明细显示新时间。",
  },
  {
    id: "move-place",
    title: "移动地点",
    command: `把${CHECKLIST_TRIP_TITLE}第七天的旮旯食堂移动到第六天最后`,
    expected: "出现中风险移动提案，确认后第六天包含旮旯食堂，第七天不包含。",
  },
  {
    id: "restore-move",
    title: "恢复移动状态",
    command: `把${CHECKLIST_TRIP_TITLE}第六天的旮旯食堂移动到第七天最后`,
    expected: "确认后第六天只剩云南大学东陆校区，第七天恢复旮旯食堂。",
  },
];

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    checklist: false,
    day6Date: "",
    day7Date: "",
    headless: false,
    run: false,
    tripId: "",
    tripTitle: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--checklist") {
      args.checklist = true;
      continue;
    }

    if (arg === "--run") {
      args.run = true;
      continue;
    }

    if (arg === "--headless") {
      args.headless = true;
      continue;
    }

    if (arg === "--base-url") {
      args.baseUrl = argv[index + 1] ?? args.baseUrl;
      index += 1;
      continue;
    }

    if (arg === "--trip-id") {
      args.tripId = argv[index + 1] ?? args.tripId;
      index += 1;
      continue;
    }

    if (arg === "--trip-title") {
      args.tripTitle = argv[index + 1] ?? args.tripTitle;
      index += 1;
      continue;
    }

    if (arg === "--day6-date") {
      args.day6Date = argv[index + 1] ?? args.day6Date;
      index += 1;
      continue;
    }

    if (arg === "--day7-date") {
      args.day7Date = argv[index + 1] ?? args.day7Date;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Agent UI 回归验收

用法:
  pnpm agent:ui-regression
  pnpm agent:ui-regression -- --checklist
  pnpm agent:ui-regression -- --run --trip-id your-test-trip-id --trip-title "测试行程" --day6-date "第六天日期标签" --day7-date "第七天日期标签"

说明:
  默认只打印验收清单，不改本地数据。
  自动运行必须显式提供测试行程 ID、标题以及第六天和第七天的日期标签。
  日期标签应与页面显示一致；测试行程需预先准备对应的七天示例安排。
  --run 会修改测试行程，请使用测试账号与可修改的测试数据。
  可追加 --base-url 指定预览地址，或 --headless 使用无界面浏览器。
  --run 会使用项目 devDependency 里的 Playwright 驱动浏览器。
  若提示没有找到 Playwright，先运行:
    pnpm install
  若提示缺少浏览器，再安装 Chromium:
    node_modules\\.bin\\playwright.CMD install chromium
`);
}

function printChecklist() {
  console.log("Agent UI 回归验收清单");
  console.log("");

  for (const [index, item] of CHECKLIST.entries()) {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   输入: ${item.command}`);
    console.log(`   通过: ${item.expected}`);
  }
}

function getDaySectionByDate(text, dateLabel, nextDateLabel) {
  const startMarker = `${dateLabel} ·`;
  const startIndex = text.indexOf(startMarker);

  if (startIndex < 0) {
    return "";
  }

  const endIndex = nextDateLabel
    ? text.indexOf(`${nextDateLabel} ·`, startIndex + startMarker.length)
    : -1;

  return text.slice(startIndex, endIndex >= 0 ? endIndex : undefined);
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "没有找到 Playwright，无法自动跑 UI 回归。",
        "可以先用清单手动验收，或先安装项目依赖:",
        "  pnpm install",
        "如果后续提示缺少浏览器，再运行:",
        "  node_modules\\.bin\\playwright.CMD install chromium",
        "",
        `原始错误: ${details}`,
      ].join("\n"),
    );
  }
}

async function launchChromium(chromium, headless) {
  try {
    return await chromium.launch({ headless });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Playwright 已安装，但没有成功启动 Chromium。",
        "如果是首次运行，请先安装浏览器二进制:",
        "  node_modules\\.bin\\playwright.CMD install chromium",
        "",
        `原始错误: ${details}`,
      ].join("\n"),
    );
  }
}

async function gotoPage(page, url, label) {
  try {
    await page.goto(url, { timeout: 10_000, waitUntil: "domcontentloaded" });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        `无法打开${label}。`,
        `目标地址: ${url}`,
        "请确认 Expo Web 预览已启动，并且该页面能在浏览器中正常打开。",
        "",
        `原始错误: ${details}`,
      ].join("\n"),
    );
  }
}

async function assertPreviewAvailable(baseUrl) {
  try {
    const statusCode = await requestPreviewStatus(baseUrl);

    if (statusCode >= 500) {
      throw new Error(`HTTP ${statusCode}`);
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        "Agent UI 回归需要先启动 Expo Web 预览。",
        `当前无法访问: ${baseUrl}`,
        "请先运行 pnpm dev 或 pnpm web，并确认浏览器能打开该地址。",
        "",
        `原始错误: ${details}`,
      ].join("\n"),
    );
  }
}

function requestPreviewStatus(baseUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      { method: "GET", timeout: 3000 },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        response.destroy();
        resolve(statusCode);
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("预览服务连接超时"));
    });
    request.on("error", reject);
    request.end();
  });
}

async function runRegression(args) {
  const { chromium } = await importPlaywright();
  const stamp = String(Date.now()).slice(-6);
  const minute = String((Number(stamp.slice(-2)) % 50) + 10).padStart(2, "0");
  const noteValue = `回归备注${stamp}`;
  const timeValue = `19:${minute}`;
  const tripUrl = `${args.baseUrl.replace(/\/$/, "")}/trips/${args.tripId}`;
  const agentUrl = `${args.baseUrl.replace(/\/$/, "")}/agent?tripId=${encodeURIComponent(args.tripId)}&tripTitle=${encodeURIComponent(args.tripTitle)}`;
  await assertPreviewAvailable(args.baseUrl);
  const browser = await launchChromium(chromium, args.headless);
  const page = await browser.newPage({
    viewport: { height: 1026, width: 561 },
  });
  const results = [];

  try {
    await ensureSignedIn(page, agentUrl);
    await gotoPage(page, tripUrl, "行程详情页");
    await page.waitForTimeout(1500);
    const initialTripText = await page.locator("body").innerText();
    if (
      !initialTripText.includes(args.tripTitle) ||
      !initialTripText.includes(args.day7Date)
    ) {
      throw new Error("测试 Trip 尚未同步到当前登录会话，无法执行 UI 回归。");
    }

    async function sendAgentMessage(message) {
      await gotoPage(page, agentUrl, "Agent 页面");
      await page.waitForTimeout(1200);
      await page
        .getByLabel("输入给旅行助手的消息", { exact: true })
        .fill(message);
      await page.getByRole("button", { name: "发送消息", exact: true }).click();
      await page
        .getByRole("button", { name: "取消当前处理", exact: true })
        .waitFor({ timeout: 5000 });
      await page
        .getByRole("button", { name: "发送消息", exact: true })
        .waitFor({ timeout: 90_000 });
      await page.waitForTimeout(500);
      return page.locator("body").innerText();
    }

    async function readTripSections() {
      await gotoPage(page, tripUrl, "行程详情页");
      await page.waitForTimeout(1500);
      const text = await page.locator("body").innerText();

      return {
        day6: getDaySectionByDate(text, args.day6Date, args.day7Date),
        day7: getDaySectionByDate(text, args.day7Date),
        text,
      };
    }

    async function readDay7Detail() {
      await gotoPage(page, tripUrl, "行程详情页");
      await page.waitForTimeout(1500);
      await page.getByText("第七天", { exact: true }).click();
      await page.waitForTimeout(1200);
      const text = await page.locator("body").innerText();

      return getDaySectionByDate(text, args.day7Date);
    }

    function record(name, pass, detail) {
      results.push({ detail, name, pass });
      console.log(
        `${pass ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`,
      );
    }

    const addText = await sendAgentMessage(
      `把圆通山加入${args.tripTitle}第七天`,
    );
    if (addText.includes("地点候选确认")) {
      await page.getByText("圆通山(地铁站)").click();
      await page.waitForTimeout(4000);
    }
    const afterAdd = await readTripSections();
    record("添加地点", afterAdd.day7.includes("圆通山"), "第七天应包含圆通山");

    const deleteText = await sendAgentMessage(
      `删除${args.tripTitle}第七天的圆通山`,
    );
    const deleteProposal =
      deleteText.includes("强确认删除") && deleteText.includes("圆通山");
    if (deleteProposal) {
      await page.getByText("强确认删除", { exact: true }).click();
      await page.waitForTimeout(3000);
    }
    const afterDelete = await readTripSections();
    record(
      "删除地点",
      deleteProposal && !afterDelete.day7.includes("圆通山"),
      "第七天不应再包含圆通山",
    );

    const noteText = await sendAgentMessage(
      `把${args.tripTitle}第七天旮旯食堂的备注改成${noteValue}`,
    );
    const noteProposal =
      noteText.includes("确认更新") && noteText.includes(noteValue);
    if (noteProposal) {
      await page.getByText("确认更新", { exact: true }).click();
      await page.waitForTimeout(3000);
    }
    const afterNote = await readDay7Detail();
    record(
      "修改备注",
      noteProposal && afterNote.includes(noteValue),
      noteValue,
    );

    const timeText = await sendAgentMessage(
      `把${args.tripTitle}第七天旮旯食堂的时间改成${timeValue}`,
    );
    const timeProposal =
      timeText.includes("确认更新") && timeText.includes(timeValue);
    if (timeProposal) {
      await page.getByText("确认更新", { exact: true }).click();
      await page.waitForTimeout(3000);
    }
    const afterTime = await readDay7Detail();
    record(
      "修改时间",
      timeProposal && afterTime.includes(timeValue),
      timeValue,
    );

    const moveText = await sendAgentMessage(
      `把${args.tripTitle}第七天的旮旯食堂移动到第六天最后`,
    );
    const moveProposal =
      moveText.includes("强确认调整") && moveText.includes("旮旯食堂");
    if (moveProposal) {
      await page.getByText("强确认调整", { exact: true }).click();
      await page.waitForTimeout(3500);
    }
    const afterMove = await readTripSections();
    record(
      "移动地点",
      moveProposal &&
        afterMove.day6.includes("旮旯食堂") &&
        !afterMove.day7.includes("旮旯食堂"),
      "旮旯食堂应移动到第六天",
    );

    const restoreText = await sendAgentMessage(
      `把${args.tripTitle}第六天的旮旯食堂移动到第七天最后`,
    );
    const restoreProposal =
      restoreText.includes("强确认调整") && restoreText.includes("旮旯食堂");
    if (restoreProposal) {
      await page.getByText("强确认调整", { exact: true }).click();
      await page.waitForTimeout(3500);
    }
    const afterRestore = await readTripSections();
    record(
      "恢复移动状态",
      restoreProposal &&
        !afterRestore.day6.includes("旮旯食堂") &&
        afterRestore.day7.includes("旮旯食堂"),
      "旮旯食堂应回到第七天",
    );

    const finalDay7 = await readDay7Detail();
    record(
      "最终状态",
      finalDay7.includes("旮旯食堂") &&
        finalDay7.includes(noteValue) &&
        finalDay7.includes(timeValue),
      "第七天应保留旮旯食堂、备注和时间",
    );

    const failed = results.filter((result) => !result.pass);

    if (failed.length > 0) {
      console.error("");
      console.error("Agent UI 回归失败:");
      console.error(JSON.stringify(failed, null, 2));
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("Agent UI 回归通过。");
  } finally {
    await browser.close();
  }
}

async function ensureSignedIn(page, agentUrl) {
  await gotoPage(page, agentUrl, "Agent 页面");
  await page.waitForTimeout(1200);
  const input = page.getByLabel("输入给旅行助手的消息", { exact: true });

  if (await input.isEditable()) return;

  const email = process.env.AGENT_TURN_EMAIL?.trim();
  const password = process.env.AGENT_TURN_PASSWORD?.trim();

  if (!email || !password) {
    throw new Error(
      "自动回归需要 AGENT_TURN_EMAIL 和 AGENT_TURN_PASSWORD 才能登录测试账号。",
    );
  }

  await gotoPage(page, new URL("/profile", agentUrl).toString(), "登录页");
  await page.waitForTimeout(1000);
  await page
    .getByRole("button", { name: "密码登录", exact: true })
    .first()
    .click();
  await page.getByPlaceholder("邮箱账号或手机号").fill(email);
  const passwordInput = page.getByPlaceholder("登录密码");
  await passwordInput.waitFor();
  await passwordInput.fill(password);
  const agreement = page.getByRole("checkbox").first();
  if ((await agreement.getAttribute("aria-checked")) !== "true") {
    await agreement.click({ position: { x: 10, y: 10 } });
  }
  const loginButtons = page.getByText("密码登录", { exact: true });
  let submitted = false;
  for (let index = (await loginButtons.count()) - 1; index >= 0; index -= 1) {
    if (await loginButtons.nth(index).isVisible()) {
      await loginButtons.nth(index).click();
      submitted = true;
      break;
    }
  }
  if (!submitted) throw new Error("没有找到可见的密码登录按钮。");
  await page.waitForTimeout(2000);
  await gotoPage(page, agentUrl, "Agent 页面");
  await page.waitForTimeout(1200);

  if (!(await input.isEditable())) {
    throw new Error("测试账号登录后，Agent 输入框仍不可编辑。");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.run) {
    printChecklist();
    console.log("");
    console.log("自动运行需要显式指定测试行程，参数说明见 --help。");
    return;
  }

  const missing = [
    ["--trip-id", args.tripId],
    ["--trip-title", args.tripTitle],
    ["--day6-date", args.day6Date],
    ["--day7-date", args.day7Date],
  ]
    .filter(([, value]) => !value.trim() || value.startsWith("--"))
    .map(([flag]) => flag);

  if (missing.length > 0) {
    throw new Error(
      `自动回归必须显式提供测试目标参数：${missing.join("、")}。参数说明见 --help。`,
    );
  }

  await runRegression(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
