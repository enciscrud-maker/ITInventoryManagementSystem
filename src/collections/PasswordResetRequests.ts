import type { Access, CollectionConfig, FieldAccess } from "payload"

const isAccountAdmin: Access = ({ req }) =>
  req.user?.collection === "accounts" && req.user.role === "Admin"

const verifiedRequestCreate: Access = ({ req }) =>
  req.context.passwordResetVerified === true

const canReadRequest: Access = ({ req }) =>
  (req.user?.collection === "accounts" && req.user.role === "Admin") ||
  req.context.passwordResetVerified === true

const serverManagedCreate: FieldAccess = ({ req }) =>
  req.context.passwordResetVerified === true

const adminFieldAccess: FieldAccess = ({ req }) =>
  req.user?.collection === "accounts" && req.user.role === "Admin"

export const PasswordResetRequests: CollectionConfig = {
  slug: "password-reset-requests",
  admin: {
    hidden: true,
    useAsTitle: "request_id",
  },
  access: {
    admin: () => false,
    create: verifiedRequestCreate,
    delete: () => false,
    read: canReadRequest,
    update: isAccountAdmin,
  },
  fields: [
    {
      name: "request_id",
      type: "text",
      required: true,
      unique: true,
      index: true,
      access: { create: serverManagedCreate, update: () => false },
    },
    {
      name: "account",
      type: "relationship",
      relationTo: "accounts",
      required: true,
      access: { create: serverManagedCreate, update: () => false },
    },
    {
      name: "member_name",
      type: "text",
      required: true,
      access: { create: serverManagedCreate, update: () => false },
    },
    {
      name: "nik",
      type: "text",
      required: true,
      access: { create: serverManagedCreate, update: () => false },
    },
    {
      name: "email",
      type: "email",
      required: true,
      access: { create: serverManagedCreate, update: () => false },
    },
    {
      name: "phone",
      type: "text",
      required: true,
      access: { create: serverManagedCreate, update: () => false },
    },
    {
      name: "request_date",
      type: "date",
      required: true,
      access: { create: serverManagedCreate, update: () => false },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "Pending",
      options: ["Pending", "Processed", "Rejected"],
      access: { create: serverManagedCreate, update: adminFieldAccess },
    },
    {
      name: "processed_by",
      type: "relationship",
      relationTo: "accounts",
      access: { create: () => false, update: adminFieldAccess },
    },
    {
      name: "processed_at",
      type: "date",
      access: { create: () => false, update: adminFieldAccess },
    },
    {
      name: "rejection_reason",
      type: "textarea",
      access: { create: () => false, update: adminFieldAccess },
    },
  ],
}
