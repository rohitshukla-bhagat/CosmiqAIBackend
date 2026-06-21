import { Request, Response } from "express";
import { loginSchema, registerSchema } from "./authSchema";
import { User } from "../../models/userModel";
import { checkPassword, hashPassword } from "../../lib/hash";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../lib/email";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} from "../../lib/token";
import crypto from "crypto";
import { auth, OAuth2Client } from "google-auth-library";
import { authenticator } from "otplib";

function getAppUrl() {
  return process.env.APP_URL || `http://localhost:${process.env.PORT}`;
}

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

function getGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Google Client ID and Secret both are missing");
  }

  return new OAuth2Client({
    clientId,
    clientSecret,
    redirectUri,
  });
}

//? User register handler function
export async function registerHandler(req: Request, res: Response) {
  try {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid Data",
        errors: result.error.flatten(),
      });
    }
    const { name, email, password } = result.data;
    const normalizeEmail = email.toLowerCase().trim();

    //? check that the inputted email is already exist in DB or not
    const existingUser = await User.findOne({ email: normalizeEmail });
    if (existingUser) {
      return res.status(409).json({
        message:
          "This email is already in use please try with a different email.",
      });
    }

    //? Hashing he password
    const passwordHash = await hashPassword(password);

    //? Creating user document
    const newlyCreatedUser = await User.create({
      email: normalizeEmail,
      passwordHash,
      role: "user",
      isEmailVerified: false,
      twoFactorEnabled: false,
      name,
    });

    //? Email Verification
    const verifyToken = jwt.sign(
      {
        sub: newlyCreatedUser.id,
      },
      process.env.JWT_ACCESS_SECRET!,
      {
        expiresIn: "1d",
      },
    );

    const verifyURL = `${getAppUrl()}/auth/verify-email?token=${verifyToken}`;

    await sendEmail(
      newlyCreatedUser.email as string,
      "Verify Your Email",
      `<p>Veify Your Email by clicking link below !</p>
          <p><a href="${verifyURL}">${verifyURL}</a></p>
        `,
    );

    return res.status(201).json({
      message: "User registered successfully",
      id: newlyCreatedUser.id,
      email: newlyCreatedUser.email,
      role: newlyCreatedUser.role,
      isEmailVerified: newlyCreatedUser.isEmailVerified,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal Server Error!",
    });
  }
}

//? Function for the verify the email
export async function verifyEmailHandler(req: Request, res: Response) {
  const token = req.query.token as string;

  if (!token) {
    return res.redirect(`${CLIENT_URL}/?verified=false&message=Verification%20token%20is%20missing`);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as {
      sub: string;
    };

    const user = await User.findById(payload.sub);

    if (!user) {
      return res.redirect(`${CLIENT_URL}/?verified=false&message=User%20not%20found`);
    }

    if (user.isEmailVerified) {
      return res.redirect(`${CLIENT_URL}/?verified=already`);
    }

    user.isEmailVerified = true;
    await user.save();
    return res.redirect(`${CLIENT_URL}/?verified=true`);
  } catch (err) {
    console.log(err);
    return res.redirect(`${CLIENT_URL}/?verified=false&message=Invalid%20or%20expired%20verification%20token`);
  }
}

//? User Login handler function
export async function loginHandler(req: Request, res: Response) {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid Data",
        errors: result.error.flatten(),
      });
    }

    const { email, password, twoFactorCode } = result.data;
    const normalizeEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizeEmail });

    if (!user) {
      return res.status(400).json({ message: "Invalid Email or Password" });
    }
    if (!user.passwordHash) {
      return res.status(400).json({ message: "Invalid Email or Password" });
    }

    const ok = await checkPassword(password, user.passwordHash);

    if (!ok) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email first before logging in...",
      });
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode || typeof twoFactorCode !== "string") {
        return res
          .status(400)
          .json({ message: "Two factor code is required!" });
      }

      if (!user.twoFactorSecret) {
        return res
          .status(400)
          .json({ message: "Two factor misconfigured for this account" });
      }

      // verify the code using otplib
      const isValidCode = authenticator.check(
        twoFactorCode,
        user.twoFactorSecret,
      );
      if (!isValidCode) {
        return res.status(400).json({ message: "Invalid Two factor code" });
      }
    }

    const accessToken = createAccessToken(
      user.id,
      user.role,
      user.tokenVersion,
    );

    const refreshToken = createRefreshToken(user.id, user.tokenVersion);

    const isProd = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successfully done",
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal server error!",
    });
  }
}

