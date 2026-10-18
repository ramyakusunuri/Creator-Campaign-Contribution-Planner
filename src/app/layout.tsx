import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CreatorIQ | Campaign Planner", description: "Compare creator campaign plans and maximize estimated contribution within budget." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
