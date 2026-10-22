import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/securityHeaders';
const nextConfig:NextConfig={
 turbopack:{root:process.cwd()},
 async headers(){return [{source:'/:path*',headers:securityHeaders(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NODE_ENV==='development')}];}
};
export default nextConfig;
