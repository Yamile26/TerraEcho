/** The archive demo can run without a Node server; recent NASA queries need one. */
export const ARCHIVE_ONLY = process.env.NEXT_PUBLIC_ARCHIVE_ONLY === "true";
