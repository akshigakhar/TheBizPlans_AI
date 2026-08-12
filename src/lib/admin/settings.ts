export const ADMIN_SETTING_DEFAULTS = {
  ai_generation_enabled: true,
  payments_enabled: true,
  exports_enabled: true,
  max_regenerations_per_section: 2,
  max_ai_calls_per_plan: 40,
  max_ai_calls_per_user_day: 60,
  max_input_context_size: 60_000,
  max_output_token_cap: 2_000,
  export_platform_branding: true,
  confidentiality_notice_enabled: true,
  high_plan_ai_cost_usd: 5,
  high_generation_count: 20,
  high_regeneration_count: 8,
  repeated_failure_count: 3,
} as const;

export type AdminSettingKey = keyof typeof ADMIN_SETTING_DEFAULTS;
export type AdminSettings = { [K in AdminSettingKey]: (typeof ADMIN_SETTING_DEFAULTS)[K] extends boolean ? boolean : number };
export interface OperationalSettingsReader { get<K extends AdminSettingKey>(key: K): Promise<AdminSettings[K]> }

export class MemoryOperationalSettings implements OperationalSettingsReader {
  private values: AdminSettings;
  constructor(values: Partial<AdminSettings> = {}) { this.values = { ...ADMIN_SETTING_DEFAULTS, ...values } as AdminSettings; }
  async get<K extends AdminSettingKey>(key: K) { return this.values[key]; }
  async update<K extends AdminSettingKey>(role: 'user' | 'admin', key: K, value: AdminSettings[K]) {
    if (role !== 'admin') throw new Error('admin_required');
    this.values[key] = value;
  }
}

export const unavailableMessages = {
  ai: 'AI generation is temporarily unavailable. You can continue editing your existing business plan.',
  payments: 'Purchases are temporarily unavailable. Existing purchases remain available.',
  exports: 'New export generation is temporarily unavailable. Existing generated exports remain downloadable.',
} as const;
