import { useLocalSearchParams } from "expo-router";

import { AgentConversationScreen } from "@/domains/agent/screens/conversation/agent-conversation-screen";

type AgentRouteParams = {
  conversationId?: string | string[];
  tripId?: string | string[];
  tripTitle?: string | string[];
};

function normalizeRouteParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function AgentRoute() {
  const params = useLocalSearchParams<AgentRouteParams>();
  const tripId = normalizeRouteParam(params.tripId);

  return (
    <AgentConversationScreen
      conversationId={normalizeRouteParam(params.conversationId)}
      showBackButton
      tripId={tripId}
      tripTitle={normalizeRouteParam(params.tripTitle)}
    />
  );
}
