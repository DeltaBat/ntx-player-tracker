// google-apps-script/assembler.gs
// Reads latest Snapshots_Tracker rows and renders one card block per player onto Today.
// Install a 5-minute time-driven trigger pointing at `assemble`.

var PLAYLIST_ORDER = ['1s', '2s', '3s'];

function assemble() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var snapshots = ss.getSheetByName('Snapshots_Tracker');
  var roster = ss.getSheetByName('Roster');
  var today = ss.getSheetByName('Today');
  var config = ss.getSheetByName('Config');
  if (!snapshots || !roster || !today || !config) return;

  var rosterRows = roster.getDataRange().getValues();
  var snapRows = snapshots.getDataRange().getValues();
  if (snapRows.length < 2) return;

  var rosterHeader = rosterRows[0];
  var snapHeader = snapRows[0];

  var rosterIdx = headerMap(rosterHeader);
  var snapIdx = headerMap(snapHeader);

  // Group snapshots by (playerId, playlist), keep the two most recent (latest + ≥24h prior)
  var grouped = {};
  for (var i = 1; i < snapRows.length; i++) {
    var r = snapRows[i];
    var key = r[snapIdx.player_id] + '|' + r[snapIdx.playlist];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      ts: new Date(r[snapIdx.timestamp_utc]),
      rank: r[snapIdx.rank],
      division: r[snapIdx.division],
      mmr: Number(r[snapIdx.mmr]),
      games: Number(r[snapIdx.games_played_season]),
      wins: Number(r[snapIdx.wins_season]),
      winStreak: Number(r[snapIdx.win_streak]),
      matchesJson: r[snapIdx.recent_matches_json],
    });
  }
  Object.keys(grouped).forEach(function (k) {
    grouped[k].sort(function (a, b) { return b.ts.getTime() - a.ts.getTime(); });
  });

  today.clearContents();
  today.getRange(1, 1).setValue('NTX Player Grind · last refresh ' + new Date().toISOString());

  var row = 3;
  for (var ri = 1; ri < rosterRows.length; ri++) {
    var rr = rosterRows[ri];
    if (String(rr[rosterIdx.active]).toUpperCase() !== 'TRUE') continue;
    var playerId = rr[rosterIdx.playerId];
    var displayName = rr[rosterIdx.displayName];

    var card = [['Player', displayName, '', '', '', '']];
    for (var pi = 0; pi < PLAYLIST_ORDER.length; pi++) {
      var pl = PLAYLIST_ORDER[pi];
      var data = grouped[playerId + '|' + pl] || [];
      var latest = data[0];
      if (!latest) {
        card.push([pl, '—', '—', '—', '—', '—']);
        continue;
      }
      var prior24h = findSnapshotBefore(data, latest.ts.getTime() - 24 * 3600 * 1000);
      var delta24 = (prior24h && !isNaN(prior24h.mmr)) ? (latest.mmr - prior24h.mmr) : null;
      var rankCell = latest.rank + (latest.division ? ' ' + latest.division : '');
      card.push([pl, rankCell, latest.mmr, formatDelta(delta24), latest.games || 0, statusEmoji(latest, delta24)]);
    }
    today.getRange(row, 1, card.length, 6).setValues(card);
    row += card.length + 1;
  }

  setConfig(config, 'tracker_last_run_utc', new Date().toISOString());
}

function headerMap(header) {
  var out = {};
  for (var i = 0; i < header.length; i++) out[header[i]] = i;
  return out;
}

function findSnapshotBefore(sorted, beforeMs) {
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].ts.getTime() <= beforeMs) return sorted[i];
  }
  return null;
}

function formatDelta(d) {
  if (d === null || isNaN(d)) return '—';
  if (d > 0) return '+' + d;
  return String(d);
}

function statusEmoji(latest, delta24) {
  var streak = latest.winStreak || 0;
  if (streak >= 3) return '🔥';
  if (delta24 !== null && delta24 <= -40) return '⚠';
  if (delta24 === null) return '💤';
  return '✓';
}

function setConfig(config, key, value) {
  var rows = config.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      config.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
}
