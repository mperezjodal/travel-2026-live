const { blocks, destinations, budget, routeIdeas = [], experienceReminders = [] } = window.travel2026Data;

const phaseColors = {
  Confirmado: "#1f2937",
  Tailandia: "#0f766e",
  Vietnam: "#0891b2",
  Camboya: "#a16207",
  Indonesia: "#4d7c0f",
  "Sri Lanka": "#c2410c",
  Nepal: "#047857",
  "Asia Central": "#2563eb",
  China: "#b91c1c",
  Corea: "#0369a1",
  Taiwán: "#7c3aed",
  Japón: "#be185d",
  EEUU: "#0f172a",
  LatAm: "#059669",
};

const blockAccentColors = {
  thailand: "#0f766e",
  "vietnam-cambodia": "#0891b2",
  indonesia: "#4d7c0f",
  "sri-nepal": "#c2410c",
  central: "#2563eb",
  china: "#b91c1c",
  "korea-taiwan": "#7c3aed",
  japan: "#be185d",
  "west-us": "#0f172a",
  "latam-return": "#059669",
};

let selectedBlockId = "thailand";
let selectedStopId = "cnx";
let selectedIdeaId = null;
let selectedReminderId = null;
let selectedDetailType = "block";
let budgetHeading = null;
let map;
let routeLine;
let blockLine;
let markerLayer;

