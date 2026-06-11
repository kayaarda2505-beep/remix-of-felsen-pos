// Stub für serverseitige TanStack-Start-Module im Electron/SPA-Build.
// Wird via Vite-Alias eingebunden — die hier exportierten Symbole werden
// im Browser nie ausgeführt, da Server-Funktionen über die gehostete URL
// via fetch-Interceptor (siehe electron-entry.tsx) aufgerufen werden.
/* eslint-disable @typescript-eslint/no-explicit-any */
const identity = (...args: any[]) => args;

export const getRequest = () => {
  throw new Error("getRequest() ist im Electron/SPA-Build nicht verfügbar");
};
export const getRequestHeader = () => undefined;
export const getRequestHeaders = () => ({});
export const setResponseHeader = () => {};
export const setResponseHeaders = () => {};
export const setResponseStatus = () => {};
export const getCookie = () => undefined;
export const getCookies = () => ({});
export const setCookie = () => {};
export const deleteCookie = () => {};

// requireSupabaseAuth / createMiddleware-Stubs — Builder-Pattern simulieren
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

// Catch-all fallback
export default identity;
