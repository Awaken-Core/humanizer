import { auth } from "@/lib/auth"; // path to your auth file

const handler = auth.handler;
export { handler as GET, handler as POST };