function qs(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function blockById(id) {
  return blocks.find((block) => block.id === id) || blocks[0];
}

function stopById(id) {
  return destinations.find((stop) => stop.id === id) || destinations[1];
}

function stopsForBlock(blockId) {
  const block = blockById(blockId);
  return block.stops.map(stopById);
}

function ideasForBlock(blockId) {
  return routeIdeas.filter((idea) => idea.block === blockId);
}

function ideaById(id) {
  return routeIdeas.find((idea) => idea.id === id) || null;
}

function reminderById(id) {
  return experienceReminders.find((reminder) => reminder.id === id) || null;
}

function remindersForBlock(blockId) {
  return experienceReminders.filter((reminder) =>
    reminder.primaryBlock === blockId || (reminder.blocks || []).includes(blockId)
  );
}

function routeStops() {
  const seen = new Set();
  return blocks.flatMap((block) =>
    block.stops
      .map(stopById)
      .filter((stop) => {
        if (!stop || seen.has(stop.id)) return false;
        seen.add(stop.id);
        return true;
      })
  );
}

function selectedBlockStops() {
  return stopsForBlock(selectedBlockId).filter(Boolean);
}

function tags(items = []) {
  return items.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function compactTags(items = [], limit = 5) {
  const visible = items.slice(0, limit);
  const remaining = items.length - visible.length;
  return `${tags(visible)}${remaining > 0 ? `<span>+${remaining}</span>` : ""}`;
}

function listItems(items = []) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function sourceLinks(links = [], limit = Infinity) {
  if (!links.length) return '<span class="empty-note">Sin enlaces todavía.</span>';
  const visible = links.slice(0, limit);
  const remaining = links.length - visible.length;
  return visible
    .map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`)
    .join("") + (remaining > 0 ? `<span class="empty-note">+${remaining}</span>` : "");
}

function previewList(items = [], limit = 4) {
  const visible = items.slice(0, limit);
  const remaining = items.length - visible.length;
  return `
    <ul class="preview-list">
      ${listItems(visible)}
      ${remaining > 0 ? `<li class="is-muted">+${remaining} más</li>` : ""}
    </ul>
  `;
}

function formatUSD(value) {
  const numericValue = Math.round(Number(value) || 0);
  const sign = numericValue < 0 ? "-" : "";
  return `${sign}$${Math.abs(numericValue).toLocaleString("en-US")}`;
}

function budgetMoneyParts(value) {
  const amount = Math.round(Number(value) || 0).toLocaleString("en-US");
  return `<span class="budget-currency">$</span><span class="budget-number">${amount}</span>`;
}

function expenseEntriesFor(scope, column) {
  const entries = budget?.expenseLedger || [];
  return entries.filter((entry) => {
    const scopeMatches = scope === "__total" || entry.scope === scope;
    const columnMatches = column === "Bloque" || entry.column === column;
    return scopeMatches && columnMatches;
  });
}

function expenseDisplayRows(entries = []) {
  return entries.flatMap((entry) => {
    if (entry.items?.length) {
      return entry.items.map((item) => ({
        date: entry.date,
        label: item.label,
        amount: item.amount,
        source: entry.source,
        status: entry.status,
      }));
    }
    return [entry];
  });
}

function expenseTotal(entries = []) {
  return entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
}

function expenseTooltip(scope, column) {
  const entries = expenseEntriesFor(scope, column);
  if (!entries.length) return "";
  const rows = expenseDisplayRows(entries);
  const preview = rows.slice(0, 3).map((item) => `${item.label} ${formatUSD(item.amount)}`).join(" · ");
  const more = rows.length > 3 ? ` · +${rows.length - 3}` : "";
  const label = scope === "__total" ? "Total" : scope;
  return `${label} · ${column}: ${formatUSD(expenseTotal(entries))} gastados · ${preview}${more}`;
}

function paidAmountMarkup(value, options = {}) {
  const scope = options.expenseScope;
  const column = options.expenseColumn;
  const hasDetails = scope && column && expenseEntriesFor(scope, column).length > 0;
  if (!hasDetails) return `<span class="is-paid">${budgetMoneyParts(value)}</span>`;

  const tooltip = expenseTooltip(scope, column);
  return `
    <button
      type="button"
      class="is-paid budget-paid-button"
      data-expense-scope="${escapeHtml(scope)}"
      data-expense-column="${escapeHtml(column)}"
      title="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(tooltip)}"
    >${budgetMoneyParts(value)}</button>
  `;
}

function shortDate(value) {
  return String(value || "")
    .replace(/^desde\s+/i, "")
    .replace(/\s+-\s+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^1 oct$/, "1 oct+");
}

function budgetMoney(total, paid = 0, options = {}) {
  const cleanTotal = Math.max(Math.round(Number(total) || 0), 0);
  const cleanPaid = Math.max(Math.round(Number(paid) || 0), 0);
  const remaining = Math.max(cleanTotal - cleanPaid, 0);

  if (!cleanTotal && !cleanPaid) return '<span class="is-empty">—</span>';
  if (!cleanPaid) return `<span class="budget-money"><span class="budget-expected">${budgetMoneyParts(cleanTotal)}</span></span>`;
  if (options.inlinePaid) {
    return `
      <span class="budget-money has-paid is-inline-paid" title="${formatUSD(cleanPaid)} gastados; ${formatUSD(cleanTotal)} presupuesto por día">
        ${paidAmountMarkup(cleanPaid, options)}
        <span class="budget-expected">${budgetMoneyParts(cleanTotal)}</span>
      </span>
    `;
  }
  if (cleanPaid >= cleanTotal) {
    return `
      <span class="budget-money has-paid" title="${formatUSD(cleanPaid)} gastados">
        ${paidAmountMarkup(cleanPaid, options)}
      </span>
    `;
  }
  if (!options.total) {
    return `
      <span class="budget-money has-paid" title="${formatUSD(cleanPaid)} gastados; ${formatUSD(cleanTotal)} presupuesto">
        ${paidAmountMarkup(cleanPaid, options)}
        <span class="budget-expected">${budgetMoneyParts(cleanTotal)}</span>
      </span>
    `;
  }
  return `
    <span class="budget-money has-paid" title="${formatUSD(cleanPaid)} gastados; ${formatUSD(remaining)} pendientes">
      ${paidAmountMarkup(cleanPaid, options)}
      <span class="budget-expected">${budgetMoneyParts(cleanTotal)}</span>
    </span>
  `;
}

function budgetCell(label, content, options = {}) {
  const classes = ["budget-cell"];
  if (options.soft !== false) classes.push("is-soft");
  if (options.total) classes.push("is-total");
  if (options.empty) classes.push("is-empty");
  return `<span class="${classes.join(" ")}" data-label="${escapeHtml(label)}">${content}</span>`;
}

function budgetAmountCell(label, total, paid = 0, options = {}) {
  const moneyOptions = { ...options, expenseColumn: options.expenseColumn || label };
  return budgetCell(label, budgetMoney(total, paid, moneyOptions), options);
}

function budgetEmptyCell(label) {
  return budgetCell(label, "—", { empty: true });
}

function budgetDailyCell(daily, paid = 0, options = {}) {
  return budgetCell("Día", budgetMoney(daily, paid, { ...options, inlinePaid: true, expenseColumn: "Día" }), { soft: true });
}

function blockBudgetFor(blockId) {
  return budget?.blockBudgets?.find((item) => item.block === blockId);
}

function budgetSourceLinks() {
  return sourceLinks(budget?.sources || []);
}

function updateBudgetHeading() {
  const title = qs("#budget-title");
  const subtitle = qs("#budget-subtitle");
  if (!title || !subtitle || !budgetHeading) return;

  if (qs("#budget-panel")?.open) {
    title.textContent = `Presupuesto: ${formatUSD(budgetHeading.total)}`;
    subtitle.textContent = `${formatUSD(budgetHeading.blocksTotal)} bloques + ${formatUSD(budgetHeading.flightsTotal)} traslados`;
    return;
  }

  title.textContent = "Presupuesto";
  subtitle.textContent = "";
}

function collapseBudgetPanel() {
  document.querySelectorAll(".budget-panel").forEach((panel) => {
    panel.open = false;
    panel.removeAttribute("open");
  });
  updateBudgetHeading();
}

function transportBudgetForBlock(blockId) {
  return budget?.blockTransports?.find((item) => item.block === blockId) || null;
}

function renderBudgetExpenseDetail(trigger) {
  const panel = qs("#budget-expense-detail");
  if (!panel) return;

  const scope = trigger.dataset.expenseScope;
  const column = trigger.dataset.expenseColumn;
  const entries = expenseEntriesFor(scope, column);
  const rows = expenseDisplayRows(entries);
  const titleScope = scope === "__total" ? "Total" : scope;
  const total = expenseTotal(entries);

  if (!rows.length) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  panel.hidden = false;
  panel.innerHTML = `
    <div class="expense-detail-head">
      <div>
        <strong>${escapeHtml(titleScope)} · ${escapeHtml(column)}</strong>
        <span>${formatUSD(total)} gastado</span>
      </div>
      <div class="expense-detail-actions">
        <a href="05-presupuesto/gastos-reales.csv" target="_blank" rel="noreferrer">CSV</a>
        <button type="button" data-expense-close>Cerrar</button>
      </div>
    </div>
    <div class="expense-detail-table" role="table" aria-label="Detalle de gastos">
      <div class="expense-detail-row is-head">
        <span>Fecha</span>
        <span>Gasto</span>
        <span>Estado</span>
        <span>Monto</span>
      </div>
      ${rows.map((item) => `
        <div class="expense-detail-row">
          <span>${escapeHtml(item.date || "—")}</span>
          <span>
            <strong>${escapeHtml(item.label)}</strong>
            ${item.source ? `<small>${escapeHtml(item.source)}</small>` : ""}
          </span>
          <span>${escapeHtml(item.status || "—")}</span>
          <span>${formatUSD(item.amount)}</span>
        </div>
      `).join("")}
    </div>
  `;
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function bindBudgetExpenseEvents() {
  const dashboard = qs("#budget-dashboard");
  if (!dashboard || dashboard.dataset.expenseEventsBound) return;
  dashboard.dataset.expenseEventsBound = "true";
  dashboard.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-expense-close]");
    if (closeButton) {
      const panel = qs("#budget-expense-detail");
      if (panel) {
        panel.hidden = true;
        panel.innerHTML = "";
      }
      return;
    }

    const trigger = event.target.closest(".budget-paid-button");
    if (!trigger) return;
    renderBudgetExpenseDetail(trigger);
  });
}

function renderBudget() {
  const dashboard = qs("#budget-dashboard");
  if (!budget || !dashboard) return;
  collapseBudgetPanel();

  const realistic = budget.scenarios.find((scenario) => scenario.id === "realistic") || budget.scenarios[0];
  const extrasTotal = budget.blockBudgets.reduce((sum, item) => sum + item.extras.realistic, 0);
  const blockExtrasPaid = budget.blockBudgets.reduce((sum, item) => sum + (item.extrasPaid || 0), 0);
  const localBlocksTotal = budget.blockBudgets.reduce((sum, item) => sum + item.total.realistic, 0);
  const localBlocksPaid = budget.blockBudgets.reduce((sum, item) => sum + (item.paid || 0) + (item.extrasPaid || 0), 0);
  const blockTransportTotal = (budget.blockTransports || []).reduce((sum, item) => sum + item.realistic, 0);
  const blockTransportPaid = (budget.blockTransports || []).reduce((sum, item) => sum + (item.paid || 0), 0);
  const confirmedFlightTotal = budget.fixedPaid.reduce((sum, item) => sum + item.amount, 0);
  const fixedDayTotal = (budget.fixedDayPaid || []).reduce((sum, item) => sum + item.amount, 0);
  const fixedExtrasTotal = (budget.fixedExtrasPaid || []).reduce((sum, item) => sum + item.amount, 0);
  const fixedLocalTotal = fixedDayTotal + fixedExtrasTotal;
  const fixedRowTotal = confirmedFlightTotal + fixedLocalTotal;
  const supportItems = budget.transportBudgets || [];
  const supportTotal = supportItems.reduce((sum, item) => sum + item.realistic, 0);
  const supportPaid = supportItems.reduce((sum, item) => sum + (item.paid || 0), 0);
  const blocksTotal = localBlocksTotal + supportTotal + fixedLocalTotal;
  const flightsTotal = blockTransportTotal + confirmedFlightTotal;
  const blocksPaid = localBlocksPaid + supportPaid + fixedLocalTotal;
  const flightsPaid = blockTransportPaid + confirmedFlightTotal;
  const tableTotal = blocksTotal + flightsTotal;
  const tablePaid = blocksPaid + flightsPaid;

  budgetHeading = {
    total: tableTotal || realistic.total,
    blocksTotal,
    flightsTotal,
  };
  updateBudgetHeading();

  const supportRow = supportTotal
    ? `
      <div class="budget-table-row is-buffer">
        <div>
          <strong>Buffer</strong>
        </div>
        ${budgetEmptyCell("Día")}
        ${budgetEmptyCell("Traslados")}
        ${budgetAmountCell("Extras", supportTotal, supportPaid, { expenseScope: "Buffer" })}
        ${budgetAmountCell("Bloque", supportTotal, supportPaid, { soft: false, total: true, expenseScope: "Buffer" })}
      </div>
    `
    : "";

  const confirmedFlightRow = budget.fixedPaid.length
    ? `
        <div class="budget-table-row is-fixed">
          <div>
            <strong>Ida</strong>
          </div>
          ${budgetAmountCell("Día", fixedDayTotal, fixedDayTotal, { expenseScope: "Ida" })}
          ${budgetAmountCell("Traslados", confirmedFlightTotal, confirmedFlightTotal, { expenseScope: "Ida" })}
          ${budgetAmountCell("Extras", fixedExtrasTotal, fixedExtrasTotal, { expenseScope: "Ida" })}
          ${budgetAmountCell("Bloque", fixedRowTotal, fixedRowTotal, { soft: false, total: true, expenseScope: "Ida" })}
        </div>
      `
    : "";

  const unifiedRows = budget.blockBudgets
    .map((item) => {
      const block = blockById(item.block);
      const transport = transportBudgetForBlock(item.block);
      const transportValue = transport?.realistic || 0;
      const blockTotal = item.total.realistic + transportValue;
      const blockPaid = (item.paid || 0) + (item.extrasPaid || 0) + (transport?.paid || 0);
      const expenseScope = block.title;
      return `
        <div class="budget-table-row">
          <div>
            <strong>${escapeHtml(block.title)}</strong>
            <small>${item.nights} noches · ${escapeHtml(shortDate(block.dates))}</small>
          </div>
          ${budgetDailyCell(item.daily.realistic, item.paid || 0, { expenseScope })}
          ${budgetAmountCell("Traslados", transportValue, transport?.paid || 0, { expenseScope })}
          ${budgetAmountCell("Extras", item.extras.realistic, item.extrasPaid || 0, { expenseScope })}
          ${budgetAmountCell("Bloque", blockTotal, blockPaid, { soft: false, total: true, expenseScope })}
        </div>
      `;
    })
    .join("");

  dashboard.innerHTML = `
    <div class="budget-table" role="table" aria-label="Presupuesto por día, extras, traslados y bloque">
      <div class="budget-table-head">
        <span>Concepto</span>
        <span class="is-soft">Día</span>
        <span class="is-soft">Traslados</span>
        <span class="is-soft">Extras</span>
        <span>Bloque</span>
      </div>
      ${confirmedFlightRow}
      ${unifiedRows}
      ${supportRow}
      <div class="budget-table-row is-subtotal">
        <div>
          <strong>Total base</strong>
        </div>
        ${budgetEmptyCell("Día")}
        ${budgetAmountCell("Traslados", flightsTotal, flightsPaid, { expenseScope: "__total" })}
        ${budgetAmountCell("Extras", extrasTotal + supportTotal + fixedExtrasTotal, blockExtrasPaid + supportPaid + fixedExtrasTotal, { expenseScope: "__total" })}
        ${budgetAmountCell("Bloque", tableTotal, tablePaid, { soft: false, total: true, expenseScope: "__total" })}
      </div>
    </div>
    <div id="budget-expense-detail" class="expense-detail" hidden></div>

    <details class="budget-assumptions">
      <summary>Supuestos y fuentes</summary>
      <ul>${listItems(budget.assumptions)}</ul>
      <div class="source-list">${budgetSourceLinks()}</div>
    </details>
  `;
  bindBudgetExpenseEvents();
  refreshIcons();
  requestAnimationFrame(collapseBudgetPanel);
  window.setTimeout(collapseBudgetPanel, 50);
}

function markerColor(stop) {
  return phaseColors[stop.phase] || "#334155";
}

function markerIcon(stop) {
  const isSelectedBlock = stop.block === selectedBlockId;
  return L.divIcon({
    className: `route-marker ${stop.type} ${isSelectedBlock ? "is-in-block" : "is-out-block"}`,
    html: `<span style="--pin-color:${markerColor(stop)}">${escapeHtml(stop.order)}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    tooltipAnchor: [0, -18],
  });
}

