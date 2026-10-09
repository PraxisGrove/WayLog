import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";

import { type CurrentAuthUser, getCurrentAuthUser } from "@/features/auth";

export function useCurrentAuthUser(): [CurrentAuthUser | null, boolean] {
  const [authUser, setAuthUser] = useState<CurrentAuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      (async () => {
        try {
          const user = await getCurrentAuthUser();
          if (isActive) {
            setAuthUser(user);
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      })();

      return () => {
        isActive = false;
      };
    }, []),
  );

  return [authUser, isLoading];
}
