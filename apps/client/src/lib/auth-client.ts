import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";
import { env } from "./env";

export const { signIn, signOut, signUp, useSession } = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_BASE_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
});
