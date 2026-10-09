/**
 * Public Agent feature switch.
 *
 * The Agent entry points should be visible in internal release APKs by default.
 * Set EXPO_PUBLIC_AGENT_ENABLED=false to hide them before a broader rollout.
 */
export function isAgentFeatureEnabled(): boolean {
  const value = process.env.EXPO_PUBLIC_AGENT_ENABLED?.trim().toLowerCase();
  return (
    value !== "false" && value !== "0" && value !== "off" && value !== "no"
  );
}
