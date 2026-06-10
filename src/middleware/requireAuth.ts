import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/token";
import { User } from "../models/userModel";
import jwt from "jsonwebtoken";

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "You are not logged in" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "User is unauthenticated" });
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ message: "Token invalidated" });
    }

    const authReq = req as any;

    authReq.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };

    next();

  } catch (err) {
    console.log(err);
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        message: "Access token expired",
        code: "TOKEN_EXPIRED"
      });
    }

    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        message: "Invalid token",
        code: "INVALID_TOKEN"
      });
    }

    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
}

export default requireAuth;