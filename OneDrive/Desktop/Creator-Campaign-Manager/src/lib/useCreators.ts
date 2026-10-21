"use client";
import { useEffect, useState } from "react";
import { initialCreators, type Creator } from "./creators";
import { fetchCreators } from "./creators-db";

// Starts with the bundled list (instant render), then swaps in the database version.
export function useCreators(): Creator[] {
  const [list, setList] = useState<Creator[]>(initialCreators);
  useEffect(() => {
    let live = true;
    fetchCreators().then(l => { if (live) setList(l); });
    return () => { live = false; };
  }, []);
  return list;
}
