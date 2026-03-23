import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const TABLE_SCHEMAS = {
  contacts: {
    fields: ["name", "email", "phone", "company", "title", "type", "stage", "linkedin_url", "website_url", "notes", "tags", "score"],
    required: ["name"],
    defaults: { type: "investor", stage: "identified", score: 0 }
  },
  expenses: {
    fields: ["date", "vendor", "description", "amount", "currency", "category", "tax_deductible", "source_type", "source_file", "notes"],
    required: ["vendor", "amount"],
    defaults: { currency: "USD", category: "기타", tax_deductible: false, source_type: "card_statement" }
  },
  leads: {
    fields: ["name", "company", "title", "email", "linkedin_url", "website_url", "source_url", "fit_score", "fit_reason", "status"],
    required: ["name"],
    defaults: { status: "new", fit_score: 0 }
  }
};

const SYSTEM_PROMPT = `You are a CSV column mapper. Given CSV headers and a target database schema, map each CSV column to the correct database field.

Rules:
- Match by meaning, not exact name (e.g. "회사명" or "Company" → "company", "이름" or "Name" → "name", "금액" or "Amount" → "amount")
- Korean and English headers both work
- If a column doesn't match any field, set it to null
- Return a JSON object mapping CSV header → database field (or null)

Example input: CSV headers: ["이름", "회사", "이메일", "투자단계", "메모"]
Target fields: ["name", "email", "company", "title", "stage", "notes"]

Example output: {"이름": "name", "회사": "company", "이메일": "email", "투자단계": "stage", "메모": "notes"}

Respond ONLY with a valid JSON object. No markdown, no backticks.`;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const { table, csvText, rows, headers, mapping: manualMapping } = await request.json();
    const schema = TABLE_SCHEMAS[table];
    if (!schema) return NextResponse.json({ error: "Invalid table" }, { status: 400 });

    // Step 1: If rows already parsed and mapping provided, skip to insert
    if (rows && manualMapping) {
      const records = mapAndInsert(rows, manualMapping, schema, user.id);
      const { data, error } = await supabase.from(table).insert(records).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ inserted: data.length, records: data });
    }

    // Step 2: Parse CSV text
    if (!csvText) return NextResponse.json({ error: "csvText required" }, { status: 400 });

    const lines = csvText.trim().split("\n");
    if (lines.length < 2) return NextResponse.json({ error: "CSV needs header + at least 1 row" }, { status: 400 });

    const parsedHeaders = parseCSVLine(lines[0]);
    const parsedRows = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      const obj = {};
      parsedHeaders.forEach((h, i) => { obj[h] = vals[i] || ""; });
      return obj;
    });

    // Step 3: Auto-map with Claude (or simple matching if no API key)
    let mapping;
    if (apiKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `CSV headers: ${JSON.stringify(parsedHeaders)}\nTarget fields: ${JSON.stringify(schema.fields)}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "{}";
      mapping = JSON.parse(text.replace(/```json|```/g, "").trim());
    } else {
      mapping = simpleMatch(parsedHeaders, schema.fields);
    }

    // Step 4: Insert
    const records = mapAndInsert(parsedRows, mapping, schema, user.id);

    if (records.length === 0) {
      return NextResponse.json({ error: "No valid records to insert", mapping, headers: parsedHeaders }, { status: 400 });
    }

    const { data: inserted, error: dbErr } = await supabase.from(table).insert(records).select();
    if (dbErr) return NextResponse.json({ error: dbErr.message, mapping }, { status: 500 });

    return NextResponse.json({
      inserted: inserted.length,
      total_rows: parsedRows.length,
      mapping,
      headers: parsedHeaders,
      records: inserted
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function mapAndInsert(rows, mapping, schema, userId) {
  return rows
    .map(row => {
      const record = { user_id: userId, ...schema.defaults };
      Object.entries(mapping).forEach(([csvCol, dbField]) => {
        if (dbField && row[csvCol] !== undefined && row[csvCol] !== "") {
          let val = row[csvCol];
          if (dbField === "amount" || dbField === "score" || dbField === "fit_score") val = parseFloat(val) || 0;
          if (dbField === "tax_deductible") val = ["true", "yes", "1", "예", "o"].includes(String(val).toLowerCase());
          if (dbField === "tags" && typeof val === "string") val = val.split(",").map(t => t.trim());
          record[dbField] = val;
        }
      });
      const hasRequired = schema.required.every(f => record[f]);
      return hasRequired ? record : null;
    })
    .filter(Boolean);
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function simpleMatch(headers, fields) {
  const mapping = {};
  const lowerFields = fields.map(f => f.toLowerCase());
  headers.forEach(h => {
    const lower = h.toLowerCase().replace(/[^a-z가-힣]/g, "");
    const idx = lowerFields.findIndex(f => f === lower || lower.includes(f) || f.includes(lower));
    mapping[h] = idx >= 0 ? fields[idx] : null;
  });
  return mapping;
}
