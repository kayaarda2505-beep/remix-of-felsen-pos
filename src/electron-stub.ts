const proxy: any = new Proxy(function(){}, { get: () => proxy, apply: () => proxy, construct: () => proxy });
export default proxy;
export const createServerFn = () => proxy;
export const createMiddleware = () => proxy;
export const supabaseAdmin = proxy;
export const requireSupabaseAuth = proxy;
export const attachSupabaseAuth = proxy;
