/**
 * The channel services read their gateway configuration off `process.env` when
 * the module loads. Clearing it here - before any import - keeps a test run from
 * pointing at the live Text.lk / Twilio / Expo endpoints.
 */
for (const key of [
  "SMS_PROVIDER",
  "SMS_GATEWAY_URL",
  "SMS_API_KEY",
  "SMS_SENDER_ID",
  "TEXTLK_API_KEY",
  "TEXTLK_SENDER_ID",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "PUSH_GATEWAY_URL",
  "SIREN_RELAY_URL",
  "DATABASE_URL",
  "PGHOST",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
]) {
  delete process.env[key];
}
