# Verified Workers Platform

A Node.js/Express + MongoDB starter platform for workers, employers and recruitment agencies in Kenya.

## Included
- Responsive public landing page, worker directory and registration/login pages
- Worker, employer, recruitment agency and admin roles
- One-time Ksh 199 M-Pesa STK Push registration flow with callback validation
- Worker profiles, private document uploads and owner/admin-only signed document access
- Job listings, job moderation, worker applications and candidate management
- Admin dashboard for account review, document review, job moderation and payment records
- Password reset foundation with hashed, expiring tokens and optional SMTP delivery
- Cloudflare R2-compatible private object storage configuration and connectivity check
- Render deployment template and environment example

## Important implementation notes
This is an extended MVP foundation, not a fully audited production recruitment service. Before public launch:
- Configure MongoDB Atlas, Cloudflare R2, Render environment variables, Optimapay credentials and SMTP.
- Test registration, Optimapay payment verification, document upload/download, application workflows and password reset end to end.
- Add malware scanning and stronger file signature validation before accepting real identity documents.
- Review Kenyan data-protection obligations and employment/recruitment licensing requirements for your operating model.
- Use Optimapay test credentials/account where available, then verify with the provider before accepting live registration payments.
- Do not collect or store M-Pesa PINs. Never put Optimapay secrets or R2 credentials in frontend code.

## Local setup
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MONGODB_URI` and a long random `SESSION_SECRET`.
5. Configure Optimapay API credentials and payment account ID in Render.
6. Run `npm run dev`.
7. Open `http://localhost:3000`.

## Render deployment
- Create a new Web Service from the GitHub repository.
- Build command: `npm install`
- Start command: `npm start`
- Add all required `.env.example` values in Render Environment.
- Set `APP_URL` to your actual HTTPS Render service URL.
- Use MongoDB Atlas with network access configured for Render.

## First admin account
Create a normal account, then promote its MongoDB user document's `role` to `admin` using MongoDB Atlas. Do this securely and change the password immediately. Do not expose an admin-creation endpoint publicly.


## Additional modules (extended build)
- Admin dashboard at `/dashboard.html` for account review, job moderation and payment records.
- Worker applications and employer/agency candidate management.
- Private document upload/download endpoints using an S3-compatible private bucket.
- Password reset flow with hashed, expiring tokens and optional SMTP email.
- Profile editing and payment history.

### Additional environment configuration
### Cloudflare R2 private document storage (recommended)

1. In the Cloudflare dashboard, open **Storage & databases → R2 Object Storage** and create a bucket, for example `verified-workers-private-documents`. Choose a location appropriate for your users and data-residency requirements.
2. Keep the bucket **private**. Do not enable public bucket access or attach a public custom domain to worker documents.
3. Under **R2 → Overview → Manage API Tokens**, create an R2 token with **Object Read & Write** permissions, scoped to this bucket only. Copy the Access Key ID and Secret Access Key immediately; Cloudflare will not show the secret again.
4. Copy your account ID and configure these Render environment variables:

```env
S3_BUCKET=verified-workers-private-documents
S3_REGION=auto
S3_ENDPOINT=https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your_r2_access_key_id
S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
```

5. In Render, open your web service → **Environment**, add the variables above, save changes, and redeploy. Do not put credentials in source code, GitHub, frontend JavaScript, or chat messages.
6. After deployment, run `npm run check:storage` in the Render Shell (or locally with the same environment variables) to test the connection. The check writes and deletes a temporary object in the bucket.

The application uses Cloudflare's S3-compatible endpoint and the `auto` region. Uploads are made by the Express server, not directly from the browser. Documents are stored under private per-user object keys; the application authorizes the owner or an admin before generating a 90-second signed download URL. R2 encrypts stored objects at rest automatically, so the app does not send an AWS-specific server-side-encryption header. Keep the token limited to this one bucket and rotate it if it is ever exposed.

Cloudflare setup references: [R2 S3 API setup](https://developers.cloudflare.com/r2/get-started/s3/) and [R2 token permissions](https://developers.cloudflare.com/r2/api/tokens/).

Set SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) to enable password-reset and recruitment emails. Without SMTP, reset requests intentionally return a generic response but no email can be delivered.

### Admin access
Register the intended admin account first. Set `ADMIN_EMAIL` in the environment and run `npm run promote-admin` once from a trusted terminal. The script only promotes the matching existing account and does not change its password. Then sign in and open `/dashboard.html`. There is deliberately no public admin signup route.

### Data protection and production checklist
- Publish reviewed Terms of Service and Privacy Notice; obtain clear, recorded consent before collecting personal data.
- Set retention/deletion rules and a process for data-subject access/correction/deletion requests.
- Use a private bucket, encryption at rest, TLS, least-privilege IAM credentials and regular backups.
- Add malware scanning and stronger file signature validation before allowing uploaded documents into production workflows.
- Conduct a security review, penetration test and legal review for Kenyan data-protection, employment-agency and recruitment requirements.
- Configure a real email/SMS delivery provider, support contacts, dispute handling and incident response.

Legal pages at `/terms.html` and `/privacy.html` are starter drafts with placeholders. They must be reviewed and completed by the platform operator and Kenyan legal/privacy professionals before public launch.


## Optimapay payment configuration

Set these variables in Render → Environment:

- `OPTIMAPAY_BASE_URL=https://optimapaybridge.co.ke/api/v2`
- `OPTIMAPAY_API_KEY` — your Optimapay API key
- `OPTIMAPAY_API_SECRET` — your Optimapay API secret
- `OPTIMAPAY_PAYMENT_ACCOUNT_ID` — the numeric payment account ID configured in Optimapay

The app sends JSON to `POST /stkpush.php` with `payment_account_id`, `phone`, `amount`, `reference`, and `description`; it verifies using `POST /status.php` with `checkout_request_id`; administrators can inspect the provider transaction log through the protected `/api/payments/admin/provider-transactions` endpoint. The payment amount is fixed server-side at Ksh 199. Never put Optimapay credentials in frontend code or commit them to Git.