function renderMapControls() {
  const container = qs("#map-block-controls");
  if (!container) return;
  container.innerHTML = blocks
    .map((block) => {
      const blockBudget = blockBudgetFor(block.id);
      const accent = blockAccentColors[block.id] || "#334155";
      const nights = blockBudget ? `${blockBudget.nights} noches` : shortDate(block.dates);
      return `
        <button class="map-chip ${block.id === selectedBlockId ? "is-active" : ""}" type="button" data-block="${escapeHtml(block.id)}" style="--block-accent: ${escapeHtml(accent)}">
          <span>${escapeHtml(block.number)}</span>
          <div>
            <strong>${escapeHtml(block.title)}</strong>
            <small>${escapeHtml(nights)}</small>
          </div>
        </button>
      `;
    })
    .join("");
  refreshIcons();
}

function renderReminderDetail() {
  const reminder = reminderById(selectedReminderId);
  if (!reminder) {
    selectedReminderId = null;
    selectedDetailType = "block";
    renderDestinationDetail();
    return;
  }

  const relatedBlocks = (reminder.blocks || [reminder.primaryBlock])
    .map((id) => blocks.find((block) => block.id === id))
    .filter(Boolean)
    .map((block) => block.title);

  qs("#destination-detail").innerHTML = `
    <div class="block-heading">
      <h3>${escapeHtml(reminder.title)}</h3>
    </div>

    <p class="destination-summary">${escapeHtml(reminder.fit)}</p>

    <div class="tag-list is-compact block-practices">
      ${compactTags([reminder.when, reminder.status, ...reminder.tags].filter(Boolean), 6)}
    </div>

    <div class="block-brief">
      <p><strong>Decisión</strong><span>${escapeHtml(reminder.decision)}</span></p>
      <p><strong>Acción</strong><span>${escapeHtml(reminder.action)}</span></p>
      <p><strong>Bloques</strong><span>${escapeHtml(relatedBlocks.join(" · "))}</span></p>
    </div>

    ${reminder.links?.length ? `
      <details class="more-detail">
        <summary>Referencias</summary>
        <div class="source-list">${sourceLinks(reminder.links, 5)}</div>
      </details>
    ` : ""}
  `;
  refreshIcons();
}

