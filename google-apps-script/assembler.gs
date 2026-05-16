// google-apps-script/assembler.gs
// Renders the Today tab as a styled dashboard with one card per active roster player.
// Install a 5-minute time-driven trigger pointing at `assemble`.

var PLAYLIST_ORDER = ['1s', '2s', '3s'];
var WATCHLIST_LABELS = { 252950: 'RL', 824270: 'Kovaak', 714010: 'AimLab' };

var COL_WIDTHS = [90, 230, 90, 90, 100, 70];

var C = {
  bannerBg:      '#0d1d33',
  bannerFg:      '#ffffff',
  bannerSubFg:   '#9bb0ce',
  colHeaderBg:   '#e8eef7',
  colHeaderFg:   '#5a6b85',
  cardHeaderBg:  '#1a2332',
  cardHeaderFg:  '#ffffff',
  playlistBg:    '#f5f7fb',
  playlistFg:    '#5a6b85',
  cellFg:        '#1f2937',
  cellMutedFg:   '#6b7280',
  deltaPos:      '#16a34a',
  deltaNeg:      '#dc2626',
  deltaNeutral:  '#9ca3af',
  steamBg:       '#fff7e6',
  steamFg:       '#7a5a1b',
  steamSubFg:    '#a08147',
  vacWarnBg:     '#fee2e2',
  vacWarnFg:     '#b91c1c',
  separatorBg:   '#ffffff'
};

function rankBg(rank) {
  if (!rank) return null;
  var r = String(rank);
  if (r.indexOf('Supersonic Legend') >= 0) return '#ffd54f';
  if (r.indexOf('Grand Champion III') >= 0) return '#ef9a9a';
  if (r.indexOf('Grand Champion II') >= 0) return '#ffab91';
  if (r.indexOf('Grand Champion I') >= 0) return '#ffcc80';
  if (r.indexOf('Champion III') >= 0) return '#ce93d8';
  if (r.indexOf('Champion II') >= 0) return '#b39ddb';
  if (r.indexOf('Champion I') >= 0) return '#9fa8da';
  if (r.indexOf('Diamond') >= 0) return '#80deea';
  if (r.indexOf('Platinum') >= 0) return '#a5d6a7';
  if (r.indexOf('Gold') >= 0) return '#fff59d';
  if (r.indexOf('Silver') >= 0) return '#e0e0e0';
  if (r.indexOf('Bronze') >= 0) return '#d7ccc8';
  return null;
}

