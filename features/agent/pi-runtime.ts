export type WayLogPiAgentModule =
  typeof import("@earendil-works/pi-agent-core/react-native", { with: {
    "resolution-mode": "import",
  }});
export type WayLogPiAgent = InstanceType<WayLogPiAgentModule["Agent"]>;
export type WayLogPiAgentOptions = ConstructorParameters<
  WayLogPiAgentModule["Agent"]
>[0];

/**
 * WayLog 唯一允许创建 Pi Agent 的入口。模型流必须由认证后的 WayLog 代理适配器注入。
 */
export async function createWayLogPiAgent(
  options: WayLogPiAgentOptions,
): Promise<WayLogPiAgent> {
  const { Agent } = await import("@earendil-works/pi-agent-core/react-native");
  return new Agent(options);
}
