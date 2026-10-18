import seed from "../data/creator_personas_seed.json";

export type Persona = (typeof seed)[number];
export type Creator = { id:number; slug:string; name:string; category:string; orders:number; discount:number; sp:number; cp:number; fee:number };

// Identity (slug/name/niche) comes from creator_personas_seed.json; commercial figures are the planner's sample data.
const financials = [
 {orders:1800,discount:10,sp:1800,cp:700,fee:400000},
 {orders:1300,discount:15,sp:1500,cp:600,fee:250000},
 {orders:2400,discount:8,sp:2200,cp:900,fee:600000},
 {orders:900,discount:20,sp:1200,cp:500,fee:150000},
 {orders:1600,discount:10,sp:1600,cp:650,fee:300000},
 {orders:700,discount:5,sp:2000,cp:800,fee:100000},
 {orders:2000,discount:12,sp:2100,cp:850,fee:500000},
 {orders:1100,discount:10,sp:1400,cp:550,fee:200000},
];
export const initialCreators:Creator[] = financials.map((f,i)=>({id:i+1,slug:seed[i].id,name:seed[i].name,category:seed[i].niche,...f}));
export const categories = Array.from(new Set(initialCreators.map(c=>c.category)));
export const getCreator=(slug:string)=>initialCreators.find(c=>c.slug===slug);
export const getPersona=(slug:string)=>seed.find(p=>p.id===slug);
export function profit(c:Creator){return c.orders*(c.sp*(1-c.discount/100)-c.cp)-c.fee;}
// Coupon code is derived (not in the JSON): FIRSTNAME + discount %.
export const couponFor=(c:Creator)=>`${c.name.split(" ")[0].toUpperCase()}${c.discount}`;

export const DEFAULT_BUDGET=2_500_000;
export const BUDGET_KEY="campaign-budget";
export function optimize(creators:Creator[],budget:number){let bestMask=0,bestProfit=0,bestSpend=0;for(let mask=1;mask<(1<<creators.length);mask++){let spend=0,total=0;for(let i=0;i<creators.length;i++)if(mask&(1<<i)){spend+=creators[i].fee;total+=profit(creators[i]);}if(spend<=budget&&total>bestProfit){bestMask=mask;bestProfit=total;bestSpend=spend;}}return{creators:creators.filter((_,i)=>bestMask&(1<<i)),profit:bestProfit,spend:bestSpend};}
