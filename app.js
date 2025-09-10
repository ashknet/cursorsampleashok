/* global $, window, document */
(function () {
  'use strict';

  // ---------- Data loading ----------
  const DATA_SOURCES = {
    kpis: './kpi.json',
    dashboards: './dashboard.json',
    reports: './report.json'
  };

  const appState = {
    section: 'kpis',
    categories: [],
    raw: { kpis: null, dashboards: null, reports: null },
    breadcrumb: []
  };

  function fetchJson(key) {
    // Try normal fetch first; file:// may block due to CORS, handled by local loader
    return $.getJSON(DATA_SOURCES[key]);
  }

  function resolveTopFolder(json) {
    // Navigate to first entry in SubFolders which holds the category folders
    if (!json || !json.SubFolders || json.SubFolders.length === 0) return null;
    return json.SubFolders[0];
  }

  function flattenCategories(folder) {
    if (!folder || !Array.isArray(folder.SubFolders)) return [];
    return folder.SubFolders.map(f => ({ name: f.Name, node: f }));
  }

  function extractAllReports(folder) {
    const items = [];
    if (!folder) return items;
    if (Array.isArray(folder.Reports)) {
      folder.Reports.forEach(r => items.push({ type: 'report', name: r.Name, url: r.URL, node: r }));
    }
    if (Array.isArray(folder.SubFolders)) {
      folder.SubFolders.forEach(sf => {
        items.push({ type: 'folder', name: sf.Name, node: sf });
      });
    }
    return items;
  }

  // ---------- UI helpers ----------
  function setSection(section) {
    appState.section = section;
    $('.nav-pill').removeClass('is-active').attr('aria-selected', 'false');
    $(`.nav-pill[data-section="${section}"]`).addClass('is-active').attr('aria-selected', 'true');
    $('.panel').removeClass('is-visible');
    $(`.panel[data-panel="${section}"]`).addClass('is-visible');
    $('#section-title').text(section.charAt(0).toUpperCase() + section.slice(1));
    renderCategories();
    if (section === 'kpis') renderKpisHome();
    if (section === 'dashboards') renderDashboardsHome();
    if (section === 'reports') renderReportsHome();
  }

  function renderCategories() {
    const container = $('#category-scroller');
    container.empty();

    let list = [];
    if (appState.section === 'kpis') list = flattenCategories(resolveTopFolder(appState.raw.kpis));
    if (appState.section === 'dashboards') list = flattenCategories(resolveTopFolder(appState.raw.dashboards));
    if (appState.section === 'reports') list = flattenCategories(resolveTopFolder(appState.raw.reports));

    appState.categories = list;
    list.forEach((c, idx) => {
      const pill = $('<button/>', { class: 'category-chip' + (idx === 0 ? ' is-active' : ''), text: c.name });
      pill.on('click', () => {
        $('.category-chip').removeClass('is-active');
        pill.addClass('is-active');
        if (appState.section === 'kpis') showKpiCategory(c.node);
        if (appState.section === 'dashboards') showDashboardCategory(c.node);
        if (appState.section === 'reports') openReportsFolder(c.node, true);
      });
      container.append(pill);
    });
  }

  function skeleton(targetSelector, height) {
    const el = $(targetSelector);
    el.html(`<div class="skeleton" style="width:100%; height:${height}px; border-radius:12px;"></div>`);
  }

  function setBreadcrumb(parts) {
    appState.breadcrumb = parts || [];
    const nav = $('#breadcrumb').empty();
    appState.breadcrumb.forEach((p, idx) => {
      const isLast = idx === appState.breadcrumb.length - 1;
      const span = $('<span/>', { class: 'crumb' + (isLast ? '' : ' is-link'), text: p.label });
      if (!isLast) span.on('click', p.onClick);
      nav.append(span);
      if (!isLast) nav.append($('<span/>', { text: '›', class: 'crumb' }));
    });
  }

  // ---------- KPIs ----------
  function renderKpisHome() {
    const folder = resolveTopFolder(appState.raw.kpis);
    const firstCategory = folder && folder.SubFolders && folder.SubFolders[0];
    if (firstCategory) showKpiCategory(firstCategory);
  }

  function showKpiCategory(categoryNode) {
    setBreadcrumb([{ label: 'KPIs', onClick: () => setSection('kpis') }, { label: categoryNode.Name }]);
    const tabs = $('#kpi-tabs').empty();
    const viewer = $('#kpi-viewer');
    const allReports = [];
    // Include direct reports under the category as tabs
    if (Array.isArray(categoryNode.Reports)) allReports.push(...categoryNode.Reports);
    // Include reports inside immediate subfolders as additional tabs (flatten one level)
    if (Array.isArray(categoryNode.SubFolders)) {
      categoryNode.SubFolders.forEach(sf => {
        if (Array.isArray(sf.Reports) && sf.Reports.length) {
          sf.Reports.forEach(r => allReports.push(r));
        }
      });
    }
    tabs.toggle(allReports.length > 1);
    if (allReports.length === 0) {
      viewer.html('<div class="muted">No KPI reports in this category.</div>');
      return;
    }
    allReports.forEach((r, idx) => {
      const tab = $('<button/>', { class: 'tab' + (idx === 0 ? ' is-active' : ''), text: r.Name, role: 'tab' });
      tab.on('click', () => {
        $('.tab').removeClass('is-active');
        tab.addClass('is-active');
        openViewer('#kpi-viewer', r.URL);
      });
      tabs.append(tab);
    });
    openViewer('#kpi-viewer', allReports[0].URL);
  }

  // ---------- Dashboards ----------
  function renderDashboardsHome() {
    const folder = resolveTopFolder(appState.raw.dashboards);
    const first = folder && folder.SubFolders && folder.SubFolders[0];
    if (first) showDashboardCategory(first);
  }

  function showDashboardCategory(categoryNode) {
    setBreadcrumb([{ label: 'Dashboards', onClick: () => setSection('dashboards') }, { label: categoryNode.Name }]);
    $('#dash-detail').addClass('hidden');
    $('#dash-viewer').empty();
    const grid = $('#dash-grid').empty();
    const children = extractAllReports(categoryNode);
    children.forEach(item => {
      if (item.type === 'folder') {
        grid.append(makeFolderCard(item.node, () => openDashboardFolder(item.node)));
      } else {
        grid.append(makeReportCard(item.node, () => openViewer('#dash-viewer', item.node.URL)));
      }
    });
  }

  function openDashboardFolder(folderNode) {
    $('#dash-detail').removeClass('hidden');
    $('#dash-grid').empty();
    $('#dash-detail-title').text(folderNode.Name);
    const grid = $('#dash-detail-grid').empty();
    const children = extractAllReports(folderNode);
    children.forEach(item => {
      if (item.type === 'folder') {
        grid.append(makeFolderCard(item.node, () => openDashboardFolder(item.node)));
      } else {
        grid.append(makeReportCard(item.node, () => openViewer('#dash-viewer', item.node.URL)));
      }
    });
  }

  // ---------- Reports Explorer ----------
  function renderReportsHome() {
    const folder = resolveTopFolder(appState.raw.reports);
    if (folder) openReportsFolder(folder, true);
  }

  function openReportsFolder(folderNode, resetCrumb) {
    if (resetCrumb) setBreadcrumb([{ label: 'Reports', onClick: () => setSection('reports') }, { label: folderNode.Name }]);
    const grid = $('#reports-grid').empty();
    $('#reports-viewer').empty();
    const children = extractAllReports(folderNode);
    children.forEach(item => {
      if (item.type === 'folder') {
        grid.append(makeFolderCard(item.node, () => openReportsFolder(item.node, false)));
      } else {
        grid.append(makeReportCard(item.node, () => openViewer('#reports-viewer', item.node.URL)));
      }
    });
  }

  // ---------- Common components ----------
  function makeFolderCard(folderNode, onView) {
    const tpl = $($('#tmpl-folder-card').html());
    tpl.find('.card-title').text(folderNode.Name);
    const meta = [];
    if (folderNode.SubFolders && folderNode.SubFolders.length) meta.push(`${folderNode.SubFolders.length} subfolder${folderNode.SubFolders.length>1?'s':''}`);
    if (folderNode.Reports && folderNode.Reports.length) meta.push(`${folderNode.Reports.length} report${folderNode.Reports.length>1?'s':''}`);
    tpl.find('.card-meta').text(meta.join(' · '));
    tpl.find('.view-btn').on('click', onView);
    return tpl;
  }

  function makeReportCard(reportNode, onOpen) {
    const tpl = $($('#tmpl-report-card').html());
    tpl.find('.card-title').text(reportNode.Name);
    tpl.find('.card-meta').text(reportNode.Description || reportNode.Type || '');
    tpl.find('.open-btn').on('click', onOpen);
    return tpl;
  }

  function openViewer(selector, url) {
    if (!url) return;
    skeleton(selector, 420);
    const iframe = $('<iframe/>', { src: url, allow: 'fullscreen', title: 'Report Viewer' });
    // Replace after small delay to allow skeleton shimmer
    setTimeout(() => $(selector).empty().append(iframe), 200);
  }

  // ---------- Search ----------
  function attachSearch() {
    $('#global-search').on('input', function () {
      const q = $(this).val().toString().toLowerCase().trim();
      if (!q) return; // Keep current view; deep search is heavy for huge JSON
      // Quick search across currently visible grid
      const grid = $('.panel.is-visible .card-grid, .panel.is-visible .explorer-grid');
      grid.find('.card').each(function () {
        const text = $(this).find('.card-title').text().toLowerCase();
        $(this).toggle(text.includes(q));
      });
    });

    $('#reports-search').on('input', function () {
      const q = $(this).val().toString().toLowerCase().trim();
      const grid = $('#reports-grid');
      grid.find('.card').each(function () {
        const text = $(this).find('.card-title').text().toLowerCase();
        const meta = $(this).find('.card-meta').text().toLowerCase();
        $(this).toggle(text.includes(q) || meta.includes(q));
      });
    });
  }

  // ---------- Theme ----------
  function attachThemeToggle() {
    const key = 'ihub_theme';
    const saved = localStorage.getItem(key);
    if (saved === 'light') document.body.classList.add('light');
    $('#theme-toggle').on('click', function () {
      document.body.classList.toggle('light');
      localStorage.setItem(key, document.body.classList.contains('light') ? 'light' : 'dark');
    });
  }

  // ---------- Boot ----------
  function boot() {
    attachThemeToggle();
    attachSearch();
    $('.nav-pill').on('click', function () { setSection($(this).data('section')); });

    // Load all JSON sources in parallel; on failure show local overlay to pick files
    $.when(fetchJson('kpis'), fetchJson('dashboards'), fetchJson('reports')).done((k, d, r) => {
      appState.raw.kpis = k[0];
      appState.raw.dashboards = d[0];
      appState.raw.reports = r[0];
      setSection('kpis');
    }).fail(() => {
      enableLocalLoader();
      toggleOverlay(true);
      $('#context-info').text('Open local JSON via the upload button to start.');
    });

    // Dashboard back
    $('#dash-back').on('click', () => {
      $('#dash-detail').addClass('hidden');
      renderDashboardsHome();
    });

    // Expose a small API for local loading
    window.IHub = window.IHub || {};
    window.IHub.loadLocal = function (payload) {
      if (!payload) return;
      appState.raw.kpis = payload.kpis;
      appState.raw.dashboards = payload.dashboards;
      appState.raw.reports = payload.reports;
      setSection('kpis');
      // In case files were chosen before boot finished
      if (window.__ih_local_cache) delete window.__ih_local_cache;
    };
  }

  $(boot);
})();

