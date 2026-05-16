// google-apps-script/assembler.gs
// Renders the Today tab as a styled dashboard with a KPI banner + one card per active roster player.
// Install a 5-minute time-driven trigger pointing at `assemble`.

var PLAYLIST_ORDER = ['1s', '2s', '3s'];
var WATCHLIST_LABELS = { 252950: 'RL', 824270: 'Kovaak', 714010: 'AimLab' };
var COL_WIDTHS = [90, 240, 90, 90, 110, 90];

var C = {
  bannerBg:       '#0b1729',
  bannerAccent:   '#3b82f6',
  bannerFg:       '#f9fafb',
  bannerSubFg:    '#7d92b8',
  kpiLabelFg:     '#7d92b8',
  kpiValueFg:     '#ffffff',
  kpiAccentFg:    '#34d399',
  colHeaderBg:    '#eef2f7',
  colHeaderFg:    '#475569',
  cardBg:         '#ffffff',
  cardBorder:     '#dbe2eb',
  cardHeaderBg:   '#0f1e36',
  cardHeaderFg:   '#ffffff',
  cardSubFg:      '#9bb0ce',
  dotActive:      '#22c55e',
  dotIdle:        '#eab308',
  dotMissing:     '#9ca3af',
  playlistBg:     '#f4f6fa',
  playlistFg:     '#475569',
  cellFg:         '#111827',
  cellMutedFg:    '#6b7280',
  deltaPos:       '#15803d',
  deltaNeg:       '#b91c1c',
  deltaNeutral:   '#94a3b8',
  steamBg:        '#fff8e6',
  steamFg:        '#704c11',
  steamSubFg:     '#a08147',
  vacWarnBg:      '#fee2e2',
  vacWarnFg:      '#991b1b',
  gamesLow:       '#fef2f2',
  gamesLowFg:     '#991b1b',
  gamesMid:       '#fefce8',
  gamesMidFg:     '#854d0e',
  gamesHigh:      '#ecfdf5',
  gamesHighFg:    '#065f46',
  pillFire:       '#dcfce7',
  pillFireFg:     '#14532d',
  pillCheck:      '#e0f2fe',
  pillCheckFg:    '#075985',
  pillSleep:      '#f1f5f9',
  pillSleepFg:    '#475569',
  pillWarn:       '#fee2e2',
  pillWarnFg:     '#7f1d1d',
  pillLock:       '#e5e7eb',
  pillLockFg:     '#374151'
};

function rankBg(rank) {
  if (!rank) return null;
  var r = String(rank);
  if (r.indexOf('Supersonic Legend') >= 0) return { bg: '#fef3c7', fg: '#78350f' };
  if (r.indexOf('Grand Champion III') >= 0) return { bg: '#fecaca', fg: '#7f1d1d' };
  if (r.indexOf('Grand Champion II') >= 0)  return { bg: '#fed7aa', fg: '#7c2d12' };
  if (r.indexOf('Grand Champion I') >= 0)   return { bg: '#fde68a', fg: '#78350f' };
  if (r.indexOf('Champion III') >= 0)       return { bg: '#e9d5ff', fg: '#581c87' };
  if (r.indexOf('Champion II') >= 0)        return { bg: '#ddd6fe', fg: '#3730a3' };
  if (r.indexOf('Champion I') >= 0)         return { bg: '#c7d2fe', fg: '#312e81' };
  if (r.indexOf('Diamond') >= 0)            return { bg: '#a5f3fc', fg: '#155e75' };
  if (r.indexOf('Platinum') >= 0)           return { bg: '#bbf7d0', fg: '#14532d' };
  if (r.indexOf('Gold') >= 0)               return { bg: '#fef9c3', fg: '#713f12' };
  if (r.indexOf('Silver') >= 0)             return { bg: '#e5e7eb', fg: '#374151' };
  if (r.indexOf('Bronze') >= 0)             return { bg: '#fde2cf', fg: '#7c2d12' };
  return null;
}

