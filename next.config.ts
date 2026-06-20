import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Payload runs its admin + REST/GraphQL inside the (payload) route group.
  // Keep the frontend lean; per-area config lives in the relevant layer.
};

export default withPayload(nextConfig);
