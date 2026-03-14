import { NextResponse, type NextRequest } from "next/server";

import { HAS_SUPABASE_ENV, IS_LOCAL_DB_MODE } from "@/lib/mode";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  if (IS_LOCAL_DB_MODE || !HAS_SUPABASE_ENV) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
