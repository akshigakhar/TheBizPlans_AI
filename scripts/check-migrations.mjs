import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'migrations/20260812040000_create_business_plan_generation.sql',
    required: [
      'business_plan_sections',
      'business_plan_section_versions',
      'ai_usage_events',
    ],
  },
  {
    file: 'migrations/20260812050000_business_plan_editor_workflow.sql',
    required: [
      'approved_by',
      'approved_content_version_id',
      'source_reviewed_at',
      'revision',
    ],
  },
  {
    file: 'migrations/20260812060000_business_plan_exports.sql',
    required: [
      'business_plan_exports',
      'plan_content_hash',
      'storage_key',
      'enable row level security',
    ],
  },
];

for (const { file, required } of checks) {
  const migration = readFileSync(file, 'utf8').toLowerCase();

  for (const name of required) {
    if (!migration.includes(name)) {
      throw new Error(`${file} is missing ${name}`);
    }
  }
}

console.log(`Validated ${checks.length} migration files.`);
