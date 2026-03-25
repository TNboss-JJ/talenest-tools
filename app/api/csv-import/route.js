import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { slack } from "@/lib/slack";

const limiter = rateLimit({ windowMs: 60_000, max: 3 });

const TABLE_SCHEMAS = {
  contacts: {
    fields: ["name", "email", "phone", "company", "title", "type", "stage", "linkedin_url", "website_url", "notes", "tags", "score"],
    required: ["name"],
    defaults: { type: "investor", stage: "identified", score: 0 }
  },
  expenses: {
    fields: ["date", "vendor", "description", "amount", "currency", "category", "tax_deductible", "source_type", "source_file", "notes"],
    required: ["vendor"],
    defaults: { currency: "USD", category: "기타", tax_deductible: false, source_type: "card_statement" }
  },
  leads: {
    fields: ["name", "company", "title", "email", "linkedin_url", "website_url", "source_url", "fit_score", "fit_reason", "status"],
    required: ["name"],
    defaults: { status: "new", fit_score: 0 }
  }
};

const KNOWN_MAPPINGS = {
  expenses: {
    "항목명": "vendor", "이름": "vendor", "name": "vendor",
    "날짜": "date", "date": "date", "결제일": "date",
    "금액": "amount", "amount": "amount", "가격": "amount", "price": "amount",
    "유형": "description", "type": "description", "종류": "description",
    "지출 분류": "category", "분류": "category", "category": "category",
    "결제수단": "notes", "payment": "notes",
    "도구/사이트명": "description", "도구": "description",
    "활용 목적": "notes", "목적": "notes", "purpose": "notes",
    "비고": "notes", "memo": "notes", "note": "notes", "notes": "notes",
    "통화": "currency", "currency": "currency",
    "관련 프로젝트": "source_file",
  },
  contacts: {
    "이름": "name", "name": "name", "성명": "name",
    "이메일": "email", "email": "email", "메일": "email",
    "전화": "phone", "phone": "phone", "연락처": "phone",
    "회사": "company", "company": "company", "회사명": "company", "기관": "company",
    "직함": "title", "title": "title", "직위": "title", "role": "title",
    "링크드인": "linkedin_url", "linkedin": "linkedin_url",
    "웹사이트": "website_url", "website": "website_url", "홈페이지": "website_url",
    "메모": "notes", "노트": "notes", "notes": "notes", "비고": "notes",
    "유형": "type", "type": "type", "구분": "type",
    "단계": "stage", "stage": "stage", "상태": "stage",
    "점수": "score", "score": "score",
    "태그": "tags", "tags": "tags",
  },
  leads: {
    "이름": "name", "name": "name",
    "회사": "company", "company": "company",
    "직함": "title", "title": "title",
    "이메일": "email", "email": "email",
    "링크드인": "linkedin_url", "linkedin": "linkedin_url",
    "웹사이트": "website_url", "website": "website_url",
    "출처": "source_url", "source": "source_url",
    "점수": "fit_score", "score": "fit_score",
    "사유": "fit_reason", "reason": "fit_reason",
    "상태": "status", "status": "status",
  }
};

const CATEGORY_MAP = {
  "초기설정비": "기타",
  "고정비(매달)": "SaaS/구독",
  "고정비(매년)": "SaaS/구독",
  "일시비": "기타",
  "법적/행정": "법무/상표",
  "도구/툴": "SaaS/구독",
  "교통": "교통/출장",
  "식비": "식비/회의비",
  "마케팅": "마케팅/광고",
  "클라우드": "클라우드/호스팅",
  "도메인": "도메인/DNS",
  "디자인": "디자인도구",
  "교육": "교육/컨퍼런스",
};