function statusPill(emoji) {
  if (emoji === '🔥') return { bg: C.pillFire, fg: C.pillFireFg };
  if (emoji === '✓')  return { bg: C.pillCheck, fg: C.pillCheckFg };
  if (emoji === '💤') return { bg: C.pillSleep, fg: C.pillSleepFg };
  if (emoji === '⚠')  return { bg: C.pillWarn, fg: C.pillWarnFg };
  if (emoji === '🔒') return { bg: C.pillLock, fg: C.pillLockFg };
  return { bg: '#ffffff', fg: '#111827' };
}

function gamesBucket(g) {
  if (g == null || isNaN(g)) return { bg: '#ffffff', fg: C.cellMutedFg };
  if (g >= 100) return { bg: C.gamesHigh, fg: C.gamesHighFg };
  if (g >= 20)  return { bg: C.gamesMid,  fg: C.gamesMidFg };
  if (g > 0)    return { bg: C.gamesLow,  fg: C.gamesLowFg };
  return { bg: '#ffffff', fg: C.cellMutedFg };
}

function assemble() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var snapshots  = ss.getSheetByName('Snapshots_Tracker');
  var steamSnaps = ss.getSheetByName('Snapshots_Steam');
  var roster     = ss.getSheetByName('Roster');
  var today      = ss.getSheetByName('Today');
  var config     = ss.getSheetByName('Config');
  if (!snapshots || !roster || !today || !config) return;

  var rosterRows = roster.getDataRange().getValues();
  var snapRows   = snapshots.getDataRange().getValues();
  if (snapRows.length < 2) return;
  var snapIdx   = headerMap(snapRows[0]);
  var rosterIdx = headerMap(rosterRows[0]);

  // Group tracker snapshots by (playerId|playlist), newest-first
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

  // Latest Steam per player
  var steamByPlayer = {};
  if (steamSnaps) {
    var steamRows = steamSnaps.getDataRange().getValues();
    if (steamRows.length >= 2) {
      var steamIdx = headerMap(steamRows[0]);
      var latestByPlayer = {};
      for (var s = 1; s < steamRows.length; s++) {
        var sr = steamRows[s];
        var pid = sr[steamIdx.player_id];
        var ts  = new Date(sr[steamIdx.timestamp_utc]).getTime();
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

  // --- Compute KPI roster summary ---
  var activePlayers = [];
  for (var ri = 1; ri < rosterRows.length; ri++) {
    var rrK = rosterRows[ri];
    if (String(rrK[rosterIdx.active]).toUpperCase() === 'TRUE') {
      activePlayers.push({ id: rrK[rosterIdx.playerId], name: rrK[rosterIdx.displayName] });
    }
  }
  var totalActive = activePlayers.length;
  var totalGames = 0; var mmrSum = 0; var mmrCount = 0; var grinding = 0;
  for (var p = 0; p < activePlayers.length; p++) {
    var pid = activePlayers[p].id;
    var playerHasGrindingSignal = false;
    for (var q = 0; q < PLAYLIST_ORDER.length; q++) {
      var pl = PLAYLIST_ORDER[q];
      var arr = grouped[pid + '|' + pl];
      if (arr && arr.length) {
        var latestSnap = arr[0];
        if (!isNaN(latestSnap.games)) totalGames += latestSnap.games;
        if (!isNaN(latestSnap.mmr))   { mmrSum += latestSnap.mmr; mmrCount++; }
        if ((latestSnap.winStreak || 0) >= 3) playerHasGrindingSignal = true;
      }
    }
    if (playerHasGrindingSignal) grinding++;
  }
  var avgMmr = mmrCount > 0 ? Math.round(mmrSum / mmrCount) : 0;

  // --- Reset sheet ---
  today.clear();
  today.clearFormats();
  today.clearConditionalFormatRules();
  for (var c = 0; c < COL_WIDTHS.length; c++) today.setColumnWidth(c + 1, COL_WIDTHS[c]);
  var maxC = COL_WIDTHS.length;

  // --- KPI banner (rows 1-3) ---
  today.getRange(1, 1, 1, maxC).merge().setValue('NTX PLAYER GRIND')
    .setBackground(C.bannerBg).setFontColor(C.bannerFg)
    .setFontWeight('bold').setFontSize(20).setFontFamily('Inter')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  today.setRowHeight(1, 48);

  // Row 2: KPI strip — 4 columns (each KPI spans 1-2 sheet cols)
  var refreshStr = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  // Layout: A=Active, B-C=Total games, D=Avg MMR, E-F=Last refresh
  today.getRange(2, 1, 1, maxC).setBackground(C.bannerBg);

  today.getRange(2, 1).setValue('ACTIVE\n' + totalActive)
    .setFontColor(C.kpiValueFg).setFontFamily('Inter')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true).setFontSize(12).setFontWeight('bold');

  today.getRange(2, 2, 1, 2).merge().setValue('SEASON GAMES\n' + totalGames)
    .setFontColor(C.kpiValueFg).setFontFamily('Inter')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true).setFontSize(12).setFontWeight('bold');

  today.getRange(2, 4).setValue('AVG MMR\n' + (mmrCount ? avgMmr : '—'))
    .setFontColor(C.kpiAccentFg).setFontFamily('Inter')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true).setFontSize(12).setFontWeight('bold');

  today.getRange(2, 5, 1, 2).merge().setValue('LAST REFRESH\n' + refreshStr)
    .setFontColor(C.bannerSubFg).setFontFamily('Inter')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true).setFontSize(10);
  today.setRowHeight(2, 56);

  today.getRange(3, 1, 1, maxC).setBackground(C.bannerAccent);
  today.setRowHeight(3, 3); // accent stripe

  // Spacer
  today.setRowHeight(4, 12);

  // --- Column headers (row 5) ---
  today.getRange(5, 1, 1, maxC).setValues([['PLAYLIST', 'RANK', 'MMR', 'Δ 24H', 'GAMES', 'STATUS']])
    .setBackground(C.colHeaderBg).setFontColor(C.colHeaderFg)
    .setFontWeight('bold').setFontSize(10).setFontFamily('Inter')
    .setVerticalAlignment('middle');
  today.getRange(5, 1).setHorizontalAlignment('center');
  today.getRange(5, 2).setHorizontalAlignment('left');
  today.getRange(5, 3, 1, 3).setHorizontalAlignment('right');
  today.getRange(5, 6).setHorizontalAlignment('center');
  today.setRowHeight(5, 28);

  today.setRowHeight(6, 6);

  // --- Per-player cards ---
  var rowCursor = 7;
  for (var ri2 = 1; ri2 < rosterRows.length; ri2++) {
    var rr = rosterRows[ri2];
    if (String(rr[rosterIdx.active]).toUpperCase() !== 'TRUE') continue;
    var playerId = rr[rosterIdx.playerId];
    var displayName = rr[rosterIdx.displayName];

    // Pre-compute card data for the subtitle
    var perPlaylist = [];
    var anyMatch = false;
    var maxGames7d = 0;
    var bestMmr = 0;
    var bestPlaylist = null;
    var bestRank = null;
    for (var pi = 0; pi < PLAYLIST_ORDER.length; pi++) {
      var pl = PLAYLIST_ORDER[pi];
      var data = grouped[playerId + '|' + pl] || [];
      var latest = data[0];
      perPlaylist.push({ pl: pl, latest: latest, data: data });
      if (latest) {
        anyMatch = true;
        if (!isNaN(latest.mmr) && latest.mmr > bestMmr) {
          bestMmr = latest.mmr;
          bestPlaylist = pl;
          bestRank = latest.rank + (latest.division ? ' ' + latest.division : '');
        }
        if (!isNaN(latest.games) && latest.games > maxGames7d) maxGames7d = latest.games;
      }
    }
    var steam = steamByPlayer[playerId];
    var twoWeekTotal = 0;
    if (steam) {
      for (var e1 = 0; e1 < steam.entries.length; e1++) twoWeekTotal += (steam.entries[e1].playtimeTwoWeeksMin || 0);
    }
    var twoWeekHoursStr = (twoWeekTotal / 60).toFixed(1) + 'h';
    var activityDot = '●';
    var dotColor = C.dotMissing;
    if (twoWeekTotal > 60) dotColor = C.dotActive;
    else if (anyMatch) dotColor = C.dotIdle;

    // --- Player banner (rows: name | subtitle) ---
    var subtitleParts = [];
    if (bestPlaylist && bestRank) subtitleParts.push(bestRank + ' · ' + bestPlaylist);
    if (steam) subtitleParts.push(twoWeekHoursStr + ' last 2w');
    if (steam && steam.vac > 0) subtitleParts.push('⚠ VAC×' + steam.vac);
    var subtitle = subtitleParts.length ? subtitleParts.join('  ·  ') : 'no data yet';

    // Player name banner row (rich text: colored dot + name).
    // Text layout: "  " + dot (1 char) + "  " + displayName  =>  total length = 5 + displayName.length
    var headerText = '  ' + activityDot + '  ' + displayName;
    var headerRichText = SpreadsheetApp.newRichTextValue()
      .setText(headerText)
      .setTextStyle(2, 3,
        SpreadsheetApp.newTextStyle().setForegroundColor(dotColor).setFontSize(20).setBold(true).build())
      .setTextStyle(5, headerText.length,
        SpreadsheetApp.newTextStyle().setForegroundColor(C.cardHeaderFg).setFontSize(16).setBold(true).build())
      .build();
    today.getRange(rowCursor, 1, 1, maxC).merge()
      .setRichTextValue(headerRichText)
      .setBackground(C.cardHeaderBg)
      .setHorizontalAlignment('left').setVerticalAlignment('middle')
      .setFontFamily('Inter');
    today.setRowHeight(rowCursor, 38);
    rowCursor++;

    // Subtitle row
    today.getRange(rowCursor, 1, 1, maxC).merge()
      .setValue('   ' + subtitle)
      .setBackground(C.cardHeaderBg).setFontColor(C.cardSubFg)
      .setFontSize(11).setFontFamily('Inter').setFontStyle('italic')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');
    today.setRowHeight(rowCursor, 22);
    rowCursor++;

    var cardStartRow = rowCursor;

    // --- Playlist rows ---
    for (var pi2 = 0; pi2 < perPlaylist.length; pi2++) {
      var info = perPlaylist[pi2];
      var pl2 = info.pl;
      var latest2 = info.latest;
      var data2 = info.data;
      var rankText, mmrText, deltaText, deltaNum, gamesText, gamesNum, emoji;
      if (!latest2) {
        rankText = '—'; mmrText = '—'; deltaText = '—'; deltaNum = null;
        gamesText = '—'; gamesNum = null; emoji = '—';
      } else {
        var prior24h = findSnapshotBefore(data2, latest2.ts.getTime() - 24 * 3600 * 1000);
        var delta24 = (prior24h && !isNaN(prior24h.mmr)) ? (latest2.mmr - prior24h.mmr) : null;
        deltaNum = delta24;
        rankText = latest2.rank + (latest2.division ? ' ' + latest2.division : '');
        mmrText = isNaN(latest2.mmr) ? '—' : String(latest2.mmr);
        deltaText = formatDelta(delta24);
        gamesText = (latest2.games || 0) + ' games';
        gamesNum = latest2.games || 0;
        emoji = statusEmoji(latest2, delta24);
      }

      today.getRange(rowCursor, 1, 1, maxC)
        .setValues([[pl2, rankText, mmrText, deltaText, gamesText, emoji]])
        .setBackground(C.cardBg).setFontColor(C.cellFg).setFontFamily('Inter')
        .setVerticalAlignment('middle');

      today.getRange(rowCursor, 1)
        .setBackground(C.playlistBg).setFontColor(C.playlistFg)
        .setFontWeight('bold').setFontSize(11)
        .setHorizontalAlignment('center');

      var rb = latest2 ? rankBg(latest2.rank) : null;
      var rankCell = today.getRange(rowCursor, 2);
      if (rb) rankCell.setBackground(rb.bg).setFontColor(rb.fg).setFontWeight('bold');
      rankCell.setHorizontalAlignment('left').setFontSize(11);

      today.getRange(rowCursor, 3)
        .setFontFamily('Roboto Mono').setFontWeight('bold').setFontSize(13)
        .setHorizontalAlignment('right');

      var deltaCell = today.getRange(rowCursor, 4);
      deltaCell.setFontWeight('bold').setHorizontalAlignment('right').setFontSize(11);
      if (deltaNum === null || isNaN(deltaNum)) deltaCell.setFontColor(C.deltaNeutral);
      else if (deltaNum > 0) deltaCell.setFontColor(C.deltaPos);
      else if (deltaNum < 0) deltaCell.setFontColor(C.deltaNeg);
      else deltaCell.setFontColor(C.deltaNeutral);

      var gamesCell = today.getRange(rowCursor, 5);
      var gb = gamesBucket(gamesNum);
      gamesCell.setBackground(gb.bg).setFontColor(gb.fg).setFontWeight('bold').setFontSize(11)
        .setHorizontalAlignment('right');

      var sp = statusPill(emoji);
      today.getRange(rowCursor, 6).setBackground(sp.bg).setFontColor(sp.fg)
        .setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');

      today.setRowHeight(rowCursor, 30);
      rowCursor++;
    }

    // --- Steam row ---
    if (steam) {
      var marker = (steam.visibility === 'private' || steam.visibility === 'unknown') ? '🔒' : '✓';
      var hoursParts = [];
      for (var e2 = 0; e2 < steam.entries.length; e2++) {
        var entry = steam.entries[e2];
        var label = WATCHLIST_LABELS[entry.appId] || String(entry.appId);
        var hoursForever = Math.round(entry.playtimeForeverMin / 60);
        hoursParts.push(label + ' ' + hoursForever + 'h');
      }
      var banText = steam.vac > 0 ? ('VAC×' + steam.vac) : '';

      today.getRange(rowCursor, 1, 1, maxC)
        .setValues([['STEAM', hoursParts.join('  ·  '), '2w', twoWeekHoursStr, banText, marker]])
        .setBackground(C.steamBg).setFontColor(C.steamFg)
        .setFontSize(11).setFontFamily('Inter').setVerticalAlignment('middle');
      today.getRange(rowCursor, 1)
        .setFontWeight('bold').setHorizontalAlignment('center');
      today.getRange(rowCursor, 2).setHorizontalAlignment('left');
      today.getRange(rowCursor, 3)
        .setFontColor(C.steamSubFg).setHorizontalAlignment('right').setFontSize(10);
      today.getRange(rowCursor, 4)
        .setFontWeight('bold').setHorizontalAlignment('right')
        .setFontFamily('Roboto Mono').setFontSize(12);
      var banCell = today.getRange(rowCursor, 5);
      if (banText) banCell.setBackground(C.vacWarnBg).setFontColor(C.vacWarnFg).setFontWeight('bold');
      banCell.setHorizontalAlignment('center').setFontSize(10);
      var spS = statusPill(marker);
      today.getRange(rowCursor, 6).setBackground(spS.bg).setFontColor(spS.fg)
        .setFontSize(16).setHorizontalAlignment('center');
      today.setRowHeight(rowCursor, 28);
    } else {
      today.getRange(rowCursor, 1, 1, maxC)
        .setValues([['STEAM', 'no Steam data yet', '', '', '', '—']])
        .setBackground(C.steamBg).setFontColor(C.steamSubFg)
        .setFontSize(10).setFontStyle('italic').setFontFamily('Inter');
      today.getRange(rowCursor, 1).setFontWeight('bold').setFontStyle('normal').setHorizontalAlignment('center');
      today.getRange(rowCursor, 6).setFontSize(14).setFontStyle('normal').setHorizontalAlignment('center');
      today.setRowHeight(rowCursor, 28);
    }
    rowCursor++;

    // --- Card border (drawn around playlists + steam rows) ---
    today.getRange(cardStartRow, 1, rowCursor - cardStartRow, maxC)
      .setBorder(true, true, true, true, false, false, C.cardBorder, SpreadsheetApp.BorderStyle.SOLID);

    // Spacer between cards
    today.setRowHeight(rowCursor, 14);
    rowCursor++;
  }

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