//? Token refreshing handler function
export async function refreshHandler(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken as string | undefined;
    if (!token) {
      return res.status(401).json({ message: "Refresh Token Missing" });
    }

    const payload = verifyRefreshToken(token);

    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ message: "Refresh Token Invalidated" });
    }

    const newAccessToken = createAccessToken(
      user.id,
      user.role,
      user.tokenVersion,
    );

    const newRefreshToken = createRefreshToken(user.id, user.tokenVersion);
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Token Refreshed",
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal server error!",
    });
  }
}

//? Log Out Handler Function
export async function logoutHandler(req: Request, res: Response) {
  try {
    res.clearCookie("refreshToken", { path: "/" });
    return res.status(200).json({ message: "Logged Out" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal server error!",
    });
  }
}

//? Forget Password Handler function
export async function forgetPasswordHandler(req: Request, res: Response) {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  const normalizeEmail = email.toLowerCase().trim();
  try {
    const user = await User.findOne({ email: normalizeEmail });
    if (!user) {
      return res.status(401).json({
        message:
          "If an an account with this email exists, we will send you a reset link.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    const resetUrl = `${getAppUrl()}/auth/reset-password?token=${rawToken}`;

    if (!user.email) {
      return res.status(401).json({ message: "User email not found" });
    }

    await sendEmail(
      user.email,
      "Reset Your Password",
      `
      <p>Please click on below link for resetting your password!</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      `,
    );

    return res.status(200).json({
      message:
        "If an an account with this email exists, we will send you a reset link.",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal server error!",
    });
  }
}

//? Reset Password Handler Function
export async function resetPasswordHandler(req: Request, res: Response) {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token) {
    return res.status(400).json({ message: "Reset token is not present" });
  }

  if (!password || password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be atleast 6 character long" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Message not found" });
    }

    const newHashPassword = await hashPassword(password);
    user.passwordHash = newHashPassword;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    user.tokenVersion += 1;

    await user.save();

    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal server error!",
    });
  }
}

//? Google auth start handler
export async function googleAuthStartHandler(req: Request, res: Response) {
  try {
    const client = getGoogleClient();

    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["openid", "email", "profile"],
    });

    return res.redirect(url);
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: "Internal server error!",
    });
  }
}

//? Google auth callback handler function
export async function googleAuthCallbackHandler(req: Request, res: Response) {
  const code = req.query.code as string | undefined;

  if (!code) {
    return res.status(400).json({
      message: "Google auh code is missing",
    });
  }

  try {
    const client = getGoogleClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      return res
        .status(400)
        .json({ message: "Google auth id_token is missing" });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID as string,
    });

    const payload = ticket.getPayload();

    const email = payload?.email;
    const isEmailVerified = payload?.email_verified;

    if (!email || !isEmailVerified) {
      return res.status(400).json({ message: "Google auth email problem" });
    }

    const normalizeEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: normalizeEmail });
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const passwordHash = await hashPassword(randomPassword);

      user = await User.create({
        email: normalizeEmail,
        passwordHash,
        role: "user",
        isEmailVerified: true,
        twoFactorEnabled: false,
      });
    } else {
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        await user.save();
      }
    }

    const accessToken = createAccessToken(
      user.id,
      user.role as "user" | "admin",
      user.tokenVersion,
    );
    const refreshToken = createRefreshToken(user.id, user.tokenVersion);

    const isProd = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userPayload = JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    });
    return res.redirect(`${CLIENT_URL}/?token=${accessToken}&user=${encodeURIComponent(userPayload)}`);
  } catch (err) {
    console.log(err);
    return res.redirect(`${CLIENT_URL}/?verified=false&message=Google%20authentication%20failed`);
  }
}