function renderIdeaDetail() {
  const idea = ideaById(selectedIdeaId);
  if (!idea) {
    selectedIdeaId = null;
    selectedDetailType = "stop";
    renderDestinationDetail();
    return;
  }

  const block = blockById(idea.block);
  qs("#destination-detail").innerHTML = `
    <div class="block-heading">
      <h3>${escapeHtml(idea.title)}</h3>
    </div>

    <p class="destination-summary">${escapeHtml(idea.fit)}</p>

    <div class="tag-list is-compact block-practices">
      ${compactTags([block.title, idea.when, idea.status, ...idea.tags].filter(Boolean), 5)}
    </div>

    <div class="block-brief">
      <p><strong>Suma</strong><span>${escapeHtml(idea.fit)}</span></p>
      <p><strong>Desplaza</strong><span>${escapeHtml(idea.tradeoff)}</span></p>
    </div>

    ${idea.links?.length ? `
      <details class="more-detail">
        <summary>Referencias</summary>
        <div class="source-list">${sourceLinks(idea.links, 5)}</div>
      </details>
    ` : ""}
  `;
  refreshIcons();
}

function renderBlockDetail() {
  const block = blockById(selectedBlockId);
  const blockReminders = remindersForBlock(block.id);
  qs("#destination-detail").innerHTML = `
    <div class="block-heading">
      <h3>${escapeHtml(block.title)}</h3>
    </div>

    <p class="destination-summary">${escapeHtml(block.summary)}</p>

    ${block.practices?.length ? `
      <div class="tag-list is-compact block-practices">${compactTags(block.practices, 5)}</div>
    ` : ""}

    <div class="block-brief">
      <p><strong>Clima</strong><span>${escapeHtml(block.climate)}</span></p>
      <p><strong>Estrategia</strong><span>${escapeHtml(block.strategy)}</span></p>
      ${blockReminders.length ? `
        <p>
          <strong>Investigar</strong>
          <span class="inline-reminders">
            ${blockReminders.map((reminder) => `
              <button class="inline-reminder" type="button" data-reminder="${escapeHtml(reminder.id)}">
                ${escapeHtml(reminder.title)}
              </button>
            `).join("")}
          </span>
        </p>
      ` : ""}
      ${block.highlights?.length ? `<p><strong>Imperdibles</strong><span>${escapeHtml(block.highlights.join(" · "))}</span></p>` : ""}
    </div>
  `;
  refreshIcons();
}

