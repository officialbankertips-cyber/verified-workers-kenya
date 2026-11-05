const BASE_URL = (process.env.OPTIMAPAY_BASE_URL || "https://optimapaybridge.co.ke/api/v2").replace(/\/+$/, "");

function credentials() {
  const apiKey = process.env.OPTIMAPAY_API_KEY;
  const apiSecret = process.env.OPTIMAPAY_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("Optimapay API credentials are not configured.");
  return { apiKey, apiSecret };
}

async function request(path, { method = "GET", body, query } = {}) {
  const { apiKey, apiSecret } = credentials();
  const url = new URL(`${BASE_URL}/${path.replace(/^\//, "")}`);
  if (query) for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    method,
    headers: {
      "X-API-Key": apiKey,
      "X-API-Secret": apiSecret,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(`Optimapay returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok || data.success === false) throw new Error(data.message || `Optimapay request failed (HTTP ${response.status}).`);
  return data;
}

function normalizeKenyanPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const phone = digits.startsWith("0") ? `254${digits.slice(1)}` : digits.startsWith("7") || digits.startsWith("1") ? `254${digits}` : digits;
  if (!/^254[17]\d{8}$/.test(phone)) throw new Error("Enter a valid Kenyan mobile number, for example 0712345678.");
  return phone;
}

async function stkPush({ phone, amount, reference, description }) {
  const paymentAccountId = Number(process.env.OPTIMAPAY_PAYMENT_ACCOUNT_ID);
  if (!Number.isInteger(paymentAccountId) || paymentAccountId < 1) throw new Error("Optimapay payment account ID is not configured.");
  const normalizedPhone = normalizeKenyanPhone(phone);
  return request("stkpush.php", {
    method: "POST",
    body: {
      payment_account_id: paymentAccountId,
      phone: normalizedPhone,
      amount: Number(amount),
      reference,
      description
    }
  });
}

async function checkStatus(checkoutRequestId) {
  if (!checkoutRequestId) throw new Error("Optimapay checkout request ID is missing.");
  return request("status.php", { method: "POST", body: { checkout_request_id: checkoutRequestId } });
}

async function listTransactions(page = 1, limit = 20) {
  return request("transactions.php", { query: { page, limit } });
}

module.exports = { stkPush, checkStatus, listTransactions, normalizeKenyanPhone };
