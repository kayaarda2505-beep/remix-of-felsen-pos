// Stub für serverseitige TanStack-Start-Module im Electron/SPA-Build.
// Wird via Vite-Alias eingebunden — die hier exportierten Symbole werden
// im Browser nie ausgeführt, da Server-Funktionen über die gehostete URL
// via fetch-Interceptor (siehe electron-entry.tsx) aufgerufen werden.
/* eslint-disable @typescript-eslint/no-explicit-any */
const identity = (...args: any[]) => args;
const noop = () => undefined;
const empty = () => ({});

// @tanstack/react-start/server exports
export const getRequest = () => {
  throw new Error("getRequest() ist im Electron/SPA-Build nicht verfügbar");
};
export const getRequestHeader = () => undefined;
export const getRequestHeaders = empty;
export const getRequestIP = () => undefined;
export const getRequestHost = () => "";
export const getRequestUrl = () => "";
export const setResponseHeader = noop;
export const setResponseHeaders = noop;
export const setResponseStatus = noop;
export const getCookie = () => undefined;
export const getCookies = empty;
export const setCookie = noop;
export const deleteCookie = noop;
export const useSession = async () => ({
  data: {},
  update: async () => {},
  clear: async () => {},
});
export const getSession = useSession;
export const updateSession = async () => {};
export const clearSession = async () => {};
export const getValidatedQuery = (fn: (q: any) => any) => fn({});

// start-storage-context exports
export const getStartContext = () => ({});
export const runWithStartContext = async (_ctx: any, fn: () => any) => fn();

// node:async_hooks fallback
export class AsyncLocalStorage<T = unknown> {
  private store: T | undefined;
  getStore(): T | undefined {
    return this.store;
  }
  run<R>(_store: T, fn: () => R): R {
    const prev = this.store;
    this.store = _store;
    try {
      return fn();
    } finally {
      this.store = prev;
    }
  }
  enterWith(store: T) {
    this.store = store;
  }
  disable() {
    this.store = undefined;
  }
  exit<R>(fn: () => R): R {
    return fn();
  }
}

// createMiddleware-Stub: Builder-Pattern simulieren
function makeMiddlewareBuilder(): any {
  const builder: any = {
    middleware: () => builder,
    inputValidator: () => builder,
    client: () => builder,
    server: () => builder,
  };
  return builder;
}

export const createMiddleware = () => makeMiddlewareBuilder();
export const requireSupabaseAuth = makeMiddlewareBuilder();
export const attachSupabaseAuth = makeMiddlewareBuilder();

// supabaseAdmin Proxy — wirft sofort, falls jemand ihn doch verwendet
export const supabaseAdmin = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "supabaseAdmin ist im Electron/SPA-Build nicht verfügbar",
      );
    },
  },
);

export default identity;
