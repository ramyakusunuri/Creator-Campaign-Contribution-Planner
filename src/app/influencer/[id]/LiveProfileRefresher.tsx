"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LiveProfileRefresher({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [knownCount, setKnownCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    const checkUpdates = async () => {
      try {
        const res = await fetch('/api/orders/live', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (active && data && data.counts) {
            const count = data.counts[creatorId] || 0;
            if (knownCount !== null && count !== knownCount) {
              // New live order arrived for this creator!
              router.refresh();
            }
            setKnownCount(count);
          }
        }
      } catch {}
    };

    checkUpdates();
    const interval = setInterval(checkUpdates, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [creatorId, knownCount, router]);

  return null;
}
