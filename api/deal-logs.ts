import { env } from 'node:process'
import { neon } from '@neondatabase/serverless'
import {
  buildDealLogRecord,
  dealLogRequestSchema,
} from '../src/domain/loanSizer/dealLog.js'

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  setHeader(name: string, value: string): void
  status(code: number): ApiResponse
  json(body: unknown): void
}

async function ensureDealLogsTable(
  sql: ReturnType<typeof neon>,
): Promise<void> {
  await sql`
    create table if not exists deal_logs (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      log_type text not null,
      street_address text not null default '',
      notes text not null default '',
      inputs_json jsonb not null,
      outputs_json jsonb not null,
      purchase_price numeric,
      rehab_budget numeric,
      estimated_arv numeric,
      requested_purchase_pct numeric,
      requested_construction_pct numeric,
      purchase_money_loan numeric,
      rehab_loan numeric,
      final_rate numeric,
      project_type text,
      tier text
    )
  `
  await sql`
    alter table deal_logs
      add column if not exists street_address text not null default ''
  `
}

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const parsed = dealLogRequestSchema.safeParse(request.body)
  if (!parsed.success) {
    return response.status(400).json({
      error: 'Invalid deal log payload',
      issues: parsed.error.issues,
    })
  }

  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) {
    return response.status(503).json({
      error: 'Deal logging is not configured. Add DATABASE_URL in Vercel.',
    })
  }

  try {
    const sql = neon(databaseUrl)
    await ensureDealLogsTable(sql)
    const record = buildDealLogRecord(parsed.data)
    const rows = await sql`
      insert into deal_logs (
        log_type,
        street_address,
        notes,
        inputs_json,
        outputs_json,
        purchase_price,
        rehab_budget,
        estimated_arv,
        requested_purchase_pct,
        requested_construction_pct,
        purchase_money_loan,
        rehab_loan,
        final_rate,
        project_type,
        tier
      )
      values (
        ${record.logType},
        ${record.streetAddress},
        ${record.notes},
        ${record.inputsJson}::jsonb,
        ${record.outputsJson}::jsonb,
        ${record.purchasePrice},
        ${record.rehabBudget},
        ${record.estimatedArv},
        ${record.requestedPurchasePct},
        ${record.requestedConstructionPct},
        ${record.purchaseMoneyLoan},
        ${record.rehabLoan},
        ${record.finalRate},
        ${record.projectType},
        ${record.tier}
      )
      returning id, created_at
    `

    return response.status(201).json({ ok: true, log: rows[0] })
  } catch {
    return response.status(500).json({
      error: 'Unable to save this deal log.',
    })
  }
}
