import { Router, Request, Response } from "express";
import requireAuth from "../middleware/requireAuth";
import requireRole from "../middleware/requireRole";
import { User } from "../models/userModel";
import { analyzeSky } from "../controllers/analysis.controller";
import { handleChat } from "../controllers/chat.controller";
import { getNightSkyData } from "../controllers/nightSky.controller";
import { getNasaFeed, explainNasaImage } from "../controllers/nasaFeed.controller";
import { getBookmarks, addBookmark, removeBookmark } from "../controllers/user.controller";

const router = Router();

// Apply requireAuth middleware to all page-related routes
router.use(requireAuth);

// User routes
router.get("/user/me", (req: Request, res: Response) => {
  const authReq = req as any;
  const authUser = authReq.user;

  return res.json({
    user: authUser,
  });
});

// Admin routes
router.get(
  "/admin/users",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const users = await User.find(
        {},
        {
          email: 1,
          role: 1,
          isEmailVerified: 1,
          createdAt: 1,
        },
      ).sort({ createdAt: -1 });

      const result = users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isEmailVerified: u.isEmailVerified,
        createdAt: u.createdAt,
      }));

      return res.json({ users: result });
    } catch (err) {
      return res.status(404).json({ message: "Internal Server Error" });
    }
  },
);

// Analysis routes
router.post("/analysis/sky", analyzeSky);

// Chat routes
router.post("/chat", handleChat);

// Night Sky routes
router.get("/night-sky", getNightSkyData);

// NASA Feed routes
router.get("/nasa-feed", getNasaFeed);
router.post("/nasa-feed/explain", explainNasaImage);

// User Bookmark routes
router.get("/user/bookmarks", getBookmarks);
router.post("/user/bookmarks", addBookmark);
router.delete("/user/bookmarks/:date", removeBookmark);

export default router;