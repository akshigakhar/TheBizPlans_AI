import type { AuthSession } from './auth-client.ts';
import { supabasePublishableKey as publishableKey, supabaseUrl } from './config.ts';

export type BusinessPlanRow = {
  id: string; user_id: string; plan_name: string; business_name: string;
  country: string | null; region: string | null; city: string | null;
  currency: string; projection_months: number; created_at: string; updated_at: string;
  plan_data?: Record<string, unknown> | null;
};

export type BusinessPlanInput = {
  planName: string; businessName: string; country?: string; region?: string;
  city?: string; currency?: string; projectionPeriod?: string;
};


function projectionMonths(value = '') {
  const months = Number(value.match(/\d+/)?.[0] || 36);
  return value.toLowerCase().includes('year') ? months * 12 : months;
}

function payload(userId: string, input: BusinessPlanInput) {
  return {
    user_id: userId,
    plan_name: input.planName.trim() || 'Untitled business plan',
    business_name: input.businessName.trim() || 'New business',
    country: input.country?.trim() || null,
    region: input.region?.trim() || null,
    city: input.city?.trim() || null,
    currency: input.currency || 'USD',
    projection_months: projectionMonths(input.projectionPeriod),
    plan_data: input,
  };
}

async function request(session: AuthSession, query = '', init: RequestInit = {}) {
  if (!supabaseUrl || !publishableKey) throw new Error('Supabase data access is not configured.');
  const response = await fetch(`${supabaseUrl}/rest/v1/business_plans${query}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.details || 'Unable to save business-plan data.');
  return data;
}

export const businessPlansClient = {
  async list(session: AuthSession): Promise<BusinessPlanRow[]> {
    return request(session, '?select=*&order=updated_at.desc');
  },
  async create(session: AuthSession, input: BusinessPlanInput): Promise<BusinessPlanRow> {
    const rows = await request(session, '', {
      method: 'POST', headers: { prefer: 'return=representation' },
      body: JSON.stringify(payload(session.user.id, input)),
    });
    return rows[0];
  },
  async update(session: AuthSession, id: string, input: BusinessPlanInput): Promise<BusinessPlanRow> {
    const rows = await request(session, `?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'PATCH', headers: { prefer: 'return=representation' },
      body: JSON.stringify({ ...payload(session.user.id, input), updated_at: new Date().toISOString() }),
    });
    if (!rows[0]) throw new Error('Business plan not found.');
    return rows[0];
  },
  async remove(session: AuthSession, id: string) {
    await request(session, `?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export function planRowToForm(row: BusinessPlanRow) {
  const years = row.projection_months / 12;
  return { ...(row.plan_data || {}), planName: row.plan_name, businessName: row.business_name, country: row.country || '',
    region: row.region || '', city: row.city || '', currency: row.currency,
    projectionPeriod: `${years} ${years === 1 ? 'year' : 'years'} (${row.projection_months} months)` };
}
