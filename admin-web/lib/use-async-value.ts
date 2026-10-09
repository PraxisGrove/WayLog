"use client";

import { useCallback, useEffect, useState } from "react";

export function useAsyncValue<TValue>(loader: () => Promise<TValue>) {
  const [value, setValue] = useState<TValue>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => {
    setRevision((currentRevision) => currentRevision + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    const activeRevision = revision;

    setLoading(true);
    loader()
      .then((nextValue) => {
        if (mounted && activeRevision === revision) {
          setValue(nextValue);
          setError(undefined);
        }
      })
      .catch((nextError: unknown) => {
        if (mounted && activeRevision === revision) {
          setError(
            nextError instanceof Error ? nextError : new Error("加载失败"),
          );
        }
      })
      .finally(() => {
        if (mounted && activeRevision === revision) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loader, revision]);

  return { error, loading, reload, value };
}
