import type { CollectionConfig } from "payload"
import { createFolderField, createTagField } from "payload"

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    create: ({ req }) => req.user?.collection === "accounts",
    read: () => true,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
    },
    createFolderField({ relationTo: "folders" }),
    createTagField({ relationTo: "tags" }),
  ],
  upload: true,
}
