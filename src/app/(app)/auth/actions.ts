"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Sign out (T-201). Deleting the auth cookie inside a Server Action makes
 * Next.js re-render the tree on the server and bust the client router cache, so
 * the UI actually reflects the signed-out state — unlike a `<Link>` to a GET
 * route, which soft-navigates and serves the cached authenticated page.
 *
 * The cookie is Payload's stateless JWT (`payload-token`; the default
 * `cookiePrefix` is "payload" and the config doesn't override it). It's
 * host-only at path "/", so deleting by name + path clears it.
 */
export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: "payload-token", path: "/" });
  redirect("/");
}
