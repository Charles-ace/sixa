import { clearSessionCookie } from '@/lib/auth/session';
import { clearWalletCookie } from '@/lib/auth/wallet';

export async function POST() {
  const response = await clearSessionCookie();
  const walletResponse = clearWalletCookie();
  for (const cookie of walletResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}