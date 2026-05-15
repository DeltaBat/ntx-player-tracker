# 04 · Deploy the Apps Script assembler

1. Open the sheet → **Extensions → Apps Script** (same editor as the bootstrap).
2. Click the **+** next to Files → **Script**. Name it `assembler`.
3. Paste the contents of `google-apps-script/assembler.gs`. Save.
4. In the left sidebar, click **Triggers** (clock icon).
5. Click **Add Trigger**:
   - Function: `assemble`
   - Event source: `Time-driven`
   - Type: `Minutes timer`
   - Interval: `Every 5 minutes`
6. Save. Authorize when prompted.

The trigger fires every 5 minutes from now on. To run it once immediately, return to the script editor, select `assemble` from the dropdown, click **Run**.

## Sanity check

After at least one tracker workflow run has succeeded (check the GitHub Actions tab):

- Open the sheet → `Today` tab. You should see one block per active roster player with 1s/2s/3s rows.
- If a player block shows all `—`, either they haven't been scraped yet or their tracker.gg URL was wrong.
- Open `run_log` to see per-player status from the most recent scrape.