const SYSTEM_PROMPT = `You are a CSV column mapper. Given CSV headers and a target database schema, map each CSV column to the correct database field.
Match by meaning (Korean or English). Return a JSON object: { "csv_header": "db_field" or null }.
Respond ONLY with valid JSON. No markdown.`;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = limiter.check(user.id);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    const { table, csvText } = await request.json();
    const schema = TABLE_SCHEMAS[table];
    if (!schema) return NextResponse.json({ error: "Invalid table: " + table }, { status: 400 });
    if (!csvText) return NextResponse.json({ error: "csvText required" }, { status: 400 });

    // Clean BOM and normalize line endings
    const cleaned = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Parse CSV properly
    const { headers, rows } = parseCSV(cleaned);

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: "CSV needs header + at least 1 data row", headers }, { status: 400 });
    }

    // Map columns: try known mappings first, fall back to Claude
    let mapping = knownMapping(headers, table);
    const unmapped = headers.filter(h => !mapping[h]);

    if (unmapped.length > 0 && apiKey) {
      try {
        const aiMapping = await claudeMap(unmapped, schema.fields, apiKey);
        Object.assign(mapping, aiMapping);
      } catch (e) {
        // Claude failed, continue with what we have
      }
    }

    // Build records
    const records = rows
      .map(row => {
        const record = { user_id: user.id };
        Object.entries(schema.defaults).forEach(([k, v]) => { record[k] = v; });

        Object.entries(mapping).forEach(([csvCol, dbField]) => {
          if (!dbField || row[csvCol] === undefined || row[csvCol] === "") return;
          let val = row[csvCol].trim();

          if (dbField === "amount") {
            val = val.replace(/[$,₩€£¥\s]/g, "");
            val = parseFloat(val) || 0;
          }
          else if (dbField === "score" || dbField === "fit_score") {
            val = parseInt(val) || 0;
          }
          else if (dbField === "tax_deductible") {
            val = ["true", "yes", "1", "예", "o", "checked"].includes(String(val).toLowerCase());
          }
          else if (dbField === "tags" && typeof val === "string") {
            val = val.split(",").map(t => t.trim()).filter(Boolean);
          }
          else if (dbField === "date") {
            val = normalizeDate(val);
          }
          else if (dbField === "category" && table === "expenses") {
            val = mapCategory(val);
          }

          // For notes, concat multiple fields
          if (dbField === "notes" && record.notes) {
            record.notes += " | " + val;
          } else {
            record[dbField] = val;
          }
        });

        // Currency detection from amount string
        if (table === "expenses") {
          const amountRaw = Object.entries(mapping).find(([_, db]) => db === "amount");
          if (amountRaw) {
            const rawVal = row[amountRaw[0]] || "";
            if (rawVal.includes("₩") || rawVal.includes("원")) record.currency = "KRW";
            else if (rawVal.includes("$")) record.currency = "USD";
            else if (rawVal.includes("€")) record.currency = "EUR";
          }
          record.source_type = "card_statement";
        }

        const hasRequired = schema.required.every(f => record[f]);
        return hasRequired ? record : null;
      })
      .filter(Boolean);

    if (records.length === 0) {
      return NextResponse.json({
        error: "No valid records found. Check column mapping.",
        mapping,
        headers,
        sample_row: rows[0]
      }, { status: 400 });
    }

    const { data: inserted, error: dbErr } = await supabase.from(table).insert(records).select();
    if (dbErr) return NextResponse.json({ error: dbErr.message, mapping }, { status: 500 });

    slack.csvImported(table, inserted.length);
    return NextResponse.json({
      inserted: inserted.length,
      total_rows: rows.length,
      mapping,
      headers,
      records: inserted
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parseCSV(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCSVLine(lines[0]);
  const rows = lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const vals = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || "").trim(); });
      return obj;
    });

  return { headers, rows };
}

function splitCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}

function knownMapping(headers, table) {
  const known = KNOWN_MAPPINGS[table] || {};
  const mapping = {};
  headers.forEach(h => {
    const lower = h.toLowerCase().trim();
    if (known[h]) { mapping[h] = known[h]; }
    else if (known[lower]) { mapping[h] = known[lower]; }
    else {
      const match = Object.entries(known).find(([k]) =>
        lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
      );
      mapping[h] = match ? match[1] : null;
    }
  });
  return mapping;
}

function normalizeDate(val) {
  if (!val) return new Date().toISOString().split("T")[0];
  // M/D/YYYY or MM/DD/YYYY
  const slashMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // YYYY.MM.DD
  const dotMatch = val.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (dotMatch) {
    const [, y, m, d] = dotMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return val;
}

function mapCategory(val) {
  if (!val) return "기타";
  const lower = val.toLowerCase();
  for (const [key, mapped] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return mapped;
    }
  }
  return "기타";
}

async function claudeMap(headers, fields, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `CSV headers: ${JSON.stringify(headers)}\nTarget fields: ${JSON.stringify(fields)}` }]
    })
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("") || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}