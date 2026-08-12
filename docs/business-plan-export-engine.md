# Professional Standard export engine

Exports are deterministic server operations. The browser submits only a plan ID and one of
`docx`, `pdf`, or `xlsx`. The server authorizes ownership, calls the readiness adapter, loads
the approved content-version rows and current immutable financial snapshot, then builds one
`BusinessPlanExportData` object consumed by every renderer. No export module imports AI code.

DOCX and XLSX use dependency-free OOXML generation because the deployment's package registry
is restricted. PDF is emitted directly as selectable-text PDF 1.7, avoiding Chromium,
LibreOffice, native binaries, temporary files, and serverless package-size issues. The main
documents contain annual financial tables; monthly approved values are confined to Excel.

Production storage implements `PrivateExportStorage` with the existing private S3 bucket.
Use the `business-plan-exports/{planId}/v{version}/...` prefix, S3 Block Public Access,
SSE-S3 or SSE-KMS, and an application-authenticated 10-minute download handoff. Never persist
a signed URL. The included memory adapter is only for tests.

The hash includes approved section version IDs/content, financial snapshot ID/version, and
template version. A ready object with the same type/hash/template is reused. A changed hash
receives the next plan export version and prior ready rows become superseded; files remain.