// -------- Local JSON Loader (supports file://) --------
function enableLocalLoader() {
  const overlay = $('#local-overlay');
  const drop = $('#drop-zone');
  const input = $('#file-input');
  const status = $('#load-status');

  $('#load-local-btn').on('click', () => toggleOverlay(true));
  $('#close-overlay').on('click', () => toggleOverlay(false));

  function handleFiles(files) {
    const list = Array.from(files);
    const pick = (kw) => list.find(f => f.name.toLowerCase().includes(kw));
    const kFile = pick('kpi');
    const dFile = pick('dashboard');
    const rFile = pick('report');
    const missing = [];
    if (!kFile) missing.push('kpi.json');
    if (!dFile) missing.push('dashboard.json');
    if (!rFile) missing.push('report.json');
    if (missing.length) { status.text('Missing: ' + missing.join(', ')); return; }
    status.text('Loading…');
    Promise.all([readFileAsJson(kFile), readFileAsJson(dFile), readFileAsJson(rFile)]).then(([k,d,r]) => {
      // Immediately hide overlay for better UX
      status.text('Loaded ✓');
      toggleOverlay(false);
      const payload = { kpis: k, dashboards: d, reports: r };
      // Try to hydrate now; if app API not ready yet, cache and retry shortly
      const tryHydrate = () => {
        if (window.IHub && typeof window.IHub.loadLocal === 'function') {
          window.IHub.loadLocal(payload);
        } else {
          window.__ih_local_cache = payload;
          setTimeout(tryHydrate, 100);
        }
      };
      tryHydrate();
    }).catch(err => {
      console.error(err);
      status.text('Failed to read files. Ensure valid JSON.');
    });
  }

  drop.on('dragover', (e) => { e.preventDefault(); drop.addClass('drag'); });
  drop.on('dragleave', () => drop.removeClass('drag'));
  drop.on('drop', (e) => { e.preventDefault(); drop.removeClass('drag'); handleFiles(e.originalEvent.dataTransfer.files); });
  input.on('change', (e) => handleFiles(e.target.files));
}

function readFileAsJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (e) { reject(e); }
    };
    reader.readAsText(file);
  });
}

function toggleOverlay(show) {
  const overlay = $('#local-overlay');
  overlay.toggleClass('hidden', !show).attr('aria-hidden', show ? 'false' : 'true');
}

// When local JSONs are loaded, hydrate the app
window.addEventListener('ihub:local-ready', function () {
  const store = window.__ihub_local;
  if (!store) return;
  const $ = window.jQuery;
  // Inject data into app state and render
  if ($ && $.isReady) {
    // Small shim: re-use existing boot flow by setting globals
    const state = window.__ih_state || {};
  }
  // Directly render by invoking the same functions via a minimal bridge
  (function bridge() {
    const app = $('#section-title');
    if (!app.length) return;
    // Replace data on the running app
    const ctx = window.__ih_ctx || {};
  })();
});

