/* global $, window, document */
(function () {
  'use strict';

  // ---------- Data loading ----------
  // Embedded sample data to avoid external file references
  const SAMPLE = (function () {
    const kpis = { SubFolders: [{ Name: 'KPIs', SubFolders: [
      { Name: 'Executive', Reports: [{ Name: 'Coming Soon', URL: 'https://example.com' }] },
      { Name: 'Oncology and Women\'s Services', Reports: [
        { Name: 'Oncology_Finance', URL: 'https://ashoktest.com/Reports/powerbi/KPIs/Oncology and Women\'s Services/Oncology_Finance?rc:toolbar=false&rs:embed=true&rc:showbackbutton=true' },
        { Name: 'Oncology_PatientCount', URL: 'https://ashoktest.com/Reports/powerbi/KPIs/Oncology and Women\'s Services/Oncology_PatientCount?rc:toolbar=false&rs:embed=true&rc:showbackbutton=true' }
      ] }
    ] }] };

    const dashboards = { SubFolders: [{ Name: 'Dashboards', SubFolders: [
      { Name: 'Finance', Reports: [
        { Name: 'SEP Daily Flash Dashboard', URL: 'https://ashoktest.com/Reports/powerbi/Dashboards/Finance/SEP Daily Flash Dashboard?&rs:embed=true' },
        { Name: 'SEH Daily Flash Dashboard', URL: 'https://ashoktest.com/Reports/powerbi/Dashboards/Finance/SEH Daily Flash Dashboard?&rs:embed=true' }
      ] },
      { Name: 'Oncology and Women\'s Services', Reports: [
        { Name: 'Oncology Aria', URL: 'https://ashoktest.com/Reports/powerbi/Dashboards/Oncology and Women\'s Services/Oncology Aria?&rs:embed=true' }
      ] }
    ] }] };

    const reports = { SubFolders: [{ Name: 'Reports', SubFolders: [
      { Name: 'ADT', Reports: [
        { Name: 'All Non-SEH Transfers', URL: 'https://ashoktest.com/Reports/report/Reports/ADT/All Non-SEH Transfers?&rs:embed=true' },
        { Name: 'OB Coverages', URL: 'https://ashoktest.com/Reports/report/Reports/ADT/OB Coverages?&rs:embed=true' }
      ] },
      { Name: 'Appointments', Reports: [
        { Name: 'Appt Stats', URL: 'https://ashoktest.com/Reports/report/Reports/Appointments/Appt Stats?&rs:embed=true' }
      ] }
    ] }] };

    return { kpis, dashboards, reports };
  })();

  const appState = {
    section: 'kpis',
    categories: [],
    raw: { kpis: null, dashboards: null, reports: null },
    breadcrumb: []
  };

  function fetchJson(key) {
    // Use embedded data
    return $.Deferred().resolve(SAMPLE[key]).promise();
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
      appState.raw.kpis = k;
      appState.raw.dashboards = d;
      appState.raw.reports = r;
      setSection('kpis');
    });

    // Dashboard back
    $('#dash-back').on('click', () => {
      $('#dash-detail').addClass('hidden');
      renderDashboardsHome();
    });

    // Expose a small API for local loading
    // Local loader no longer needed since data is embedded
  }

  $(boot);
})();

// Local loader code removed; using embedded SAMPLE data

