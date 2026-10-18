import type { Creator } from "./creators";

export type Order = { customer:string; item:string; price:number; status:"Delivered"|"Shipped"|"Returned" };
export type Product = { item:string; price:number; cost:number; influencerCost:number };

const FIRST=["Ram","Sita","Amit","Neha","Raj","Pooja","Karan","Anil","Riya","Sahil"];
// Sample catalogue: price multiplier relative to the creator's discounted average selling price.
const CATALOGUE:[string,number][]=[["Shirt",1],["Hoodie",1.3],["Sneakers",1.5],["Backpack",1.1],["Watch",1.6],["Earbuds",0.9],["Jacket",1.7],["Cap",0.5]];
export const ORDERS_SHOWN=10;

function rng(seed:number){return()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

// Influencer cost per product = total amount paid to the influencer / number of orders placed with their code.
export function productsFor(c:Creator):Product[]{
 const base=c.sp*(1-c.discount/100);const cpRate=c.cp/base;const influencerCost=Math.round(c.fee/c.orders);
 return CATALOGUE.map(([item,m])=>{const price=Math.round(base*m/10)*10;return{item,price,cost:Math.round(price*cpRate),influencerCost};});
}

// SAMPLE orders placed with this creator's coupon (deterministic per creator). Replace with real order data.
export function ordersFor(c:Creator):Order[]{
 const rand=rng(c.id*7919);const products=productsFor(c);
 return Array.from({length:ORDERS_SHOWN},(_,n)=>{
  const p=products[Math.floor(rand()*products.length)];const r=rand();
  return{customer:`${FIRST[Math.floor(rand()*FIRST.length)]}${10+Math.floor(rand()*90)}`,item:p.item,price:p.price,status:n===3?"Returned":r<0.3?"Shipped":"Delivered"};
 });
}

export function statsFor(c:Creator,orders:Order[]){
 const products=productsFor(c);const byItem=new Map(products.map(p=>[p.item,p]));
 const total=orders.length;const returned=orders.filter(o=>o.status==="Returned").length;
 const totalSale=orders.reduce((s,o)=>s+o.price,0);
 // Net profit: kept orders only, after product cost and the influencer cost per product.
 const netProfit=orders.filter(o=>o.status!=="Returned").reduce((s,o)=>{const p=byItem.get(o.item)!;return s+o.price-p.cost-p.influencerCost;},0);
 const counts=new Map<string,number>();orders.forEach(o=>counts.set(o.customer,(counts.get(o.customer)??0)+1));
 const reorder=Array.from(counts.values()).filter(n=>n>1).length;
 return{total,returned,totalSale,netProfit,returnRate:total?(returned/total)*100:0,aov:total?totalSale/total:0,reorder};
}
