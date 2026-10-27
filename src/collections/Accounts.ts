import type {
  Access,
  CollectionBeforeChangeHook,
  CollectionConfig,
  FieldAccess,
} from "payload"

const isAccountAdmin: Access = ({ req }) =>
  req.user?.collection === "accounts" && req.user.role === "Admin"
const isAccountAdminField: FieldAccess = ({ req }) =>
  req.user?.collection === "accounts" && req.user.role === "Admin"

const canReadAccount: Access = ({ req }) => {
  if (req.user?.collection !== "accounts") return false
  if (req.user.role === "Admin") return true
  return { id: { equals: req.user.id } }
}

const canUpdateAccount: Access = canReadAccount

const normalizeAccount: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (data.nik) {
    data.nik = String(data.nik).trim()
    data.username = data.nik
  }

  if (
    operation === "create" &&
    (!data.account_id || data.account_id === "AUTO")
  ) {
    const latest = await req.payload.find({
      collection: "accounts",
      limit: 1,
      sort: "-account_id",
      select: { account_id: true },
      overrideAccess: true,
    })
    const last = latest.docs[0]?.account_id ?? "acc0000"
    const number = Number(String(last).replace(/\D/g, "")) || 0
    data.account_id = `acc${String(number + 1).padStart(4, "0")}`
  }

  if (
    operation === "update" &&
    originalDoc?.role === "Admin" &&
    (data.role === "Member" || data.is_active === false)
  ) {
    const activeAdmins = await req.payload.count({
      collection: "accounts",
      where: {
        and: [
          { role: { equals: "Admin" } },
          { is_active: { equals: true } },
          { id: { not_equals: originalDoc.id } },
        ],
      },
      overrideAccess: true,
    })
    if (activeAdmins.totalDocs === 0) {
      throw new Error(
        "The last active Admin account cannot be deactivated or demoted.",
      )
    }
  }

  return data
}

export const Accounts: CollectionConfig = {
  slug: "accounts",
  admin: {
    hidden: true,
    useAsTitle: "name",
  },
  auth: {
    loginWithUsername: {
      allowEmailLogin: false,
      requireEmail: false,
      requireUsername: true,
    },
    maxLoginAttempts: 5,
    tokenExpiration: 60 * 60 * 8,
    useSessions: false,
  },
  access: {
    admin: () => false,
    create: isAccountAdmin,
    delete: () => false,
    read: canReadAccount,
    update: canUpdateAccount,
  },
  hooks: {
    beforeChange: [normalizeAccount],
  },
  fields: [
    {
      name: "account_id",
      type: "text",
      required: true,
      unique: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: "name",
      type: "text",
      required: true,
      index: true,
    },
    {
      name: "nik",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "profile_photo",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "Member",
      options: ["Admin", "Member"],
      access: {
        create: isAccountAdminField,
        update: isAccountAdminField,
      },
    },
    {
      name: "position",
      type: "text",
      required: true,
    },
    {
      name: "department",
      type: "text",
      required: true,
    },
    {
      name: "business_unit",
      type: "text",
      required: true,
    },
    {
      name: "is_active",
      type: "checkbox",
      required: true,
      defaultValue: true,
      access: {
        create: isAccountAdminField,
        update: isAccountAdminField,
      },
    },
  ],
}
