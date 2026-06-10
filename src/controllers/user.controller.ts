import { Request, Response } from "express";
import { User } from "../models/userModel";

// GET /user/bookmarks - Fetch all bookmarks for the logged-in user
export const getBookmarks = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId).select("bookmarks");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ bookmarks: user.bookmarks || [] });
  } catch (err) {
    console.error("getBookmarks error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// POST /user/bookmarks - Add an APOD item to bookmarks
export const addBookmark = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { date, title, url, credit, explanation, nasaDescription, tags } = req.body;

    if (!date || !url) {
      return res.status(400).json({ message: "date and url are required" });
    }

    // Prevent duplicate bookmarks
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.bookmarks) {
      user.bookmarks = [] as any;
    }

    const alreadyExists = user.bookmarks.some((b: any) => b.date === date);
    if (alreadyExists) {
      return res.json({ bookmarks: user.bookmarks });
    }

    user.bookmarks.push({ date, title, url, credit, explanation, nasaDescription, tags: tags || [] });
    await user.save();

    return res.json({ bookmarks: user.bookmarks });
  } catch (err) {
    console.error("addBookmark error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// DELETE /user/bookmarks/:date - Remove a bookmark by APOD date
export const removeBookmark = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { date } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.bookmarks) {
      user.bookmarks = [] as any;
    }

    user.bookmarks = user.bookmarks.filter((b: any) => b.date !== date) as any;
    await user.save();

    return res.json({ bookmarks: user.bookmarks });
  } catch (err) {
    console.error("removeBookmark error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
