export const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
export const shortMoney=(n:number)=>Math.abs(n)>=100000?`₹${(n/100000).toFixed(2)}L`:Math.abs(n)>=1000?`₹${(n/1000).toFixed(1)}K`:money(n);
export const compact=(n:number)=>n>=1000?`${(n/1000).toFixed(n%1000===0?0:1)}K`:String(n);
