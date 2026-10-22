const publicRoutes = new Set(['/login', '/impressum', '/datenschutz', '/agb', '/widerruf']);
export function isPublicRoute(pathname: string): boolean { return publicRoutes.has(pathname); }
