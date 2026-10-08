import { auth } from './app/lib/auth';

export default auth((req) => {
  // The auth function wraps your middleware and provides the session
  // You can add custom logic here if needed
  return;
});

export const config = {
  matcher: ['/board', '/board/:path*'],
};
