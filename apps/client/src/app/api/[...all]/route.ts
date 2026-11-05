import { getAuth } from "@/lib/auth";
import { withDatabaseScope } from "@/lib/db";

const handler = withDatabaseScope(async (request: Request) => {
  const auth = await getAuth();
  return auth.handler(request);
});

export { handler as GET, handler as POST };