function renderDestinationDetail() {
  if (selectedDetailType === "block") {
    renderBlockDetail();
    return;
  }

  if (selectedDetailType === "reminder" && selectedReminderId) {
    renderReminderDetail();
    return;
  }

  if (selectedIdeaId) {
    renderIdeaDetail();
    return;
  }

  const stop = stopById(selectedStopId);
  const orderedStops = routeStops();
  const index = orderedStops.findIndex((item) => item.id === selectedStopId);
  const safeIndex = index === -1 ? 0 : index;
  const previous = orderedStops[safeIndex - 1];
  const next = orderedStops[safeIndex + 1];
  const previousButton = previous
    ? `<button class="ghost-button" type="button" data-stop="${escapeHtml(previous.id)}">
        <i data-lucide="chevron-left"></i>
        <span>${escapeHtml(previous.place)}</span>
      </button>`
    : '<span></span>';
  const nextButton = next
    ? `<button class="ghost-button" type="button" data-stop="${escapeHtml(next.id)}">
        <span>${escapeHtml(next.place)}</span>
        <i data-lucide="chevron-right"></i>
      </button>`
    : '<span></span>';

  qs("#destination-detail").innerHTML = `
    <div class="block-heading">
      <h3>${escapeHtml(stop.place)}</h3>
    </div>

    <p class="destination-summary">${escapeHtml(stop.summary)}</p>

    <div class="tag-list is-compact block-practices">
      ${compactTags([stop.country, stop.priority].filter(Boolean), 2)}
    </div>

    <div class="block-brief">
      <p><strong>Por qué</strong><span>${escapeHtml(stop.why)}</span></p>
      <p><strong>Ritmo</strong><span>${escapeHtml(stop.pause)}</span></p>
      <p><strong>Comida</strong><span>${escapeHtml(stop.food)}</span></p>
      <p><strong>Social</strong><span>${escapeHtml(stop.social)}</span></p>
    </div>

    <div class="detail-stack is-light">
      <section class="detail-section-compact">
        <h4>Ideas</h4>
        ${previewList(stop.ideas, 4)}
      </section>
      <section class="detail-section-compact">
        <h4>Cuidado</h4>
        <div class="tag-list is-compact">${compactTags(stop.cautions, 4)}</div>
      </section>
      <details class="more-detail">
        <summary>Referencias</summary>
        <div class="source-list">${sourceLinks(stop.links, 5)}</div>
      </details>
    </div>

    <div class="detail-actions">
      ${previousButton}
      ${nextButton}
    </div>
  `;
  refreshIcons();
}

