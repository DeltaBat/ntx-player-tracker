// google-apps-script/sheet-bootstrap.gs
// Run once from the Apps Script editor. Idempotent — safe to re-run.

var TABS = {
  'Today': [['Card rendering happens here. Don\'t edit by hand.']],
  'Trends': [['Trend charts (filled in a later plan).']],
  'Tryouts': [['Paste tracker.gg URL', 'Display Name', 'Platform', 'Rank 2s', 'MMR 2s', 'VAC bans', 'Account age', 'Public profile', 'Verdict']],
  'Sessions': [['Date', 'Player', 'Focus area', 'VOD link', 'Follow-up']],
  'Goals': [['Player', 'Playlist', 'Target', 'Deadline', 'Start value', 'Notes']],
  'Roster': [['playerId', 'displayName', 'trackerPlatform', 'trackerId', 'steamId', 'ballchasingName', 'active']],
  'Snapshots_Tracker': [['timestamp_utc', 'player_id', 'platform', 'playlist', 'rank', 'division', 'mmr', 'games_played_season', 'wins_season', 'win_streak', 'recent_matches_json']],
  'Snapshots_Steam': [['timestamp_utc', 'player_id', 'steam_id', 'profile_visibility', 'account_created', 'country', 'vac_ban_count', 'community_banned', 'watchlist_playtime_json']],
  'Snapshots_Ballchasing': [['timestamp_utc', 'player_id', 'replays_in_window', 'window_start', 'window_end', 'aggregate_stats_json', 'teammate_counts_json']],
  'Config': [['key', 'value', 'description'],
             ['tilt_losses_threshold', '4', 'In last 10 games, losses count for tilt'],
             ['tilt_mmr_threshold', '-40', 'MMR delta in last 10 games for tilt'],
             ['late_night_hour', '23', 'Local hour after which counts as late-night'],
             ['coverage_red_pct', '30', 'Ballchasing coverage % below this is red'],
             ['minutes_per_game', '6', 'Used to estimate hours from games delta'],
             ['session_stale_days', '21', 'Sessions older than this turn yellow on Today'],
             ['tracker_last_run_utc', '', 'Auto-set'],
             ['steam_last_run_utc', '', 'Auto-set'],
             ['ballchasing_last_run_utc', '', 'Auto-set']],
  'run_log': [['timestamp_utc', 'provider', 'player_id', 'status', 'duration_ms', 'error_summary']],
};

function bootstrap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      var rows = TABS[name];
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      sheet.setFrozenRows(1);
    }
  });
  // Delete the default "Sheet1" if it's still empty
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() <= 1 && sheet1.getLastColumn() <= 1) ss.deleteSheet(sheet1);
}
