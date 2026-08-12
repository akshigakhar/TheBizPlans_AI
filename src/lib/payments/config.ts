export const ENTITLEMENT_KEYS = ['docx_export','pdf_export','xlsx_export'] as const;
export type EntitlementKey = typeof ENTITLEMENT_KEYS[number] | 'premium_generation' | 'additional_ai_generations';

export interface Product {key:string;name:string;stripePriceId:string;entitlements:readonly EntitlementKey[]}

/** Server-only product catalogue. Never serialize stripePriceId to a browser. */
export function getProducts(env:Record<string,string|undefined>=((globalThis as any).process?.env||{})):Record<string,Product>{
  return {complete_business_plan:{key:'complete_business_plan',name:'Complete Business Plan',stripePriceId:env.STRIPE_COMPLETE_PLAN_PRICE_ID||'',entitlements:ENTITLEMENT_KEYS}};
}
export function getProduct(key:string,env?:Record<string,string|undefined>){const product=getProducts(env)[key];if(!product)throw new Error('unknown_product');if(!product.stripePriceId)throw new Error('stripe_price_not_configured');return product}
export const AI_LIMITS={initialGenerationsPerSection:1,includedRegenerationsPerSection:2} as const;