function renderRouteList() {
  const visibleStops = stopsForBlock(selectedBlockId);
  const visibleIdeas = ideasForBlock(selectedBlockId);
  const stopCards = visibleStops
    .map((stop) => `
      <button class="route-item ${selectedDetailType === "stop" && stop.id === selectedStopId ? "is-active" : ""}" type="button" data-stop="${escapeHtml(stop.id)}">
        <span class="route-node">${escapeHtml(stop.order)}</span>
        <span class="route-copy">
          <strong>${escapeHtml(stop.place)}</strong>
          <small>${escapeHtml(stop.dates)}</small>
        </span>
        <em>${escapeHtml(stop.tempo || stop.type || "")}</em>
      </button>
    `)
    .join("");
  const ideaCards = visibleIdeas
    .map((idea) => `
      <button class="route-item route-idea ${selectedDetailType === "idea" && idea.id === selectedIdeaId ? "is-active" : ""}" type="button" data-idea="${escapeHtml(idea.id)}">
        <span class="route-node">+</span>
        <span class="route-copy">
          <strong>${escapeHtml(idea.title)}</strong>
          <small>${escapeHtml(idea.when)}</small>
        </span>
        <em>${escapeHtml(idea.status || "tentativo")}</em>
      </button>
    `)
    .join("");

  qs("#route-list").innerHTML = stopCards + ideaCards;
}

