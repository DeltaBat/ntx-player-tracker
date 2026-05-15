# 03 · GitHub Actions secrets

After the repo is pushed to GitHub:

1. Go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** for each:

| Name | Value |
|---|---|
| `SHEET_ID` | The long ID from the sheet URL (between `/d/` and `/edit`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The entire contents of the service account JSON file. Paste the raw JSON text including braces and newlines — GitHub stores it as-is. |

To verify: open the Actions tab and click **Run workflow** on `Tracker scrape` after the workflow is added (Task 16). Watch the run log.
