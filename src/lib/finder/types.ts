export type Platform = "youtube" | "instagram";

// The only data the finder keeps about a creator: username, follower count, niche (+ platform and profile link).
export type FoundCreator = {
  platform: Platform;
  username: string;
  followers: number | null; // null = creator hides their count
  niche: string;
  profileUrl: string;
  fetchedAt: string; // ISO date, used to expire stored data
};

export class FinderError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
