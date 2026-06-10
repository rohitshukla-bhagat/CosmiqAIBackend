import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      require: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      require: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default : "user",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    name: {
      type: String,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      default: undefined,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    resetPasswordToken: {
      type: String,
      default: undefined,
    },
    resetPasswordExpires: {
      type: Date,
      default: undefined,
    },
    bookmarks: {
      type: [
        {
          date: { type: String, required: true },
          title: { type: String, default: '' },
          url: { type: String, default: '' },
          credit: { type: String, default: '' },
          explanation: { type: String, default: '' },
          nasaDescription: { type: String, default: '' },
          tags: { type: [String], default: [] },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const User = model("User", userSchema);