function fitWholeRoute() {
  if (!map || !routeLine) return;
  map.fitBounds(routeLine.getBounds(), { padding: [34, 34], maxZoom: 4 });
}

function fitBlock(blockId) {
  if (!map) return;
  const stops = stopsForBlock(blockId);
  map.fitBounds(L.latLngBounds(stops.map((stop) => stop.coords)), { padding: [42, 42], maxZoom: 6 });
}

function updateBlockLine() {
  if (!map || !window.L) return;
  const stops = stopsForBlock(selectedBlockId);
  const coords = stops.map((stop) => stop.coords);
  const color = markerColor(stops[0]);
  if (!blockLine) {
    blockLine = L.polyline(coords, {
      color,
      weight: 5,
      opacity: 0.9,
    }).addTo(map);
    return;
  }
  blockLine.setLatLngs(coords);
  blockLine.setStyle({ color });
}

function drawMarkers() {
  if (!map || !window.L) return;
  if (markerLayer) markerLayer.remove();
  markerLayer = L.layerGroup().addTo(map);

  routeStops().forEach((stop) => {
    const marker = L.marker(stop.coords, { icon: markerIcon(stop) }).addTo(markerLayer);
    marker.bindTooltip(`${stop.order} ${stop.place}`, { direction: "top", offset: [0, -6] });
    marker.on("click", () => selectStop(stop.id, true, false));
  });
}

