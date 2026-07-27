import type { NextApiRequest, NextApiResponse } from "next";
import { deleteAllAudits } from "../../../lib/store/audit-store";

type ResponseData = {
  message: string;
  success: boolean;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  console.log("Attempting to hit /api/audits/clear-all endpoint.");
  if (req.method === "GET") {
    // Add headers to prevent caching of this response
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const success = deleteAllAudits();
    if (success) {
      return res.status(200).json({
        message: "All audit history has been cleared.",
        success: true,
      });
    }
    return res
      .status(500)
      .json({ message: "Failed to clear audit history.", success: false });
  }
  res.setHeader("Allow", ["GET"]);
  res
    .status(405)
    .json({ message: `Method ${req.method} Not Allowed`, success: false });
}
