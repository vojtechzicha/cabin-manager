import type { CollectionConfig } from "payload";

/**
 * Media — uploaded images (trip cover photos today; avatars later). Bytes are
 * stored in MongoDB via GridFS (see `src/storage/gridfs.ts`), wired in
 * `payload.config.ts` through the cloud-storage plugin, so `disableLocalStorage`
 * is on — nothing touches the local filesystem.
 *
 * Read is public: cover images are non-secret assets served by Payload's
 * `/api/media/file/<name>` route to anyone rendering a trip. Creating/replacing
 * media requires a signed-in user (organizers uploading branding).
 */
export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    disableLocalStorage: true,
    mimeTypes: ["image/*"],
    imageSizes: [
      { name: "thumbnail", width: 240, height: 240, position: "centre" },
      { name: "card", width: 768, height: 512, position: "centre" },
    ],
  },
  fields: [{ name: "alt", type: "text", admin: { description: "Accessibility description." } }],
};
