import type { Access, CollectionConfig } from "payload";

/**
 * Media — uploaded images (trip cover photos today; avatars later). Bytes are
 * stored in MongoDB via GridFS (see `src/storage/gridfs.ts`), wired in
 * `payload.config.ts` through the cloud-storage plugin, so `disableLocalStorage`
 * is on — nothing touches the local filesystem.
 *
 * Read is public: cover images are non-secret assets served by Payload's
 * `/api/media/file/<name>` route to anyone rendering a trip. **Replacing or
 * deleting media is restricted to the uploader (its `owner`) or an admin** — a
 * signed-in user must not be able to clobber someone else's asset.
 */
const ownerId = (req: Parameters<Access>[0]["req"]): string | null => {
  const user = req.user as { id?: string | number } | null;
  return user?.id != null ? String(user.id) : null;
};

const isOwnerOrAdmin: Access = ({ req }) => {
  const user = req.user as { id?: string | number; role?: string } | null;
  if (!user) return false;
  if (user.role === "admin") return true;
  // Scope writes/deletes to media this user owns.
  return { owner: { equals: String(user.id) } };
};

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  hooks: {
    beforeChange: [
      // Stamp the uploader as owner on create; never let it be reassigned.
      ({ req, data, operation, originalDoc }) => {
        if (operation === "create") data.owner = ownerId(req) ?? data.owner;
        else if (originalDoc?.owner) data.owner = originalDoc.owner;
        return data;
      },
    ],
  },
  upload: {
    disableLocalStorage: true,
    mimeTypes: ["image/*"],
    imageSizes: [
      { name: "thumbnail", width: 240, height: 240, position: "centre" },
      { name: "card", width: 768, height: 512, position: "centre" },
    ],
  },
  fields: [
    { name: "alt", type: "text", admin: { description: "Accessibility description." } },
    {
      name: "owner",
      type: "relationship",
      relationTo: "identities",
      access: { update: () => false },
      admin: { readOnly: true, description: "The Identity that uploaded this asset." },
    },
  ],
};