function assemble() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var snapshots = ss.getSheetByName('Snapshots_Tracker');
  var steamSnaps = ss.getSheetByName('Snapshots_Steam');
  var roster = ss.getSheetByName('Roster');
  var today = ss.getSheetByName('Today');
  var config = ss.getSheetByName('Config');
  if (!snapshots || !roster || !today || !config) return;

  var rosterRows = roster.getDataRange().getValues();
  var snapRows = snapshots.getDataRange().getValues();
  if (snapRows.length < 2) return;
  var snapIdx = headerMap(snapRows[0]);
  var rosterIdx = headerMap(rosterRows[0]);

  // Group tracker snapshots by (playerId, playlist), sorted newest-first
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
      winStreak: Number(r[snapIdx.win_streak])
    });
  }
  Object.keys(grouped).forEach(function (k) {
    grouped[k].sort(function (a, b) { return b.ts.getTime() - a.ts.getTime(); });
  });

  // Latest Steam snapshot per playerId
  var steamByPlayer = {};
  if (steamSnaps) {
    var steamRows = steamSnaps.getDataRange().getValues();
    if (steamRows.length >= 2) {
      var steamIdx = headerMap(steamRows[0]);
      var latestByPlayer = {};
      for (var s = 1; s < steamRows.length; s++) {
        var sr = steamRows[s];
        var pid = sr[steamIdx.player_id];
        var ts = new Date(sr[steamIdx.timestamp_utc]).getTime();
        if (!latestByPlayer[pid] || latestByPlayer[pid].ts < ts) {
          latestByPlayer[pid] = {
            ts: ts,
            visibility: sr[steamIdx.profile_visibility],
            vac: Number(sr[steamIdx.vac_ban_count]),
            watchlistJson: sr[steamIdx.watchlist_playtime_json]
          };
        }
      }
      Object.keys(latestByPlayer).forEach(function (pid) {
        var v = latestByPlayer[pid];
        var entries = [];
        try { entries = JSON.parse(v.watchlistJson) || []; } catch (e) { entries = []; }
        steamByPlayer[pid] = { visibility: v.visibility, vac: v.vac, entries: entries };
      });
    }
  }

  // Clear everything (contents + formatting + merges + conditional rules)
  today.clear();
  today.clearFormats();
  today.clearConditionalFormatRules();
  var maxC = COL_WIDTHS.length;
  for (var c = 0; c < maxC; c++) today.setColumnWidth(c + 1, COL_WIDTHS[c]);

  // --- Banner ---
  today.getRange(1, 1, 1, maxC).merge().setValue('NTX PLAYER GRIND')
    .setBackground(C.bannerBg).setFontColor(C.bannerFg)
    .setFontWeight('bold').setFontSize(18)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  today.setRowHeight(1, 44);

  today.getRange(2, 1, 1, maxC).merge()
    .setValue('Last refresh ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC')
    .setBackground(C.bannerBg).setFontColor(C.bannerSubFg)
    .setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  today.setRowHeight(2, 22);

  // Spacer
  today.setRowHeight(3, 10);

  // --- Column headers ---
  today.getRange(4, 1, 1, maxC).setValues([['PLAYLIST', 'RANK', 'MMR', 'Δ 24H', 'GAMES', 'STATUS']])
    .setBackground(C.colHeaderBg).setFontColor(C.colHeaderFg)
    .setFontWeight('bold').setFontSize(10)
    .setVerticalAlignment('middle');
  today.getRange(4, 1).setHorizontalAlignment('center');
  today.getRange(4, 2).setHorizontalAlignment('left');
  today.getRange(4, 3, 1, 3).setHorizontalAlignment('right');
  today.getRange(4, 6).setHorizontalAlignment('center');
  today.setRowHeight(4, 28);

  today.setRowHeight(5, 8);

  // --- One card per active player ---
  var rowCursor = 6;
  for (var ri = 1; ri < rosterRows.length; ri++) {
    var rr = rosterRows[ri];
    if (String(rr[rosterIdx.active]).toUpperCase() !== 'TRUE') continue;
    var playerId = rr[rosterIdx.playerId];
    var displayName = rr[rosterIdx.displayName];

    // Player name banner
    today.getRange(rowCursor, 1, 1, maxC).merge()
      .setValue('  ' + displayName)
      .setBackground(C.cardHeaderBg).setFontColor(C.cardHeaderFg)
      .setFontWeight('bold').setFontSize(14)
      .setHorizontalAlignment('left').setVerticalAlignment('middle');
    today.setRowHeight(rowCursor, 32);
    rowCursor++;

    // Playlist rows
    for (var pi = 0; pi < PLAYLIST_ORDER.length; pi++) {
      var pl = PLAYLIST_ORDER[pi];
      var data = grouped[playerId + '|' + pl] || [];
      var latest = data[0];
      var rankText, mmrText, deltaText, deltaNum, gamesText, emoji;
      if (!latest) {
        rankText = '—'; mmrText = '—'; deltaText = '—'; deltaNum = null;
        gamesText = '—'; emoji = '—';
      } else {
        var prior24h = findSnapshotBefore(data, latest.ts.getTime() - 24 * 3600 * 1000);
        var delta24 = (prior24h && !isNaN(prior24h.mmr)) ? (latest.mmr - prior24h.mmr) : null;
        deltaNum = delta24;
        rankText = latest.rank + (latest.division ? ' ' + latest.division : '');
        mmrText = isNaN(latest.mmr) ? '—' : String(latest.mmr);
        deltaText = formatDelta(delta24);
        gamesText = (latest.games || 0) + ' games';
        emoji = statusEmoji(latest, delta24);
      }

      today.getRange(rowCursor, 1, 1, maxC)
        .setValues([[pl, rankText, mmrText, deltaText, gamesText, emoji]])
        .setVerticalAlignment('middle')
        .setFontColor(C.cellFg);

      today.getRange(rowCursor, 1)
        .setBackground(C.playlistBg).setFontColor(C.playlistFg)
        .setFontWeight('bold').setFontSize(11)
        .setHorizontalAlignment('center');

      var rb = latest ? rankBg(latest.rank) : null;
      if (rb) today.getRange(rowCursor, 2).setBackground(rb).setFontWeight('bold');
      today.getRange(rowCursor, 2).setHorizontalAlignment('left');

      today.getRange(rowCursor, 3)
        .setFontFamily('Roboto Mono').setFontWeight('bold').setFontSize(12)
        .setHorizontalAlignment('right');

      var deltaCell = today.getRange(rowCursor, 4);
      deltaCell.setFontWeight('bold').setHorizontalAlignment('right');
      if (deltaNum === null || isNaN(deltaNum)) deltaCell.setFontColor(C.deltaNeutral);
      else if (deltaNum > 0) deltaCell.setFontColor(C.deltaPos);
      else if (deltaNum <= -40) deltaCell.setFontColor(C.deltaNeg);
      else if (deltaNum < 0) deltaCell.setFontColor(C.deltaNeg);
      else deltaCell.setFontColor(C.deltaNeutral);

      today.getRange(rowCursor, 5)
        .setFontColor(C.cellMutedFg).setHorizontalAlignment('right');

      today.getRange(rowCursor, 6)
        .setFontSize(16).setHorizontalAlignment('center');

      today.setRowHeight(rowCursor, 28);
      rowCursor++;
    }

    // Steam row
    var steam = steamByPlayer[playerId];
    if (steam) {
      var marker = (steam.visibility === 'private' || steam.visibility === 'unknown') ? '🔒' : '✓';
      var hoursParts = [];
      var twoWeekTotal = 0;
      for (var e = 0; e < steam.entries.length; e++) {
        var entry = steam.entries[e];
        var label = WATCHLIST_LABELS[entry.appId] || String(entry.appId);
        var hoursForever = Math.round(entry.playtimeForeverMin / 60);
        hoursParts.push(label + ' ' + hoursForever + 'h');
        twoWeekTotal += (entry.playtimeTwoWeeksMin || 0);
      }
      var twoWeekHours = (twoWeekTotal / 60).toFixed(1);
      var banText = steam.vac > 0 ? ('⚠ VAC×' + steam.vac) : '';

      today.getRange(rowCursor, 1, 1, maxC)
        .setValues([['STEAM', hoursParts.join(' · '), '2w', twoWeekHours + 'h', banText, marker]])
        .setBackground(C.steamBg).setFontColor(C.steamFg)
        .setFontSize(11).setVerticalAlignment('middle');
      today.getRange(rowCursor, 1)
        .setFontWeight('bold').setHorizontalAlignment('center');
      today.getRange(rowCursor, 2).setHorizontalAlignment('left');
      today.getRange(rowCursor, 3)
        .setFontColor(C.steamSubFg).setHorizontalAlignment('right').setFontSize(10);
      today.getRange(rowCursor, 4)
        .setFontWeight('bold').setHorizontalAlignment('right');
      var banCell = today.getRange(rowCursor, 5);
      if (banText) banCell.setBackground(C.vacWarnBg).setFontColor(C.vacWarnFg).setFontWeight('bold');
      banCell.setHorizontalAlignment('center');
      today.getRange(rowCursor, 6).setFontSize(16).setHorizontalAlignment('center');
      today.setRowHeight(rowCursor, 26);
    } else {
      today.getRange(rowCursor, 1, 1, maxC)
        .setValues([['STEAM', 'no Steam data yet', '', '', '', '—']])
        .setBackground(C.steamBg).setFontColor(C.steamSubFg)
        .setFontSize(10).setFontStyle('italic');
      today.getRange(rowCursor, 1).setFontWeight('bold').setFontStyle('normal').setHorizontalAlignment('center');
      today.getRange(rowCursor, 6).setFontSize(14).setFontStyle('normal').setHorizontalAlignment('center');
      today.setRowHeight(rowCursor, 26);
    }
    rowCursor++;

    // Spacer between cards
    today.setRowHeight(rowCursor, 14);
    rowCursor++;
  }

  // Hide gridlines for cleaner look
  today.setHiddenGridlines(true);

  setConfig(config, 'tracker_last_run_utc', new Date().toISOString());
  setConfig(config, 'steam_last_run_utc', new Date().toISOString());
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
