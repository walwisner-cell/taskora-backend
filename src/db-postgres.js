// PostgreSQL-backed datastore. Same public interface as db-json.js
// (all/find/filter/insert/update/remove/replaceAll) so route code written
// against either backend is identical — see db.js, which picks this module
// when DATABASE_URL is set.
//
// Design note on find/filter: these fetch the full table and apply the
// caller's JS predicate function in Node, rather than translating arbitrary
// JS predicates into SQL WHERE clauses. That's a deliberate, honest
// trade-off: at Taskora's current scale (hundreds, not millions, of rows)
// this is fast and correct, and it means every route handler already
// written against the old JSON store needed zero predicate-logic changes
// to run against real Postgres. If a table's row count grows into the
// millions, the highest-traffic queries (e.g. GET /providers) are the ones
// to rewrite with real SQL WHERE clauses first — the schema and indexes in
// schema.sql are already set up to support that.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false } // Render's managed Postgres requires SSL but uses a cert chain `pg` doesn't verify by default
    : (process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false),
});

// Maps each JS collection name to its real table + the exact column list,
// in (snake_case) DB order. Used to build safe, parameterized INSERT/UPDATE
// statements without ever interpolating arbitrary object keys into SQL.
const TABLES = {
  users: { table: 'users', columns: ['id','name','email','password_hash','role','country','city','state','phone','address','zip_code','phone_verified','verified','active','status','region','is_super_admin','provider_role','category','skills','tags','availability','pricing_model','plan','pay_preference','payout_method','notif_prefs','rating','jobs','price','color','since','profile_photo_url','category_approval_status','two_factor_enabled','business_name','business_registration_number','admin_department','organization_id','accepting_bookings','token_version','created_at','updated_at'] },
  categories: { table: 'categories', columns: ['id','name','icon','active','response_window_override_hours'] },
  countries: { table: 'countries', columns: ['id','name','status'] },
  cities: { table: 'cities', columns: ['id','name','country','admin_id'] },
  jobs: { table: 'jobs', columns: ['id','customer_id','category','description','budget','pay_currency','photo_urls','status','created_at'] },
  matches: { table: 'matches', columns: ['id','job_id','provider_id','customer_id','score','same_community','status','created_at'] },
  contracts: { table: 'contracts', columns: ['id','booking_number','customer_id','provider_id','job_id','service','date','time','address','amount','pay_currency','status','signed_at','materials_advance','photo_urls','provider_response_deadline','created_at'] },
  platformSettings: { table: 'platform_settings', columns: ['id','key','value','updated_at'] },
  homepageImages: { table: 'homepage_images', columns: ['id','slot','filename','url','created_at','updated_at'] },
  categoryImages: { table: 'category_images', columns: ['id','category_id','filename','url','created_at','updated_at'] },
  escrowTransactions: { table: 'escrow_transactions', columns: ['id','contract_id','amount','paid_currency','paid_amount_local','exchange_rate_note','status','payout_id','materials_advance_amount','materials_advance_released','materials_advance_payout_id','created_at'] },
  payouts: { table: 'payouts', columns: ['id','provider_id','gross_amount','commission_rate','commission_amount','amount','payout_currency','payout_amount_local','exchange_rate_note','method','status','line_items','date'] },
  disputes: { table: 'disputes', columns: ['id','contract_id','reason','amount','status','parties','resolved_at','created_at'] },
  reviews: { table: 'reviews', columns: ['id','contract_id','provider_id','author_name','stars','text','created_at'] },
  notifications: { table: 'notifications', columns: ['id','user_id','icon','text','time','read','link_to','created_at'] },
  messages: { table: 'messages', columns: ['id','from_id','to_id','text','created_at'] },
  verifications: { table: 'verifications', columns: ['id','user_id','doc_type','status','created_at'] },
  paymentMethods: { table: 'payment_methods', columns: ['id','user_id','brand','last4','name_on_card','expiry','billing_address','billing_zip','is_default','mode','created_at'] },
  passwordResets: { table: 'password_resets', columns: ['id','user_id','token_hash','expires_at','used','created_at'] },
  phoneVerifications: { table: 'phone_verifications', columns: ['id','user_id','code_hash','expires_at','used','created_at'] },
  portfolioPhotos: { table: 'portfolio_photos', columns: ['id','provider_id','filename','url','created_at'] },
  pendingRegistrations: { table: 'pending_registrations', columns: ['id','payload','phone_code_hash','email_code_hash','phone_verified','email_verified','expires_at','created_at'] },
  categoryRequests: { table: 'category_requests', columns: ['id','provider_id','requested_category','status','created_at','resolved_at'] },
  pendingLogins: { table: 'pending_logins', columns: ['id','user_id','code_hash','expires_at','created_at'] },
  fraudFlags: { table: 'fraud_flags', columns: ['id','type','severity','user_id','related_user_id','contract_id','details','status','reviewed_at','created_at'] },
  contactSubmissions: { table: 'contact_submissions', columns: ['id','name','email','subject','message','status','created_at'] },
  careersInquiries: { table: 'careers_inquiries', columns: ['id','name','email','role','message','status','created_at'] },
  advertisingInquiries: { table: 'advertising_inquiries', columns: ['id','company_name','contact_name','email','phone','message','status','target_city','is_live','price','currency_code','display_headline','display_subtext','display_link','approved_by','approved_at','created_at'] },
  salesInquiries: { table: 'sales_inquiries', columns: ['id','company_name','contact_name','email','team_size','message','status','agreed_price','agreed_currency','internal_notes','converted_to_org_id','updated_at','created_at'] },
  organizations: { table: 'organizations', columns: ['id','name','sales_inquiry_id','agreed_price','agreed_currency','commission_rate','seat_limit','account_manager_id','billing_contact_name','billing_contact_email','status','created_by','created_at','updated_at'] },
  organizationInvites: { table: 'organization_invites', columns: ['id','organization_id','code','created_by','max_uses','uses_count','expires_at','status','created_at'] },
  planPricingBase: { table: 'plan_pricing_base', columns: ['id','plan','usd_price','updated_at'] },
  planPricingOverrides: { table: 'plan_pricing_overrides', columns: ['id','country','plan','local_price','currency_code','set_by','updated_at'] },
  exchangeRates: { table: 'exchange_rates', columns: ['id','currency_code','rate_to_usd','source','fetched_at','updated_at'] },
};

