# Dev Bypass Mode Guide (Auth & Database)

This repository includes a built-in Developer Bypass Mode to let you perform experiments locally without requiring a running PostgreSQL database or completing sign-in flows.

---

## 🛠️ Current Status: BYPASS ACTIVE

All authentication checks automatically authorize you as:
- **User Name**: Dev User (Bypassed)
- **User Email**: `dev@trustlens.local`
- **Role**: `admin`

All audit data is saved to and retrieved from the local file system (`.audit-data/` directory) rather than requiring PostgreSQL connection.

---

## 🔄 How to Reconnect Everything Back (Post-Experiment)

When you are done with your experiments and want to reconnect real Authentication and live PostgreSQL Database queries, open `.env.local` and update the flags as follows:

```env
# Change these values from true to false:
DEV_BYPASS_AUTH=false
NEXT_PUBLIC_DEV_BYPASS_AUTH=false
DEV_BYPASS_DB=false
STORAGE_MODE=database
```

Or simply delete those 4 lines from `.env.local`.

---

## 📋 Flag Matrix Summary

| Setting | Current Value (Experimental) | Normal Production/Dev Value | Description |
| :--- | :--- | :--- | :--- |
| `DEV_BYPASS_AUTH` | `true` | `false` | Returns mock Admin session user for all server API requests |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH` | `true` | `false` | Auto-logs in frontend UI as Admin without sign-in modal/redirects |
| `DEV_BYPASS_DB` | `true` | `false` | Bypasses PostgreSQL pool connections & query execution |
| `STORAGE_MODE` | `file` | `database` | Uses local `.audit-data/` JSON file store for audit persistence |
