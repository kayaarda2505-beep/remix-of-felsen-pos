export const createServerFn = () => { const chain: any = { middleware: () => chain, inputValidator: () => chain, validator: () => chain, handler: (fn: any) => fn }; return chain; };
export default {};
export const createMiddleware = () => ({ server: () => ({ client: () => ({}) }) });