function initMap() {
  const mapEl = qs("#route-map");
  if (!window.L) {
    mapEl.innerHTML = '<div class="map-fallback">No cargó el mapa. La ruta sigue disponible en la lista.</div>';
    return;
  }

  map = L.map("route-map", { zoomControl: false, scrollWheelZoom: false, worldCopyJump: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  routeLine = L.polyline(routeStops().map((stop) => stop.coords), {
    color: "#1f2937",
    weight: 3,
    opacity: 0.32,
    dashArray: "8 8",
  }).addTo(map);

  drawMarkers();
  updateBlockLine();
  fitBlock(selectedBlockId);
}

function syncSelectedBlockFromStop(stop) {
  if (stop.block === "confirmed") return;
  if (stop.block !== selectedBlockId) selectedBlockId = stop.block;
}

function selectBlock(blockId, centerMap = false) {
  selectedBlockId = blockId;
  selectedStopId = blockById(blockId).stops[0];
  selectedIdeaId = null;
  selectedReminderId = null;
  selectedDetailType = "block";
  renderMapControls();
  renderDestinationDetail();
  renderRouteList();
  drawMarkers();
  updateBlockLine();
  if (centerMap) fitBlock(blockId);
}

function selectStop(stopId, centerMap = false, scrollToDetail = false) {
  selectedStopId = stopId;
  selectedIdeaId = null;
  selectedReminderId = null;
  selectedDetailType = "stop";
  const stop = stopById(stopId);
  syncSelectedBlockFromStop(stop);
  renderMapControls();
  renderDestinationDetail();
  renderRouteList();
  drawMarkers();
  updateBlockLine();
  if (centerMap && map) map.setView(stop.coords, stop.block === "japan" ? 6 : 5, { animate: true });
  if (scrollToDetail) qs("#destination-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectIdea(ideaId, scrollToDetail = false) {
  const idea = ideaById(ideaId);
  if (!idea) return;
  selectedIdeaId = idea.id;
  selectedReminderId = null;
  selectedDetailType = "idea";
  selectedBlockId = idea.block;
  renderMapControls();
  renderDestinationDetail();
  renderRouteList();
  drawMarkers();
  updateBlockLine();
  if (scrollToDetail) qs("#destination-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectReminder(reminderId, scrollToDetail = false) {
  const reminder = reminderById(reminderId);
  if (!reminder) return;
  selectedReminderId = reminder.id;
  selectedIdeaId = null;
  selectedDetailType = "reminder";
  if (reminder.primaryBlock && blockById(reminder.primaryBlock)?.id === reminder.primaryBlock) {
    selectedBlockId = reminder.primaryBlock;
  }
  renderMapControls();
  renderDestinationDetail();
  renderRouteList();
  drawMarkers();
  updateBlockLine();
  if (scrollToDetail) qs("#destination-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const blockButton = event.target.closest("[data-block]");
    if (blockButton) {
      selectBlock(blockButton.dataset.block, true);
      return;
    }

    const reminderButton = event.target.closest("[data-reminder]");
    if (reminderButton) {
      const shouldScroll = window.matchMedia("(max-width: 1000px)").matches;
      selectReminder(reminderButton.dataset.reminder, shouldScroll);
      return;
    }

    const ideaButton = event.target.closest("[data-idea]");
    if (ideaButton) {
      const shouldScroll = window.matchMedia("(max-width: 1000px)").matches;
      selectIdea(ideaButton.dataset.idea, shouldScroll);
      return;
    }

    const stopButton = event.target.closest("[data-stop]");
    if (stopButton) {
      const insideMap = Boolean(event.target.closest("#mapa"));
      const insideRouteList = Boolean(event.target.closest("#route-list"));
      const shouldScroll = !insideMap || (insideRouteList && window.matchMedia("(max-width: 1000px)").matches);
      selectStop(stopButton.dataset.stop, insideMap, shouldScroll);
    }
  });

  qs("#reset-map")?.addEventListener("click", () => {
    fitWholeRoute();
  });

  qs("#budget-panel")?.addEventListener("toggle", updateBudgetHeading);
}

function init() {
  renderBudget();
  renderMapControls();
  renderDestinationDetail();
  renderRouteList();
  initMap();
  bindEvents();
  refreshIcons();
}

document.addEventListener("DOMContentLoaded", init);
