import type {PremiumPlanId} from './premium';
/** Only a future provider adapter may create this after signature verification. */
export interface VerifiedEntitlementEvent {
 eventId:string;userId:string;level:'free'|PremiumPlanId;validUntil:string|null;source:string;
}
export interface BillingProviderAdapter {
 verify(rawBody:Uint8Array,headers:Headers):Promise<VerifiedEntitlementEvent>;
}
