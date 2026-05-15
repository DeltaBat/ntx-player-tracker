# 01 · Google Cloud service account

The GitHub Actions cron writes to your sheet via a Google service account. This is a one-time setup.

## Steps

1. Open https://console.cloud.google.com/projectcreate. Create a project called `ntx-player-tracker`. (If you already have a Google Cloud project, you can reuse it.)
2. With that project selected, open https://console.cloud.google.com/apis/library/sheets.googleapis.com and click **Enable**.
3. Open https://console.cloud.google.com/iam-admin/serviceaccounts and click **Create service account**:
   - Service account name: `ntx-sheet-writer`
   - Service account ID: leave default
   - Click **Create and continue**, skip role assignment (we'll grant access at the sheet level), click **Done**.
4. Click into the newly created service account → **Keys** tab → **Add key** → **Create new key** → **JSON**. Download the file. **Treat this like a password — it grants edit access to whatever sheet you share with it.**
5. Open the file. Confirm it has `client_email` and `private_key`. Save it for Task 03.

## Sharing the sheet with the service account

After Task 02 (sheet creation):
1. Open the sheet in Google Sheets.
2. Click **Share** (top right).
3. Paste the `client_email` value from the JSON file (looks like `ntx-sheet-writer@ntx-player-tracker.iam.gserviceaccount.com`).
4. Set permission to **Editor**.
5. Uncheck "Notify people" and click **Share**.
