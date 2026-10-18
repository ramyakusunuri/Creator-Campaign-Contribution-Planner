"use client";
import { useEffect, useState } from "react";

export default function CouponEditor({creatorId,initial}:{creatorId:string;initial:string}){
 const key=`coupon:${creatorId}`;
 const [code,setCode]=useState(initial);
 useEffect(()=>{try{const v=localStorage.getItem(key);if(v)setCode(v);}catch{}},[key]);
 const change=(v:string)=>{const next=v.toUpperCase().replace(/\s/g,"");setCode(next);try{localStorage.setItem(key,next);}catch{}};
 return <input value={code} onChange={e=>change(e.target.value)} maxLength={20} aria-label="Coupon code" className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xl font-bold tracking-wider text-indigo-700 outline-none focus:border-indigo-500"/>;
}