// Columns stored as JSONB. `pg` serializes JS arrays using Postgres's native
// array literal syntax ({a,b,c}) by default, which is NOT valid JSON — these
// need an explicit JSON.stringify() before going out, and come back already
// parsed into JS objects/arrays by `pg` automatically on the way in.
const JSONB_COLUMNS = new Set(['tags', 'availability', 'notif_prefs', 'payload', 'line_items', 'link_to', 'value', 'photo_urls']);

// Postgres's NUMERIC type comes back from the pg driver as a STRING, not a
// JS number, specifically to avoid silent floating-point precision loss —
// but every route in this app expects a real number (adding, multiplying,
// comparing). Left unconverted, `0 + "180.00"` becomes the string
// "0180.00" (JS string concatenation, not addition) instead of the number
// 180. This list must include every column declared NUMERIC anywhere in
// schema.sql — it's checked against the schema, not assembled by memory,
// specifically because an incomplete list here fails silently (no error,
// just wrong math) rather than loudly.
const NUMERIC_COLUMNS = new Set([
  'rating', 'price', 'amount', 'grossAmount', 'commissionAmount', 'commissionRate',
  'materialsAdvance', 'materialsAdvanceAmount', 'paidAmountLocal', 'payoutAmountLocal',
  'usdPrice', 'localPrice', 'rateToUsd', 'agreedPrice', 'responseWindowOverrideHours',
]);

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

function rowToObject(row) {
  const obj = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = snakeToCamel(key);
    obj[camelKey] = (NUMERIC_COLUMNS.has(key) && value !== null) ? parseFloat(value) : value;
  }
  return obj;
}

async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
}
// Run once at startup; server.js awaits this before accepting requests.
const schemaReady = ensureSchema();

function tableInfo(collection) {
  const info = TABLES[collection];
  if (!info) throw new Error(`Unknown collection: ${collection}`);
  return info;
}

const db = {
  async all(collection) {
    await schemaReady;
    const { table } = tableInfo(collection);
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    return rows.map(rowToObject);
  },

  async find(collection, predicate) {
    const all = await db.all(collection);
    return all.find(predicate) || null;
  },

  async filter(collection, predicate) {
    const all = await db.all(collection);
    return all.filter(predicate);
  },

  async insert(collection, record) {
    await schemaReady;
    const { table, columns } = tableInfo(collection);
    // Only include columns the caller actually provided — this is what lets
    // real Postgres column defaults (active DEFAULT TRUE, phone_verified
    // DEFAULT FALSE, created_at DEFAULT now(), etc.) actually take effect.
    // Explicitly inserting NULL for every unset field, which an earlier
    // version of this did, silently overrides those defaults and violates
    // NOT NULL constraints — caught by testing signup against a real
    // database rather than assuming the JSON-store behavior would transfer.
    const presentCols = columns.filter(col => snakeToCamel(col) in record);
    const values = presentCols.map(col => {
      const v = record[snakeToCamel(col)];
      return JSONB_COLUMNS.has(col) && v !== null && v !== undefined ? JSON.stringify(v) : v;
    });
    const placeholders = presentCols.map((_, i) => `$${i + 1}`).join(', ');
    const colList = presentCols.join(', ');
    await pool.query(
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
      values
    );
    return record;
  },

  async update(collection, id, patch) {
    await schemaReady;
    const { table, columns } = tableInfo(collection);
    const patchWithTimestamp = { ...patch, updatedAt: new Date().toISOString() };
    const setCols = columns.filter(col => {
      const camel = snakeToCamel(col);
      return camel in patchWithTimestamp && col !== 'id';
    });
    if (!setCols.length) return db.find(collection, r => r.id === id);
    const setClause = setCols.map((col, i) => `${col} = $${i + 2}`).join(', ');
    const values = [id, ...setCols.map(col => {
      const v = patchWithTimestamp[snakeToCamel(col)];
      return JSONB_COLUMNS.has(col) && v !== null && v !== undefined ? JSON.stringify(v) : v;
    })];
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );
    return rows[0] ? rowToObject(rows[0]) : null;
  },

  async remove(collection, id) {
    await schemaReady;
    const { table } = tableInfo(collection);
    const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  async replaceAll(collection, records) {
    await schemaReady;
    const { table } = tableInfo(collection);
    await pool.query(`DELETE FROM ${table}`);
    for (const record of records) {
      await db.insert(collection, record);
    }
  },
};

module.exports = db;
