# Quick Deploy: Admin Subdomain (admin.driiva.co.uk)

## 3-Step Setup (5 minutes)

### Step 1: Add Domain in Vercel

1. Go to https://vercel.com → Your Project → Settings → Domains
2. Click **"Add Domain"**
3. Enter: `admin.driiva.co.uk`
4. Click **"Add"**

Vercel will show you the DNS records needed. Keep this tab open.

### Step 2: Add DNS Record

In your domain registrar's DNS settings (e.g., Namecheap, GoDaddy, Cloudflare):

**Add this record:**
```
Type:  CNAME
Name:  admin
Value: cname.vercel-dns.com
TTL:   Auto (or 3600)
```

**Save the DNS record.**

### Step 3: Whitelist Domain in Firebase

1. Go to Firebase Console → Authentication → Settings → **Authorized domains**
2. Click **"Add domain"**
3. Enter: `admin.driiva.co.uk`
4. Click **"Add"**

---

## Wait (5-60 minutes)

DNS propagation takes time. You'll know it's ready when:

1. Vercel shows a ✅ green checkmark next to `admin.driiva.co.uk` in Domains
2. Vercel shows "Valid Configuration" under the domain
3. An SSL certificate is automatically provisioned (shows padlock icon)

---

## Test

Visit: **https://admin.driiva.co.uk/admin/monitoring**

Expected behavior:
- ✅ Page loads with "Live Monitoring" title
- ✅ SSL padlock shows (secure connection)
- ✅ If not logged in, redirects to signin
- ✅ After signin as admin, dashboard shows metrics

---

## Troubleshooting

### "This site can't be reached"
→ DNS hasn't propagated yet. Wait 10-20 more minutes.

### "Waiting for Verification" in Vercel
→ DNS record isn't correct. Double-check the CNAME points to `cname.vercel-dns.com`

### Dashboard shows 404
→ The route is `/admin/monitoring`, not just `/monitoring`. Use full URL above.

### "Invalid domain configuration" in Firebase Auth
→ Add `admin.driiva.co.uk` to Firebase Console → Authentication → Authorized domains

---

## What This Gives You

Once live, you'll have:

- **admin.driiva.co.uk/admin** → Admin Overview (existing)
- **admin.driiva.co.uk/admin/monitoring** → **NEW** Live monitoring dashboard
- **admin.driiva.co.uk/admin/users** → User management (existing)
- **admin.driiva.co.uk/admin/trips** → Trip management (existing)
- **admin.driiva.co.uk/admin/feedback** → Feedback viewer (existing)
- **admin.driiva.co.uk/admin/system** → Damoov sync logs (existing)

All admin pages are accessible from both:
- `driiva.co.uk/admin/*` (original)
- `admin.driiva.co.uk/admin/*` (new subdomain)

---

## Next: Wire Up Live Data

The monitoring page is live but showing placeholder data in some sections. To get real metrics:

1. Follow **docs/MONITORING_PROMPT.md** (Tasks 1-5) to wire Sentry, Cloud Monitoring, Vercel Analytics
2. Deploy the changes via `git push` (Vercel auto-deploys)
3. Return to `admin.driiva.co.uk/admin/monitoring` — all sections will be live

**Estimated time to complete monitoring wiring:** 2-3 hours (following the prompt)

---

## Files Created

- `client/src/pages/admin/monitoring.tsx` — Monitoring dashboard
- `docs/ADMIN_SUBDOMAIN_SETUP.md` — Full DNS guide
- `docs/ADMIN_MONITORING_SUMMARY.md` — Feature summary
- `QUICK_DEPLOY_ADMIN.md` — This file

## Files Modified

- `client/src/components/admin/AdminSidebar.tsx` — Added "Monitoring" nav item
- `client/src/App.tsx` — Added route

---

**Questions?** Check `docs/ADMIN_SUBDOMAIN_SETUP.md` for detailed troubleshooting.
