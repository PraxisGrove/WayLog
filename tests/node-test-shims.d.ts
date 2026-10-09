declare module "node:test" {
  type TestContext = {
    after: (fn: () => void | Promise<void>) => void;
    mock: {
      timers: {
        enable: (options: { apis: ["setTimeout"] }) => void;
        tick: (milliseconds: number) => void;
      };
    };
  };
  type TestFn = (context: TestContext) => void | Promise<void>;
  type TestRunner = {
    (name: string, fn: TestFn): void;
    skip: (name: string, fn: TestFn) => void;
  };
  const test: TestRunner;
  export const describe: (name: string, fn: () => void | Promise<void>) => void;
  export const it: (name: string, fn: TestFn) => void;
  export default test;
}

declare module "node:assert/strict" {
  const assert: {
    equal: (actual: unknown, expected: unknown, message?: string) => void;
    deepEqual: (actual: unknown, expected: unknown, message?: string) => void;
    match: (actual: string, expected: RegExp, message?: string) => void;
    ok: (value: unknown, message?: string) => void;
    rejects: (
      fn: () => Promise<unknown>,
      error?: RegExp | ((error: unknown) => boolean),
    ) => Promise<void>;
    throws: (
      fn: () => unknown,
      error?: RegExp | ((error: unknown) => boolean),
    ) => void;
  };
  export default assert;
}

declare module "node:assert" {
  const assert: {
    strictEqual: (actual: unknown, expected: unknown, message?: string) => void;
  };
  export default assert;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
}

declare const process: {
  cwd?: () => string;
  env: Record<string, string | undefined>;
};
