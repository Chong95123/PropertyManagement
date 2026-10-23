/* PRODUCT D — Property Management
   Phase 2 Workspace + Tenancy Agreement Auto-Fill, Digital Signing & 2-Month Renewal Reminders
*/

const SUPABASE_URL = "https://hzhotlyvuxqykkttilef.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aG90bHl2dXhxeWtrdHRpbGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNjY1MzUsImV4cCI6MjEwNTk0MjUzNX0.qW1C7wYI6rSBHkHkTle6A37z_uV5DSk94AmZuOJZauw";

const configReady =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_KEY.includes("YOUR_") &&
  SUPABASE_KEY.length > 10;

const db = configReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const $ = id => document.getElementById(id);

const state = {
  properties: [],
  owners: [],
  units: [],
  links: [],
  tenants: [],
  tenancies: [],
  agreements: [],
  agreementTemplate: null,
  bookings: [],
  deposits: [],
  sales: [],
  finances: [],
  maintenance: [],
  page: "dashboard"
};


const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;",
  '"': "&quot;", "'": "&#39;"
}[c]));

const money = value => value == null || value === ""
  ? "—"
  : "RM " + Number(value).toLocaleString("en-MY", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });

function message(id, text, type = "") {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = "message " + type;
}

function reportError(error) {
  console.error(error);
  message("app-message", error.message || "Something went wrong.", "error");
}

async function runQuery(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/* ---------------- AUTHENTICATION ---------------- */

function showApp(signedIn) {
  $("auth-screen").classList.toggle("hidden", signedIn);
  $("app").classList.toggle("hidden", !signedIn);
}

async function signIn(event) {
  event.preventDefault();
  if (!db) {
    message("auth-message", "Add your Supabase URL and key in script.js first.", "error");
    return;
  }
  $("auth-submit").disabled = true;
  message("auth-message", "Signing in...");
  try {
    const { error } = await db.auth.signInWithPassword({
      email: $("auth-email").value.trim(),
      password: $("auth-password").value
    });
    if (error) throw error;
    await loadAll();
    showApp(true);
    message("auth-message", "");
  } catch (error) {
    reportAuthError(error);
  } finally {
    $("auth-submit").disabled = false;
  }
}

function reportAuthError(error) {
  console.error(error);
  message("auth-message", error.message || "Authentication failed.", "error");
}

async function signUp() {
  if (!db) {
    message("auth-message", "Configure Supabase in script.js first.", "error");
    return;
  }
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  if (!email || password.length < 8) {
    message("auth-message", "Enter an email and a password of at least 8 characters.", "error");
    return;
  }
  try {
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session) {
      await loadAll();
      showApp(true);
    } else {
      message("auth-message", "Account request submitted. Check your email to confirm registration, then sign in.", "success");
    }
  } catch (error) {
    reportAuthError(error);
  }
}

async function logout() {
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    showApp(false);
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- LOAD DATA ---------------- */

async function loadAll() {
  try {
    const [properties, owners, units, links, tenants, tenancies, agreements, bookings, deposits, sales, finances, maintenance] = await Promise.all([
      runQuery(db.from("properties").select("*").order("created_at", { ascending: false })),
      runQuery(db.from("owners").select("*").order("owner_name")),
      runQuery(db.from("rentable_units").select("*").order("unit_name")),
      runQuery(db.from("property_owners").select("*").order("created_at", { ascending: false })),
      runQuery(db.from("tenants").select("*").order("tenant_name")),
      runQuery(db.from("tenancies").select("*").order("start_date", { ascending: false })),
      db.from("tenancy_agreements").select("*").order("created_at", { ascending: false }).then(res => res.data || []),
      db.from("short_term_bookings").select("*").order("check_in_date", { ascending: false }).then(res => res.data || []),
      runQuery(db.from("deposits").select("*").order("created_at", { ascending: false })),
      db.from("property_sales").select("*").order("created_at", { ascending: false }).then(res => res.data || []),
      db.from("property_finances").select("*").order("transaction_date", { ascending: false }).then(res => res.data || []),
      db.from("maintenance_records").select("*").order("created_at", { ascending: false }).then(res => res.data || [])
    ]);

    state.properties = properties || [];
    state.owners = owners || [];
    state.units = units || [];
    state.links = links || [];
    state.tenants = tenants || [];
    state.tenancies = tenancies || [];
    state.agreements = agreements || [];
    state.bookings = bookings || [];
    state.deposits = deposits || [];
    state.sales = sales || [];
    state.finances = finances || [];
    state.maintenance = maintenance || [];

    renderAll();
    message("app-message", "Data loaded successfully.", "success");
  } catch (error) {
    reportError(error);
    throw error;
  }
}

function renderAll() {
  renderDashboard();
  renderProperties();
  renderOwners();
  renderUnits();
  renderLinks();
  renderTenants();
  renderTenancies();
  renderAgreements();
  renderBookings();
  renderDeposits();
  renderSales();
  renderFinances();
  renderMaintenance();
  renderReports();
  populateSelects();
  formatCompactRecordLists();
}

function formatCompactRecordLists() {
  document.querySelectorAll(".compact-record-list").forEach(container => {
    Array.from(container.children).filter(child => child.classList.contains("record-card")).forEach(card => {
      if (card.classList.contains("compact-record-row")) return;
      const children = Array.from(card.children);
      const title = children.find(child => child.matches("h3, h4")) || children[0];
      const actions = children.find(child => child.classList.contains("record-actions"));
      const details = document.createElement("div");
      details.className = "compact-record-details";
      children.filter(child => child !== title && child !== actions).forEach(child => details.appendChild(child));
      card.replaceChildren(...[title, details, actions].filter(Boolean));
      card.classList.add("compact-record-row");
      card.dataset.compactSearch = `${title?.textContent || ""} ${details.textContent || ""}`.toLowerCase();
    });

    let noMatch = container.querySelector(":scope > .compact-search-empty");
    if (!noMatch) {
      noMatch = document.createElement("div");
      noMatch.className = "panel empty compact-search-empty hidden";
      noMatch.textContent = "No matching records found.";
      container.appendChild(noMatch);
    }
    filterCompactRecordList(container);
  });
}

function filterCompactRecordList(container) {
  if (typeof container === "string") container = $(container);
  if (!container) return;
  const input = document.querySelector(`[data-list-search="${container.id}"]`);
  const query = (input?.value || "").trim().toLowerCase();
  const rows = Array.from(container.querySelectorAll(":scope > .compact-record-row"));
  let visible = 0;
  rows.forEach(row => {
    const matches = !query || (row.dataset.compactSearch || "").includes(query);
    row.classList.toggle("hidden", !matches);
    if (matches) visible++;
  });
  const noMatch = container.querySelector(":scope > .compact-search-empty");
  noMatch?.classList.toggle("hidden", !query || !rows.length || visible > 0);
}

/* ---------------- DASHBOARD & RENEWAL REMINDERS ---------------- */

function renderDashboard() {
  $("stat-properties").textContent = state.properties.length;
  $("stat-owners").textContent = state.owners.length;
  $("stat-units").textContent = state.units.length;

  const recent = state.properties.slice(0, 5);
  $("recent-properties").innerHTML = recent.length
    ? recent.map(p => `
      <div class="record-card">
        <h3>${esc(p.property_name)}</h3>
        <p>${esc(p.address)}, ${esc(p.city || "")}</p>
        <span class="pill">${esc(p.management_type)}</span>
      </div>`).join("")
    : '<p class="empty">No properties recorded yet.</p>';

  checkRenewalReminders();
}

/* Renewal logic: Check if any active tenancy expires within 60 days (2 months) */
function checkRenewalReminders() {
  const container = $("renewal-alerts-container");
  if (!container) return;

  const today = new Date();
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(today.getDate() + 60);

  const expiringSoon = state.tenancies.filter(t => {
    if (t.status !== "active" || !t.end_date) return false;
    const endDate = new Date(t.end_date);
    return endDate >= today && endDate <= sixtyDaysFromNow;
  });

  if (expiringSoon.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="panel" style="border-left: 5px solid #f59e0b; background: #fffbeb; margin-bottom: 20px;">
      <p class="eyebrow" style="color: #d97706;">RENEWAL ALERTS (${expiringSoon.length})</p>
      <h3 style="font-size: 16px; margin-bottom: 8px;">Tenancies Expiring Within 2 Months</h3>
      <ul style="padding-left: 18px; font-size: 13px; color: #78350f;">
        ${expiringSoon.map(t => {
          const unit = state.units.find(u => u.id === t.unit_id);
          const tenant = state.tenants.find(x => x.id === t.tenant_id);
          const prop = state.properties.find(p => p.id === unit?.property_id);
          return `<li><b>${esc(tenant?.tenant_name || "Tenant")}</b> at ${esc(prop?.property_name || "")} / ${esc(unit?.unit_name || "")} expires on <b>${esc(t.end_date)}</b>. Prepare renewal or notice.</li>`;
        }).join("")}
      </ul>
    </div>`;
}

/* ---------------- PROPERTIES & UNITS ---------------- */

function renderProperties() {
  const term = ($("property-search")?.value || "").trim().toLowerCase();
  const filter = $("property-filter")?.value || "";

  const list = state.properties.filter(p => {
    const searchable = [p.property_name, p.address, p.city, p.state, p.postcode].join(" ").toLowerCase();
    return searchable.includes(term) && (!filter || p.management_type === filter);
  });

  $("properties-list").innerHTML = list.length
    ? list.map(p => `
      <article class="record-card">
        <h3>${esc(p.property_name)}</h3>
        <p>${esc(p.address)}, ${esc(p.city || "")} ${esc(p.postcode || "")}</p>
        <div class="record-meta">
          <span class="pill">${esc(p.management_type)}</span>
          <span class="pill">${esc(p.property_type)}</span>
          <span class="pill">${esc(p.status)}</span>
        </div>
        <p>Purchase price: ${money(p.purchase_price)}</p>
        <p>${esc(p.notes || "No notes")}</p>
        <div class="record-actions">
          <button data-edit-property="${p.id}">Edit</button>
          <button class="secondary" data-add-unit="${p.id}">Add unit</button>
          <button class="secondary" data-delete-property="${p.id}">Delete</button>
        </div>
      </article>`).join("")
    : '<div class="panel empty">No matching properties found.</div>';
}

function resetPropertyForm() {
  $("property-form").reset();
  $("property-id").value = "";
  $("property-form-title").textContent = "Add property";
  $("property-form-wrap").classList.add("hidden");
}

function editProperty(id) {
  const p = state.properties.find(x => x.id === id);
  if (!p) return;
  $("property-id").value = p.id;
  $("property-name").value = p.property_name;
  $("property-type").value = p.property_type;
  $("management-type").value = p.management_type;
  $("property-status").value = p.status;
  $("property-address").value = p.address;
  $("property-city").value = p.city || "";
  $("property-state").value = p.state || "";
  $("property-postcode").value = p.postcode || "";
  $("purchase-price").value = p.purchase_price ?? "";
  $("property-notes").value = p.notes || "";
  $("property-form-title").textContent = "Edit property";
  $("property-form-wrap").classList.remove("hidden");
  $("property-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveProperty(event) {
  event.preventDefault();
  const id = $("property-id").value;
  const record = {
    property_name: $("property-name").value.trim(),
    property_type: $("property-type").value,
    management_type: $("management-type").value,
    status: $("property-status").value,
    address: $("property-address").value.trim(),
    city: $("property-city").value.trim() || null,
    state: $("property-state").value.trim() || null,
    postcode: $("property-postcode").value.trim() || null,
    purchase_price: $("purchase-price").value === "" ? null : Number($("purchase-price").value),
    notes: $("property-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("properties").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("properties").insert(record).select().single());
    }
    resetPropertyForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteProperty(id) {
  if (!confirm("Delete this property? This will also remove its units and ownership links.")) return;
  try {
    await runQuery(db.from("properties").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- OWNERS ---------------- */

function renderOwners() {
  $("owners-list").innerHTML = state.owners.length
    ? state.owners.map(o => `
      <article class="record-card">
        <h3>${esc(o.owner_name)}</h3>
        <div class="record-meta"><span class="pill">${esc(o.owner_type)}</span></div>
        <p>Phone: ${esc(o.phone || "—")}</p>
        <p>Email: ${esc(o.email || "—")}</p>
        <p>${esc(o.mailing_address || "No mailing address")}</p>
        <p>${esc(o.notes || "")}</p>
        <div class="record-actions">
          <button data-edit-owner="${o.id}">Edit</button>
          <button class="secondary" data-delete-owner="${o.id}">Delete</button>
        </div>
      </article>`).join("")
    : '<div class="panel empty">No owners recorded yet.</div>';
}

function resetOwnerForm() {
  $("owner-form").reset();
  $("owner-id").value = "";
  $("owner-form-title").textContent = "Add owner";
  $("owner-form-wrap").classList.add("hidden");
}

function editOwner(id) {
  const o = state.owners.find(x => x.id === id);
  if (!o) return;
  $("owner-id").value = o.id;
  $("owner-name").value = o.owner_name;
  $("owner-type").value = o.owner_type;
  $("owner-identity-number").value = o.identity_number || "";
  $("owner-phone").value = o.phone || "";
  $("owner-email").value = o.email || "";
  $("owner-address").value = o.mailing_address || "";
  $("owner-bank-name").value = o.bank_name || "";
  $("owner-bank-account").value = o.bank_account || "";
  $("owner-notes").value = o.notes || "";
  $("owner-form-title").textContent = "Edit owner";
  $("owner-form-wrap").classList.remove("hidden");
  $("owner-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveOwner(event) {
  event.preventDefault();
  const id = $("owner-id").value;
  const record = {
    owner_name: $("owner-name").value.trim(),
    owner_type: $("owner-type").value,
    identity_number: $("owner-identity-number").value.trim() || null,
    phone: $("owner-phone").value.trim() || null,
    email: $("owner-email").value.trim() || null,
    mailing_address: $("owner-address").value.trim() || null,
    bank_name: $("owner-bank-name").value.trim() || null,
    bank_account: $("owner-bank-account").value.trim() || null,
    notes: $("owner-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("owners").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("owners").insert(record).select().single());
    }
    resetOwnerForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteOwner(id) {
  if (!confirm("Delete this owner?")) return;
  try {
    await runQuery(db.from("owners").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- UNITS ---------------- */

function populateSelects() {
  const propertyOptions = state.properties.map(p =>
    `<option value="${p.id}">${esc(p.property_name)}</option>`
  ).join("");

  const ownerOptions = state.owners.map(o =>
    `<option value="${o.id}">${esc(o.owner_name)}</option>`
  ).join("");

  const unitOptions = state.units.map(u => {
    const p = state.properties.find(x => x.id === u.property_id);
    return `<option value="${u.id}">${esc(p?.property_name || "Unknown")} — ${esc(u.unit_name)}</option>`;
  }).join("");

  const tenantOptions = state.tenants.map(t =>
    `<option value="${t.id}">${esc(t.tenant_name)}</option>`
  ).join("");

  const tenancyOptions = state.tenancies.map(t => {
    const unit = state.units.find(u => u.id === t.unit_id);
    const tenant = state.tenants.find(x => x.id === t.tenant_id);
    const prop = state.properties.find(p => p.id === unit?.property_id);
    return `<option value="${t.id}">${esc(prop?.property_name || "")} / ${esc(unit?.unit_name || "")} — ${esc(tenant?.tenant_name || "")}</option>`;
  }).join("");

  if ($("unit-property")) $("unit-property").innerHTML = '<option value="">Select property</option>' + propertyOptions;
  if ($("link-property")) $("link-property").innerHTML = '<option value="">Select property</option>' + propertyOptions;
  if ($("link-owner")) $("link-owner").innerHTML = '<option value="">Select owner</option>' + ownerOptions;
  if ($("tenancy-unit")) $("tenancy-unit").innerHTML = '<option value="">Select unit</option>' + unitOptions;
  if ($("tenancy-tenant")) $("tenancy-tenant").innerHTML = '<option value="">Select tenant</option>' + tenantOptions;
  if ($("agreement-tenancy")) $("agreement-tenancy").innerHTML = '<option value="">Select tenancy</option>' + tenancyOptions;
  if ($("deposit-package-tenancy")) $("deposit-package-tenancy").innerHTML = '<option value="">Select tenancy</option>' + tenancyOptions;
  if ($("booking-unit")) $("booking-unit").innerHTML = '<option value="">Select unit</option>' + unitOptions;
  if ($("booking-tenant")) $("booking-tenant").innerHTML = '<option value="">Select guest</option>' + tenantOptions;
  if ($("deposit-tenancy")) $("deposit-tenancy").innerHTML = '<option value="">Select tenancy</option>' + tenancyOptions;
  if ($("sale-property")) $("sale-property").innerHTML = '<option value="">Select property</option>' + propertyOptions;
  if ($("finance-property")) $("finance-property").innerHTML = '<option value="">Select property</option>' + propertyOptions;
  if ($("maint-unit")) $("maint-unit").innerHTML = '<option value="">Select unit</option>' + unitOptions;
  if ($("maint-tenant")) $("maint-tenant").innerHTML = '<option value="">Select tenant (optional)</option>' + tenantOptions;
}

function renderUnits() {
  $("units-list").innerHTML = state.units.length
    ? state.units.map(u => {
      const p = state.properties.find(x => x.id === u.property_id);
      return `
        <article class="record-card">
          <h3>${esc(u.unit_name)}</h3>
          <p>Property: ${esc(p?.property_name || "Unknown property")}</p>
          <div class="record-meta">
            <span class="pill">${esc(u.unit_type)}</span>
            <span class="pill">${esc(u.status)}</span>
          </div>
          <p>Floor area: ${u.floor_area_sqm == null ? "—" : esc(u.floor_area_sqm) + " m²"}</p>
          <p>${esc(u.notes || "")}</p>
          <div class="record-actions">
            <button data-edit-unit="${u.id}">Edit</button>
            <button class="secondary" data-delete-unit="${u.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No units recorded yet.</div>';
}

function resetUnitForm() {
  $("unit-form").reset();
  $("unit-id").value = "";
  $("unit-form-title").textContent = "Add unit";
  $("unit-form-wrap").classList.add("hidden");
}

function openUnitForm(id = "", propertyId = "") {
  if (!state.properties.length) {
    message("app-message", "Add a property before creating a unit.", "error");
    return;
  }
  resetUnitForm();
  $("unit-property").value = propertyId || state.properties[0].id;
  if (id) {
    const u = state.units.find(x => x.id === id);
    if (!u) return;
    $("unit-id").value = u.id;
    $("unit-property").value = u.property_id;
    $("unit-name").value = u.unit_name;
    $("unit-type").value = u.unit_type;
    $("unit-status").value = u.status;
    $("unit-area").value = u.floor_area_sqm ?? "";
    $("unit-notes").value = u.notes || "";
    $("unit-form-title").textContent = "Edit unit";
  }
  $("unit-form-wrap").classList.remove("hidden");
  $("unit-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveUnit(event) {
  event.preventDefault();
  const id = $("unit-id").value;
  const record = {
    property_id: $("unit-property").value,
    unit_name: $("unit-name").value.trim(),
    unit_type: $("unit-type").value,
    status: $("unit-status").value,
    floor_area_sqm: $("unit-area").value === "" ? null : Number($("unit-area").value),
    notes: $("unit-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("rentable_units").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("rentable_units").insert(record).select().single());
    }
    resetUnitForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteUnit(id) {
  if (!confirm("Delete this unit?")) return;
  try {
    await runQuery(db.from("rentable_units").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- OWNERSHIP LINKS ---------------- */

function renderLinks() {
  $("links-list").innerHTML = state.links.length
    ? state.links.map(link => {
      const p = state.properties.find(x => x.id === link.property_id);
      const o = state.owners.find(x => x.id === link.owner_id);
      return `
        <article class="record-card">
          <h3>${esc(p?.property_name || "Unknown property")}</h3>
          <p>Owner / client: ${esc(o?.owner_name || "Unknown owner")}</p>
          <div class="record-meta">
            <span class="pill">${esc(link.relationship_type)}</span>
            <span class="pill">${link.ownership_percentage == null ? "Share not specified" : esc(link.ownership_percentage) + "%"}</span>
          </div>
          <p>${esc(link.notes || "")}</p>
          <div class="record-actions">
            <button data-edit-link="${link.id}">Edit</button>
            <button class="secondary" data-delete-link="${link.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No ownership links yet.</div>';
}

function openLinkForm(id = "") {
  if (!state.properties.length || !state.owners.length) {
    message("app-message", "Create at least one property and one owner first.", "error");
    return;
  }
  $("link-form").reset();
  populateSelects();
  if (id) {
    const link = state.links.find(x => x.id === id);
    if (!link) return;
    $("link-property").value = link.property_id;
    $("link-owner").value = link.owner_id;
    $("link-relationship").value = link.relationship_type;
    $("link-share").value = link.ownership_percentage ?? "";
    $("link-notes").value = link.notes || "";
    $("link-form").dataset.editId = id;
  } else {
    delete $("link-form").dataset.editId;
  }
  $("link-form-wrap").classList.remove("hidden");
  $("link-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveLink(event) {
  event.preventDefault();
  const share = $("link-share").value;
  const record = {
    property_id: $("link-property").value,
    owner_id: $("link-owner").value,
    relationship_type: $("link-relationship").value,
    ownership_percentage: share === "" ? null : Number(share),
    notes: $("link-notes").value.trim() || null
  };
  const editId = $("link-form").dataset.editId;
  try {
    if (editId) {
      await runQuery(db.from("property_owners").update(record).eq("id", editId).select().single());
    } else {
      await runQuery(db.from("property_owners").insert(record).select().single());
    }
    $("link-form").reset();
    delete $("link-form").dataset.editId;
    $("link-form-wrap").classList.add("hidden");
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteLink(id) {
  if (!confirm("Delete this ownership link?")) return;
  try {
    await runQuery(db.from("property_owners").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- TENANTS ---------------- */

function renderTenants() {
  $("tenants-list").innerHTML = state.tenants.length
    ? state.tenants.map(t => `
      <article class="record-card">
        <h3>${esc(t.tenant_name)}</h3>
        <div class="record-meta"><span class="pill">${esc(t.tenant_type)}</span></div>
        <p>Phone: ${esc(t.phone || "—")}</p>
        <p>Email: ${esc(t.email || "—")}</p>
        <p>IC/Passport: ${esc(t.ic_or_passport || "—")}</p>
        <p>${esc(t.mailing_address || "")}</p>
        <p>${esc(t.notes || "")}</p>
        <div class="record-actions">
          <button data-edit-tenant="${t.id}">Edit</button>
          <button class="secondary" data-add-tenancy-for="${t.id}">Add tenancy</button>
          <button class="secondary" data-delete-tenant="${t.id}">Delete</button>
        </div>
      </article>`).join("")
    : '<div class="panel empty">No tenants recorded yet.</div>';
}

function resetTenantForm() {
  $("tenant-form").reset();
  $("tenant-id").value = "";
  $("tenant-form-title").textContent = "Add tenant";
  $("tenant-form-wrap").classList.add("hidden");
}

function editTenant(id) {
  const t = state.tenants.find(x => x.id === id);
  if (!t) return;
  $("tenant-id").value = t.id;
  $("tenant-name").value = t.tenant_name;
  $("tenant-type").value = t.tenant_type;
  $("tenant-phone").value = t.phone || "";
  $("tenant-email").value = t.email || "";
  $("tenant-ic").value = t.ic_or_passport || "";
  $("tenant-address").value = t.mailing_address || "";
  $("tenant-notes").value = t.notes || "";
  $("tenant-form-title").textContent = "Edit tenant";
  $("tenant-form-wrap").classList.remove("hidden");
  $("tenant-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveTenant(event) {
  event.preventDefault();
  const id = $("tenant-id").value;
  const record = {
    tenant_name: $("tenant-name").value.trim(),
    tenant_type: $("tenant-type").value,
    phone: $("tenant-phone").value.trim() || null,
    email: $("tenant-email").value.trim() || null,
    ic_or_passport: $("tenant-ic").value.trim() || null,
    mailing_address: $("tenant-address").value.trim() || null,
    notes: $("tenant-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("tenants").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("tenants").insert(record).select().single());
    }
    resetTenantForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteTenant(id) {
  if (!confirm("Delete this tenant?")) return;
  try {
    await runQuery(db.from("tenants").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- LONG-TERM TENANCIES ---------------- */

function renderTenancies() {
  $("tenancies-list").innerHTML = state.tenancies.length
    ? state.tenancies.map(t => {
      const unit = state.units.find(u => u.id === t.unit_id);
      const tenant = state.tenants.find(x => x.id === t.tenant_id);
      const prop = state.properties.find(p => p.id === unit?.property_id);
      return `
        <article class="record-card">
          <h3>${esc(tenant?.tenant_name || "Unknown tenant")}</h3>
          <p>${esc(prop?.property_name || "")} — ${esc(unit?.unit_name || "Unknown unit")}</p>
          <div class="record-meta">
            <span class="pill">${esc(t.status)}</span>
            <span class="pill">${money(t.monthly_rent)} / month</span>
          </div>
          <p>Start: ${esc(t.start_date)} ${t.end_date ? "→ " + esc(t.end_date) : "(open)"}</p>
          <p>Rent due day: ${esc(t.rent_due_day)}</p>
          <p>${esc(t.notes || "")}</p>
          <div class="record-actions">
            <button data-edit-tenancy="${t.id}">Edit</button>
            <button class="secondary" data-generate-agreement-for="${t.id}">Generate Agreement</button>
            <button class="secondary" data-delete-tenancy="${t.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No long-term tenancies recorded yet.</div>';
}

function resetTenancyForm() {
  $("tenancy-form").reset();
  $("tenancy-id").value = "";
  $("tenancy-form-title").textContent = "Add tenancy";
  $("tenancy-form-wrap").classList.add("hidden");
}

function openTenancyForm(id = "", tenantId = "") {
  if (!state.units.length || !state.tenants.length) {
    message("app-message", "Create at least one unit and one tenant first.", "error");
    return;
  }
  resetTenancyForm();
  populateSelects();
  if (id) {
    const t = state.tenancies.find(x => x.id === id);
    if (!t) return;
    $("tenancy-id").value = t.id;
    $("tenancy-unit").value = t.unit_id;
    $("tenancy-tenant").value = t.tenant_id;
    $("tenancy-start").value = t.start_date;
    $("tenancy-end").value = t.end_date || "";
    $("tenancy-rent").value = t.monthly_rent;
    $("tenancy-due-day").value = t.rent_due_day || 1;
    $("tenancy-status").value = t.status;
    $("tenancy-notes").value = t.notes || "";
    $("tenancy-form-title").textContent = "Edit tenancy";
  } else if (tenantId && state.tenants.some(tenant => tenant.id === tenantId)) {
    $("tenancy-tenant").value = tenantId;
  }
  $("tenancy-form-wrap").classList.remove("hidden");
  $("tenancy-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveTenancy(event) {
  event.preventDefault();
  const id = $("tenancy-id").value;
  const record = {
    unit_id: $("tenancy-unit").value,
    tenant_id: $("tenancy-tenant").value,
    start_date: $("tenancy-start").value,
    end_date: $("tenancy-end").value || null,
    monthly_rent: Number($("tenancy-rent").value),
    rent_due_day: Number($("tenancy-due-day").value) || 1,
    status: $("tenancy-status").value,
    notes: $("tenancy-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("tenancies").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("tenancies").insert(record).select().single());
    }
    resetTenancyForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}
async function deleteTenancy(id) {
  if (!confirm("Delete this tenancy?")) return;
  try {
    await runQuery(db.from("tenancies").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- TENANCY AGREEMENTS & WORD TEMPLATE ---------------- */

const AGREEMENT_BUCKET = "tenancy-documents";
const AGREEMENT_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const signaturePads = {};

function setupSignaturePads() {
  ["landlord", "tenant", "witness"].forEach(party => {
    const canvas = $(`${party}-sign-pad`);
    if (!canvas || signaturePads[party]) return;
    canvas.width = 720;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    const pad = signaturePads[party] = { canvas, ctx, hasInk: false, drawing: false };
    canvas.addEventListener("pointerdown", event => {
      if (canvas.dataset.readonly === "true") return;
      pad.drawing = true;
      canvas.setPointerCapture(event.pointerId);
      const point = signaturePoint(canvas, event);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + 0.1, point.y + 0.1);
      ctx.stroke();
      pad.hasInk = true;
    });
    canvas.addEventListener("pointermove", event => {
      if (!pad.drawing) return;
      const point = signaturePoint(canvas, event);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    });
    const stopDrawing = () => { pad.drawing = false; };
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
  });
}

function signaturePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

function clearSignature(party) {
  const pad = signaturePads[party];
  if (!pad) return;
  pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
  pad.hasInk = false;
}

function parseSavedSignature(value) {
  if (!value) return { name: "", image: "" };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") return { name: parsed.name || "", image: parsed.image || "" };
  } catch { /* Older agreements may contain a typed name. */ }
  return { name: String(value), image: "" };
}

function restoreSignature(party, imageData) {
  clearSignature(party);
  if (!imageData || !imageData.startsWith("data:image/png;base64,")) return;
  const pad = signaturePads[party];
  const image = new Image();
  image.onload = () => {
    pad.ctx.drawImage(image, 0, 0, pad.canvas.width, pad.canvas.height);
    pad.hasInk = true;
  };
  image.src = imageData;
}

function setAgreementTemplateStatus(text, type = "") {
  message("agreement-template-status", text, type);
}

function agreementStorageError(error) {
  const detail = error?.message || "Storage request failed.";
  return /bucket.*not found/i.test(detail)
    ? "The tenancy-documents bucket is missing. Run tenancy-agreement-storage.sql in the same Supabase project as this app."
    : detail;
}

async function currentUserId() {
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in again before managing agreement files.");
  return data.user.id;
}

async function loadAgreementTemplateInfo() {
  const status = $("agreement-template-status");
  if (!status || !db) return null;
  try {
    const userId = await currentUserId();
    const { data, error } = await db.storage.from(AGREEMENT_BUCKET).list(`${userId}/templates`, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" }
    });
    if (error) throw error;
    const versions = (data || [])
      .filter(file => file.name && file.name.toLowerCase().endsWith(".docx"))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    state.agreementTemplate = versions.length
      ? { path: `${userId}/templates/${versions[0].name}`, name: versions[0].name, createdAt: versions[0].created_at }
      : null;
    if (state.agreementTemplate) {
      const uploadedAt = state.agreementTemplate.createdAt
        ? ` · uploaded ${new Date(state.agreementTemplate.createdAt).toLocaleString()}`
        : "";
      setAgreementTemplateStatus(`Current template: ${state.agreementTemplate.name}${uploadedAt}`, "success");
    } else {
      setAgreementTemplateStatus("No Word template uploaded yet. Upload your .docx agreement to begin.");
    }
    return state.agreementTemplate;
  } catch (error) {
    state.agreementTemplate = null;
    setAgreementTemplateStatus(`Agreement storage is not ready: ${error.message}. Run tenancy-agreement-storage.sql in Supabase first.`, "error");
    return null;
  }
}

async function uploadAgreementTemplate(event) {
  event.preventDefault();
  const file = $("agreement-template-file").files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".docx")) {
    setAgreementTemplateStatus("Choose a Word .docx file.", "error");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setAgreementTemplateStatus("The template must be smaller than 20 MB.", "error");
    return;
  }
  try {
    const userId = await currentUserId();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${userId}/templates/${Date.now()}_${safeName}`;
    const { error } = await db.storage.from(AGREEMENT_BUCKET).upload(path, file, {
      contentType: AGREEMENT_DOCX_MIME,
      upsert: false
    });
    if (error) throw error;
    $("agreement-template-form").reset();
    await loadAgreementTemplateInfo();
    message("app-message", "Word agreement template uploaded as a new version.", "success");
  } catch (error) {
    setAgreementTemplateStatus(agreementStorageError(error), "error");
  }
}

function agreementContext(tenancyId) {
  const sameId = (left, right) => left != null && right != null && String(left) === String(right);
  const tenancy = state.tenancies.find(item => sameId(item.id, tenancyId));
  if (!tenancy) throw new Error("Select a valid tenancy.");
  const tenant = state.tenants.find(item => sameId(item.id, tenancy.tenant_id));
  const unit = state.units.find(item => sameId(item.id, tenancy.unit_id));
  const property = state.properties.find(item => sameId(item.id, unit?.property_id));
  const ownerLink = state.links.find(item => sameId(item.property_id, property?.id));
  const owner = state.owners.find(item => sameId(item.id, ownerLink?.owner_id));
  return { tenancy, tenant, unit, property, owner };
}

function missingAgreementSourceData(tenancyId) {
  const context = agreementContext(tenancyId);
  const missing = [];
  if (!context.owner) missing.push("link an owner to the property in Ownership Links");
  if (!context.owner?.identity_number || !context.owner?.bank_name || !context.owner?.bank_account || !context.owner?.mailing_address) {
    missing.push("complete the owner's ID, mailing address, and bank details in Owners");
  }
  if (!context.tenant?.ic_or_passport || !context.tenant?.mailing_address) {
    missing.push("complete the tenant's ID and mailing address in Tenants");
  }
  if (!context.property?.address || !context.unit?.unit_name) missing.push("complete the property and unit address in Properties");
  if (!context.tenancy.start_date || !context.tenancy.end_date || context.tenancy.monthly_rent == null) {
    missing.push("complete the tenancy dates and rent in Long-Term Tenancies");
  }
  const activeDeposits = state.deposits.filter(item => item.tenancy_id === tenancyId && !["fully_refunded", "forfeited"].includes(item.status));
  if (!activeDeposits.some(item => item.deposit_type === "security")) missing.push("record the security deposit in Deposits");
  if (!activeDeposits.some(item => item.deposit_type === "utility")) missing.push("record the utilities deposit in Deposits");
  return missing;
}

const AGREEMENT_SOURCE_TOKENS = new Set([
  "{{terms.start_date_formatted}}", "{{parties.landlord.name_at_signing}}", "{{parties.landlord.id_number}}",
  "{{parties.landlord.address_at_signing}}", "{{parties.landlord.bank_name}}", "{{parties.landlord.bank_account}}",
  "{{parties.tenant.name_at_signing}}", "{{parties.tenant.id_number}}", "{{parties.tenant.address_at_signing}}",
  "{{premises.unit_no}}", "{{premises.building_name}}", "{{premises.street_address}}", "{{premises.postcode_city_state}}",
  "{{premises.address_at_signing}}", "{{terms.start_date}}", "{{terms.end_date}}", "{{terms.monthly_rent}}",
  "{{terms.rent_due_day}}", "{{terms.term_text}}", "{{deposits.security}}", "{{deposits.utilities}}"
]);

function parseAgreementDate(value) {
  if (!value) return null;
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function longAgreementDate(value) {
  const date = parseAgreementDate(value);
  return date ? `${date.getDate()} ${date.toLocaleString("en-MY", { month: "long" }).toUpperCase()} ${date.getFullYear()}` : "";
}

function agreementSupplementalValues() {
  const tenancyId = $("agreement-tenancy")?.value;
  const context = tenancyId ? agreementContext(tenancyId) : null;
  const currentDeposits = state.deposits.filter(item => item.tenancy_id === tenancyId && !["fully_refunded", "forfeited"].includes(item.status));
  const latestDeposit = type => currentDeposits.filter(item => item.deposit_type === type)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  const securityDeposit = latestDeposit("security");
  const utilitiesDeposit = latestDeposit("utility");
  const propertyType = String(context?.property?.property_type || "").toLowerCase();
  const purpose = propertyType === "residential" ? "RESIDENTIAL"
    : ["commercial", "industrial"].includes(propertyType) ? "COMMERCIAL"
    : propertyType ? "OTHER" : "";
  return {
    landlordIc: context?.owner?.identity_number || "",
    bankName: context?.owner?.bank_name || "",
    bankAccount: context?.owner?.bank_account || "",
    securityDeposit: securityDeposit?.amount == null ? "" : Number(securityDeposit.amount).toFixed(2),
    utilitiesDeposit: utilitiesDeposit?.amount == null ? "" : Number(utilitiesDeposit.amount).toFixed(2),
    purpose,
    purposeOther: propertyType || "",
    specialConditions: "NONE",
    renewalEnabled: Boolean($("agreement-renewal-enabled")?.checked)
  };
}

function agreementTermText(startValue, endValue) {
  const start = parseAgreementDate(startValue);
  const end = parseAgreementDate(endValue);
  if (!start || !end || end < start) return "";
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (end.getDate() >= start.getDate()) months += 1;
  if (months <= 0) return `${Math.max(1, Math.ceil((end - start) / 86400000))} days`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return [years ? `${years} year${years === 1 ? "" : "s"}` : "", remainingMonths ? `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
}

function numberToWords(value) {
  const small = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const underThousand = number => {
    const parts = [];
    if (number >= 100) {
      parts.push(`${small[Math.floor(number / 100)]} hundred`);
      number %= 100;
    }
    if (number >= 20) {
      parts.push(tens[Math.floor(number / 10)] + (number % 10 ? `-${small[number % 10]}` : ""));
    } else if (number > 0) parts.push(small[number]);
    return parts.join(" ");
  };
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  if (amount === 0) return "zero";
  const groups = [[1_000_000_000, "billion"], [1_000_000, "million"], [1_000, "thousand"], [1, ""]];
  let remainder = amount;
  const words = [];
  for (const [scale, name] of groups) {
    const group = Math.floor(remainder / scale);
    if (group) {
      words.push(`${underThousand(group)}${name ? ` ${name}` : ""}`);
      remainder %= scale;
    }
  }
  return words.join(" ");
}

function amountInWords(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  const roundedCents = Math.round(amount * 100);
  const whole = Math.floor(roundedCents / 100);
  const cents = roundedCents % 100;
  return `${numberToWords(whole)}${cents ? ` and ${numberToWords(cents)} sen` : ""} only`;
}

function agreementTemplateValues(context, supplemental) {
  const { tenancy, tenant, unit, property, owner } = context;
  const fullAddress = [unit?.unit_name, property?.property_name, property?.address, property?.postcode, property?.city, property?.state, "Malaysia"].filter(Boolean).join(", ");
  return {
    "{{terms.start_date_formatted}}": longAgreementDate(tenancy.start_date),
    "{{parties.landlord.name_at_signing}}": owner?.owner_name || "",
    "{{parties.landlord.id_number}}": supplemental.landlordIc || "",
    "{{parties.landlord.address_at_signing}}": owner?.mailing_address || property?.address || "",
    "{{parties.landlord.bank_name}}": supplemental.bankName || "",
    "{{parties.landlord.bank_account}}": supplemental.bankAccount || "",
    "{{parties.tenant.name_at_signing}}": tenant?.tenant_name || "",
    "{{parties.tenant.id_number}}": tenant?.ic_or_passport || "",
    "{{parties.tenant.address_at_signing}}": tenant?.mailing_address || "",
    "{{premises.unit_no}}": unit?.unit_name || "",
    "{{premises.building_name}}": property?.property_name || "",
    "{{premises.street_address}}": property?.address || "",
    "{{premises.postcode_city_state}}": [property?.postcode, property?.city, property?.state, "Malaysia"].filter(Boolean).join(", "),
    "{{premises.address_at_signing}}": fullAddress,
    "{{terms.start_date}}": longAgreementDate(tenancy.start_date),
    "{{terms.end_date}}": longAgreementDate(tenancy.end_date),
    "{{terms.monthly_rent}}": tenancy.monthly_rent == null ? "" : Number(tenancy.monthly_rent).toFixed(2),
    "{{terms.rent_due_day}}": tenancy.rent_due_day ? String(tenancy.rent_due_day) : "",
    "{{terms.term_text}}": agreementTermText(tenancy.start_date, tenancy.end_date),
    "{{terms.landlord_capacity}}": owner ? "owner" : "",
    "{{terms.permitted_use}}": supplemental.purpose === "OTHER" ? supplemental.purposeOther : supplemental.purpose,
    "{{deposits.security}}": supplemental.securityDeposit,
    "{{deposits.utilities}}": supplemental.utilitiesDeposit,
    "{{deposits.additional_amount}}": "0.00",
    "{{deposits.additional_purpose}}": "None",
    "{{clauses.assignment_and_subletting}}": "not assign",
    "{{clauses.early_termination_text}}": "the rent for the remaining unexpired term of the tenancy",
    "{{clauses.early_termination_compensation}}": "the rent for the remaining unexpired term of the tenancy",
    "{{clauses.subletting_permission}}": "The Landlord does not grant",
    "{{clauses.restoration_grace_period}}": "fourteen (14) days",
    "{{renewal.term_text}}": supplemental.renewalEnabled ? "" : "No renewal option",
    "{{renewal.notice_months}}": supplemental.renewalEnabled ? "" : "N/A",
    "{{renewal.rent_text}}": supplemental.renewalEnabled ? "" : "N/A",
    "{{renewal.adjusted_security_deposit}}": supplemental.renewalEnabled ? "" : "N/A",
    "{{clauses.stamp_duty_payer}}": "Tenant"
  };
}

function agreementTokenReplacer(context, supplemental) {
  const { tenancy, tenant, unit, property, owner } = context;
  const now = new Date();
  const cityState = [property?.postcode, property?.city, property?.state, "Malaysia"].filter(Boolean).join(", ");
  return (token, paragraphContext = "", localParagraphText = paragraphContext) => {
    if (token.startsWith("{{") && token.endsWith("}}")) {
      const mapped = agreementTemplateValues(context, supplemental)[token];
      return mapped ? String(mapped) : token;
    }
    const key = token.toUpperCase().replace(/[–—]/g, "-");
    const nearby = paragraphContext.toLowerCase();
    const local = localParagraphText.toLowerCase();
    if (key === "[DAY]") return String(now.getDate());
    if (key === "[MONTH]") return now.toLocaleString("en-MY", { month: "long" });
    if (key === "[YEAR]") return String(now.getFullYear());
    if (key === "[LANDLORD FULL NAME]") return owner?.owner_name || token;
    if (key === "[NRIC / PASSPORT NO]") return supplemental.landlordIc || token;
    if (key === "[TENANT FULL NAME / COMPANY NAME]") return tenant?.tenant_name || token;
    if (key === "[NRIC / COMPANY NO]") return tenant?.ic_or_passport || token;
    if (key === "[LANDLORD CORRESPONDENCE ADDRESS]") return owner?.mailing_address || property?.address || token;
    if (key === "[TENANT CORRESPONDENCE ADDRESS]") return tenant?.mailing_address || token;
    if (key === "[BANK NAME]") return supplemental.bankName || token;
    if (key === "[ACCOUNT NUMBER]") return supplemental.bankAccount || token;
    if (key === "[EMAIL]") return nearby.includes("description of landlord") ? owner?.email || token : nearby.includes("description of tenant") ? tenant?.email || token : token;
    if (key === "[PHONE NUMBER]") return nearby.includes("description of landlord") ? owner?.phone || token : nearby.includes("description of tenant") ? tenant?.phone || token : token;
    if (key === "[UNIT NO. / BLOCK / FLOOR]" || key === "[UNIT NO.]" ) return unit?.unit_name || token;
    if (key === "[BUILDING / CONDOMINIUM / HOUSE NAME]" || key === "[BUILDING / CONDOMINIUM NAME]") return property?.property_name || token;
    if (key === "[STREET ADDRESS]") return property?.address || token;
    if (key === "[POSTCODE]") return property?.postcode || token;
    if (key === "[CITY]") return property?.city || token;
    if (key === "[STATE]") return property?.state || token;
    if (key === "[POSTCODE, CITY, STATE, MALAYSIA]") return cityState || token;
    if (key === "[DD MONTH YYYY]") {
      if (local.includes("commencement")) return longAgreementDate(tenancy.start_date) || token;
      if (local.includes("expiry")) return longAgreementDate(tenancy.end_date) || token;
      return token;
    }
    if (key === "[AMOUNT]" || key === "[AMOUNT IN WORDS]") {
      let amount = null;
      if (nearby.includes("monthly rental") || nearby.includes("section 8")) amount = tenancy.monthly_rent;
      else if (nearby.includes("security deposit") || nearby.includes("section 10")) amount = supplemental.securityDeposit;
      else if (nearby.includes("utilities deposit") || nearby.includes("section 11")) amount = supplemental.utilitiesDeposit;
      if (amount == null || amount === "") return token;
      return key === "[AMOUNT IN WORDS]" ? amountInWords(amount) : Number(amount).toFixed(2);
    }
    if (key === "[INSERT ANY FURTHER SPECIAL CONDITIONS HERE, OR STATE \"NONE\"]") return supplemental.specialConditions || "NONE";
    if (key.includes("RESIDENTIAL / COMMERCIAL / CO-LIVING / HOMESTAY")) {
      return supplemental.purpose === "OTHER" && supplemental.purposeOther
        ? `OTHER - ${supplemental.purposeOther}`
        : supplemental.purpose || token;
    }
    if (key === "[1ST TO 7TH / OTHER]") {
      const day = Number(tenancy.rent_due_day) || 1;
      return `${day}${day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"}`;
    }
    return token;
  };
}

function isAgreementInstructionToken(token) {
  const key = token.toLowerCase();
  return key === "[bracketed]" || key === "[red brackets]" || key === "[the remainder of this page is intentionally left blank]";
}

function hasDedicatedAgreementInput(token) {
  const key = token.toUpperCase();
  return ["[NRIC / PASSPORT NO]", "[BANK NAME]", "[ACCOUNT NUMBER]", "[AMOUNT]", "[AMOUNT IN WORDS]", "[INSERT ANY FURTHER SPECIAL CONDITIONS HERE, OR STATE \"NONE\"]"].includes(key)
    || key.includes("RESIDENTIAL / COMMERCIAL / CO-LIVING / HOMESTAY");
}

function paragraphTextNodes(paragraph) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, "t"));
}

function paragraphAgreementContext(paragraph) {
  let ancestor = paragraph.parentNode;
  while (ancestor && ancestor.localName !== "tr") ancestor = ancestor.parentNode;
  const source = ancestor || paragraph;
  return Array.from(source.getElementsByTagNameNS(WORD_NS, "t")).map(node => node.textContent).join("").replace(/\s+/g, " ").trim();
}

function agreementTokenKey(partName, paragraphIndex, tokenIndex) {
  return `${partName}:${paragraphIndex}:${tokenIndex}`;
}

function replaceWordParagraphToken(textNodes, start, end, replacement) {
  let offset = 0;
  let startNode = -1;
  let endNode = -1;
  let startOffset = 0;
  let endOffset = 0;
  for (let i = 0; i < textNodes.length; i++) {
    const length = textNodes[i].textContent.length;
    if (startNode < 0 && start <= offset + length) {
      startNode = i;
      startOffset = Math.max(0, start - offset);
    }
    if (endNode < 0 && end <= offset + length) {
      endNode = i;
      endOffset = end - offset;
      break;
    }
    offset += length;
  }
  if (startNode < 0 || endNode < 0) return;
  if (startNode === endNode) {
    const value = textNodes[startNode].textContent;
    textNodes[startNode].textContent = value.slice(0, startOffset) + replacement + value.slice(endOffset);
    return;
  }
  const firstText = textNodes[startNode].textContent;
  const lastText = textNodes[endNode].textContent;
  textNodes[startNode].textContent = firstText.slice(0, startOffset) + replacement;
  for (let i = startNode + 1; i < endNode; i++) textNodes[i].textContent = "";
  textNodes[endNode].textContent = lastText.slice(endOffset);
}

function replaceAgreementPhrase(xml, searchText, replacement) {
  const paragraphs = Array.from(xml.getElementsByTagNameNS(WORD_NS, "p"));
  paragraphs.forEach(paragraph => {
    const nodes = paragraphTextNodes(paragraph);
    const source = nodes.map(node => node.textContent).join("");
    const matches = Array.from(source.matchAll(new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")));
    matches.reverse().forEach(match => replaceWordParagraphToken(nodes, match.index, match.index + searchText.length, replacement));
  });
}

function replaceNthAgreementLabel(xml, label, value, occurrence = 0) {
  if (!value) return;
  const paragraphs = Array.from(xml.getElementsByTagNameNS(WORD_NS, "p"));
  const matches = paragraphs.filter(paragraph => paragraphTextNodes(paragraph).map(node => node.textContent).join("").trim().startsWith(label));
  const paragraph = matches[occurrence];
  if (!paragraph) return;
  const nodes = paragraphTextNodes(paragraph);
  const source = nodes.map(node => node.textContent).join("");
  const start = source.indexOf(label) + label.length;
  replaceWordParagraphToken(nodes, start, source.length, `: ${value}`);
}

function agreementExtraFieldLabel(token, paragraphContext) {
  if (token.startsWith("{{") && token.endsWith("}}")) {
    const labels = {
      "{{terms.landlord_capacity}}": "Landlord capacity (owner, beneficial owner, or authorised agent)",
      "{{terms.term_text}}": "Tenancy term",
      "{{deposits.additional_amount}}": "Additional deposit amount (enter 0 if none)",
      "{{deposits.additional_purpose}}": "Purpose of additional deposit (enter None if not applicable)",
      "{{renewal.term_text}}": "Renewal term",
      "{{renewal.notice_months}}": "Renewal notice period in months",
      "{{renewal.rent_text}}": "Rent for renewal term",
      "{{renewal.adjusted_security_deposit}}": "Adjusted security deposit for renewal",
      "{{clauses.assignment_and_subletting}}": "Assignment and sub-letting restriction",
      "{{clauses.early_termination_text}}": "Early termination amount / basis",
      "{{clauses.early_termination_compensation}}": "Early termination compensation terms",
      "{{clauses.subletting_permission}}": "Sub-letting / partitioning permission",
      "{{clauses.restoration_grace_period}}": "Restoration grace period"
    };
    return labels[token] || token.replace(/^\{\{|\}\}$/g, "").split(".").slice(-1)[0].replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
  }
  const key = token.toLowerCase();
  const context = paragraphContext.toLowerCase();
  if (key.includes("landlord grants / does not grant")) return "Sub-letting and partitioning permission";
  if (key.includes("not assign / may assign")) return "Assignment and sub-letting consent";
  if (key.includes("amount or")) return "Additional deposit amount, or N/A";
  if (key.includes("purpose,")) return "Additional deposit purpose";
  if (key.includes("amount in words")) {
    if (context.includes("security deposit")) return "Security deposit amount in words";
    if (context.includes("utilities deposit")) return "Utilities deposit amount in words";
    return "Monthly rent amount in words";
  }
  if (key.includes("if multi-tier")) return "Multi-tier rent details (optional)";
  if (key.includes("rm _____")) return "Adjusted security deposit for renewal";
  if (key.includes("tenant / landlord")) return "Who pays stamp duty";
  if (key.includes("to be agreed / increase")) return "Renewal rent";
  if (key.includes("e.g.")) {
    if (context.includes("liquidated damages") || context.includes("early termination")) return "Early termination compensation";
    if (context.includes("grace period")) return "Restoration grace period";
    if (context.includes("security deposit")) return "Security deposit basis";
    if (context.includes("utilities deposit")) return "Utilities deposit basis";
    if (context.includes("renewal option")) return "Renewal term or notice period";
    if (context.includes("term of tenancy")) return "Tenancy term";
  }
  return token.replace(/^\[|\]$/g, "");
}

function collectAgreementExtraValues() {
  return new Map(Array.from(document.querySelectorAll("[data-agreement-extra-key]"), input => [input.dataset.agreementExtraKey, input.value.trim()]));
}

function collectAgreementWitnessContacts() {
  return {
    name: $("agreement-witness-name").value.trim(),
    id_number: $("agreement-witness-id").value.trim(),
    phone: $("agreement-witness-phone").value.trim(),
    email: $("agreement-witness-email").value.trim(),
    agency_or_referral: $("agreement-witness-agency").value.trim()
  };
}

function parseAgreementData(agreement) {
  if (agreement?.agreement_data && typeof agreement.agreement_data === "object") return agreement.agreement_data;
  try { return JSON.parse(agreement?.agreement_data || "{}"); } catch { return {}; }
}

async function discoverAgreementExtraFields(templatePath, tenancyId) {
  if (!window.JSZip) throw new Error("The Word document library did not load. Refresh the page and try again.");
  const { data: templateBlob, error } = await db.storage.from(AGREEMENT_BUCKET).download(templatePath);
  if (error) throw error;
  const zip = await window.JSZip.loadAsync(templateBlob);
  const replacer = agreementTokenReplacer(agreementContext(tenancyId), agreementSupplementalValues());
  const fields = [];
  const xmlFiles = Object.keys(zip.files).filter(name => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(name));
  for (const name of xmlFiles) {
    const xml = new DOMParser().parseFromString(await zip.file(name).async("string"), "application/xml");
    const paragraphs = Array.from(xml.getElementsByTagNameNS(WORD_NS, "p"));
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const nodes = paragraphTextNodes(paragraph);
      const text = nodes.map(node => node.textContent).join("");
      const context = paragraphAgreementContext(paragraph);
      for (const match of text.matchAll(/\{\{[^}]+\}\}|\[[^\]]+\]/g)) {
        const token = match[0];
        if (isAgreementInstructionToken(token) || replacer(token, context, text) !== token || hasDedicatedAgreementInput(token) || AGREEMENT_SOURCE_TOKENS.has(token)) continue;
        const key = token.startsWith("{{") ? `token:${token}` : agreementTokenKey(name, paragraphIndex, match.index);
        if (!fields.some(field => field.key === key)) fields.push({
          key,
          token,
          label: agreementExtraFieldLabel(token, context),
          context: context.slice(0, 150),
          optional: token.toLowerCase().includes("if multi-tier") || token === "{{deposits.additional_amount}}" || token === "{{deposits.additional_purpose}}"
        });
      }
    });
  }
  return fields;
}

async function refreshAgreementExtraFields() {
  const wrap = $("agreement-extra-fields");
  const list = $("agreement-extra-fields-list");
  const tenancyId = $("agreement-tenancy").value;
  const template = state.agreementTemplate || await loadAgreementTemplateInfo();
  if (!wrap || !list || !tenancyId || !template) return;
  try {
    const missingSources = missingAgreementSourceData(tenancyId);
    $("agreement-autofill-summary").textContent = "Tenant, owner, property, tenancy, and deposits are picked up from their existing records." +
      (missingSources.length ? ` Before drafting, update: ${missingSources.join("; ")}.` : "");
    const fields = await discoverAgreementExtraFields(template.path, tenancyId);
    list.innerHTML = fields.map(field => `
      <label class="agreement-extra-field">
        <span>${esc(field.label)}${field.optional ? "" : " *"}</span>
        <small>${field.context ? esc(field.context) : `Template field: ${esc(field.token)}`}</small>
        ${field.optional
          ? `<textarea data-agreement-extra-key="${esc(field.key)}" rows="2" placeholder="Leave blank if not applicable"></textarea>`
          : `<input data-agreement-extra-key="${esc(field.key)}" required>`}
      </label>`).join("");
    wrap.classList.toggle("hidden", fields.length === 0);
  } catch (error) {
    wrap.classList.remove("hidden");
    list.innerHTML = `<p class="message error">Could not read the template fields: ${esc(error.message)}</p>`;
  }
}

function replaceSecondScheduleWithPhotoReport(xml) {
  const tables = Array.from(xml.getElementsByTagNameNS(WORD_NS, "tbl"));
  const inventory = tables.find(table => {
    const text = Array.from(table.getElementsByTagNameNS(WORD_NS, "t")).map(node => node.textContent).join(" ").toLowerCase();
    return text.includes("condition / brand") && text.includes("photo ref.");
  });
  if (!inventory) return;
  const rows = Array.from(inventory.getElementsByTagNameNS(WORD_NS, "tr"));
  if (!rows.length) return;
  const headings = ["Area / Room", "Photo Record", "Visible Condition", "Date Uploaded", "Notes"];
  const headerCells = Array.from(rows[0].getElementsByTagNameNS(WORD_NS, "tc"));
  headings.forEach((heading, index) => {
    const textNodes = Array.from(headerCells[index]?.getElementsByTagNameNS(WORD_NS, "t") || []);
    textNodes.forEach((textNode, nodeIndex) => { textNode.textContent = nodeIndex === 0 ? heading : ""; });
  });
  const areas = ["Entrance", "Living area", "Kitchen", "Bedroom 1", "Bedroom 2", "Bathroom", "Balcony", "Other"];
  rows.slice(1).forEach((row, index) => {
    const cells = Array.from(row.getElementsByTagNameNS(WORD_NS, "tc"));
    cells.forEach((cell, cellIndex) => {
      const textNodes = Array.from(cell.getElementsByTagNameNS(WORD_NS, "t"));
      textNodes.forEach((node, nodeIndex) => { node.textContent = nodeIndex === 0 && cellIndex === 0 ? (areas[index] || "") : ""; });
    });
  });
  replaceAgreementPhrase(xml, "LIST OF FITTINGS, FIXTURES AND INVENTORY", "ROOM CONDITION PHOTOS");
  replaceAgreementPhrase(xml, "Both parties should jointly inspect the Said Premises at the commencement of the tenancy and complete this inventory together with photographs.", "Both parties should jointly inspect the Said Premises at handover and record dated photos by room or area in the Room Condition Photos section of this agreement.");
  replaceAgreementPhrase(xml, "The condition of each item should be noted as \"Good\", \"Fair\", \"Damaged\" or similar, with remarks where necessary.", "Label each photo with its room or area and note any visible damage or wear where necessary.");
  replaceAgreementPhrase(xml, "Additional rows may be added as required. Attach separate sheets if necessary.", "Upload additional photos for any other room or area in the app under this agreement.");
  replaceAgreementPhrase(xml, "Both parties should sign and date this Second Schedule upon completion of the inventory check.", "Both parties should review and sign this Second Schedule after completing the room condition photo record.");
  replaceAgreementPhrase(xml, "Always attach a completed inventory (Second Schedule) with dated photographs of the condition of the premises at handover. This is critical evidence for deposit deductions later.", "Complete the Second Schedule Room Condition Photos with dated photographs of each area at handover. This record supports later checks of the premises and deposit deductions.");
  replaceAgreementPhrase(xml, "fixtures, fittings and appliances listed in the Second Schedule (if any)", "fixtures, fittings and appliances (if any) shown in the Second Schedule Room Condition Photos");
  replaceAgreementPhrase(xml, "furnished with the fixtures and fittings (if any) as stated in the Second Schedule herein", "furnished with the fixtures and fittings (if any) shown in the Second Schedule Room Condition Photos");
}

async function createFilledWordDraft(templatePath, tenancyId) {
  if (!window.JSZip) throw new Error("The Word document library did not load. Refresh the page and try again.");
  const { data: templateBlob, error } = await db.storage.from(AGREEMENT_BUCKET).download(templatePath);
  if (error) throw error;
  const zip = await window.JSZip.loadAsync(templateBlob);
  const context = agreementContext(tenancyId);
  const supplemental = agreementSupplementalValues();
  const replaceToken = agreementTokenReplacer(context, supplemental);
  const extraValues = collectAgreementExtraValues();
  const unresolved = new Set();
  const xmlFiles = Object.keys(zip.files).filter(name => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(name));
  for (const name of xmlFiles) {
    const source = await zip.file(name).async("string");
    const xml = new DOMParser().parseFromString(source, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error(`Could not read the Word template section ${name}.`);
    const paragraphs = Array.from(xml.getElementsByTagNameNS(WORD_NS, "p"));
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const nodes = paragraphTextNodes(paragraph);
      const text = nodes.map(node => node.textContent).join("");
      const contextText = paragraphAgreementContext(paragraph);
      const matches = Array.from(text.matchAll(/\{\{[^}]+\}\}|\[[^\]]+\]/g));
      for (const match of matches.reverse()) {
        const token = match[0];
        const key = agreementTokenKey(name, paragraphIndex, match.index);
        let value = replaceToken(token, contextText, text);
        const inputKey = token.startsWith("{{") ? `token:${token}` : key;
        if (value === token && extraValues.has(inputKey)) value = extraValues.get(inputKey) || (token.toLowerCase().includes("if multi-tier") ? "" : token);
        if (value === token) {
          if (!isAgreementInstructionToken(token)) unresolved.add(token);
          continue;
        }
        replaceWordParagraphToken(nodes, match.index, match.index + token.length, value);
      }
    });
    if (name === "word/document.xml") replaceSecondScheduleWithPhotoReport(xml);
    if (name === "word/document.xml") {
      const contacts = collectAgreementWitnessContacts();
      replaceNthAgreementLabel(xml, "Witness Name", contacts.name);
      replaceNthAgreementLabel(xml, "Witness NRIC", contacts.id_number);
    }
    zip.file(name, new XMLSerializer().serializeToString(xml));
  }
  const blob = await zip.generateAsync({ type: "blob", mimeType: AGREEMENT_DOCX_MIME });
  return { blob, unresolved: Array.from(unresolved) };
}

function renderAgreements() {
  const container = $("agreements-list");
  if (!container) return;
  container.innerHTML = state.agreements.length
    ? state.agreements.map(agreement => {
      const tenancy = state.tenancies.find(item => item.id === agreement.tenancy_id);
      const tenant = state.tenants.find(item => item.id === tenancy?.tenant_id);
      const unit = state.units.find(item => item.id === tenancy?.unit_id);
      const property = state.properties.find(item => item.id === unit?.property_id);
      const isSigned = agreement.status === "signed";
      const isWordDraft = String(agreement.agreement_text || "").startsWith("Word template draft:");
      const landlordSignature = parseSavedSignature(agreement.landlord_signature);
      const tenantSignature = parseSavedSignature(agreement.tenant_signature);
      const witnessSignature = parseSavedSignature(agreement.witness_signature);
      const agreementData = parseAgreementData(agreement);
      const contacts = agreementData.contacts || {};
      const witness = contacts.witness || contacts.landlord || contacts.tenant || {};
      const searchable = [tenant?.tenant_name, property?.property_name, unit?.unit_name,
        ...Object.values(witness)].filter(Boolean).join(" ").toLowerCase();
      const contactSummary = witness.name
        ? `${witness.name}${witness.agency_or_referral ? ` · ${witness.agency_or_referral}` : ""}${witness.phone ? ` · ${witness.phone}` : ""}`
        : "";
      const signatureStatus = isSigned
        ? `Signed by ${landlordSignature.name || "landlord"}, ${tenantSignature.name || "tenant"}${witnessSignature.name ? ` and ${witnessSignature.name}` : ""}${agreement.signed_date ? ` · ${new Date(agreement.signed_date).toLocaleDateString()}` : ""}`
        : "Draft ready · signing not started";
      return `
        <article class="record-card" data-agreement-search="${esc(searchable)}">
          <h3>Tenancy Agreement: ${esc(tenant?.tenant_name || "Tenant")} (${esc(property?.property_name || "")}, ${esc(unit?.unit_name || "Unit")})</h3>
          <div class="record-meta">
            <span class="pill">${esc(String(agreement.status || "draft").toUpperCase())}</span>
            <span class="pill">Monthly Rent: ${money(tenancy?.monthly_rent)}</span>
          </div>
          <p><b>Signing:</b> ${esc(signatureStatus)}</p>
          ${contactSummary ? `<p><b>Witness / agent / referral:</b> ${esc(contactSummary)}</p>` : ""}
          <p>${esc(agreement.agreement_text || "Agreement draft")}</p>
          <div class="record-actions">
            ${isSigned ? `<button class="secondary" data-download-signed-agreement="${esc(agreement.id)}">Download signed agreement</button>` : ""}
            ${isWordDraft ? `<button class="secondary" data-download-agreement="${esc(agreement.id)}">Download Word draft</button>` : ""}
            ${isSigned ? `<button type="button" class="secondary" data-sign-agreement="${esc(agreement.id)}">View signatures</button>` : `<button type="button" class="secondary" data-sign-agreement="${esc(agreement.id)}">Sign agreement</button>`}
            <button class="secondary" data-photos-agreement="${esc(agreement.id)}">Room condition photos</button>
            <button class="secondary" data-delete-agreement="${esc(agreement.id)}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No tenancy agreements yet. Upload your Word template, then create an agreement from a tenancy.</div>';
  filterAgreementCards();
}

function filterAgreementCards() {
  const query = ($("agreement-search")?.value || "").trim().toLowerCase();
  document.querySelectorAll("[data-agreement-search]").forEach(card => {
    card.classList.toggle("hidden", query && !card.dataset.agreementSearch.includes(query));
  });
}

function agreementPhotoRoot(userId, agreementId) {
  return `${userId}/agreements/${agreementId}/photos`;
}

function safeAgreementPhotoArea(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "other-area";
}

async function listAgreementPhotoPaths(agreementId) {
  const userId = await currentUserId();
  const root = agreementPhotoRoot(userId, agreementId);
  const { data: areas, error: areaError } = await db.storage.from(AGREEMENT_BUCKET).list(root, { limit: 100 });
  if (areaError) throw areaError;
  const paths = [];
  for (const area of (areas || []).filter(item => !item.id)) {
    const { data: files, error } = await db.storage.from(AGREEMENT_BUCKET).list(`${root}/${area.name}`, { limit: 100 });
    if (error) throw error;
    (files || []).filter(file => file.id && file.name).forEach(file => paths.push(`${root}/${area.name}/${file.name}`));
  }
  return paths;
}

async function openAgreementPhotosPanel(agreementId) {
  const agreement = state.agreements.find(item => item.id === agreementId);
  if (!agreement) return;
  const { tenant, unit, property } = agreementContext(agreement.tenancy_id);
  $("agreement-photos-panel").dataset.agreementId = agreementId;
  $("agreement-photos-info").textContent = `Photos for ${tenant?.tenant_name || "tenant"} · ${property?.property_name || "property"} / ${unit?.unit_name || "unit"}.`;
  $("agreement-photo-form").reset();
  $("agreement-photo-status").textContent = "";
  $("signing-panel").classList.add("hidden");
  $("agreement-photos-panel").classList.remove("hidden");
  $("agreement-photos-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  await loadAgreementPhotos(agreementId);
}

async function loadAgreementPhotos(agreementId) {
  const grid = $("agreement-photos-grid");
  if (!grid) return;
  grid.innerHTML = '<p class="empty">Loading photos…</p>';
  try {
    const userId = await currentUserId();
    const root = agreementPhotoRoot(userId, agreementId);
    const { data: areas, error: areaError } = await db.storage.from(AGREEMENT_BUCKET).list(root, { limit: 100 });
    if (areaError) throw areaError;
    const cards = [];
    for (const area of (areas || []).filter(item => !item.id)) {
      const { data: files, error } = await db.storage.from(AGREEMENT_BUCKET).list(`${root}/${area.name}`, { limit: 100 });
      if (error) throw error;
      for (const file of (files || []).filter(item => item.id && item.name)) {
        const path = `${root}/${area.name}/${file.name}`;
        const { data: signed, error: signedError } = await db.storage.from(AGREEMENT_BUCKET).createSignedUrl(path, 3600);
        if (signedError) throw signedError;
        const areaLabel = area.name.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
        cards.push(`<article class="agreement-photo-card">
          <a href="${esc(signed.signedUrl)}" target="_blank" rel="noopener"><img src="${esc(signed.signedUrl)}" alt="${esc(areaLabel)} condition photo" loading="lazy"></a>
          <div><strong>${esc(areaLabel)}</strong><small>${esc(file.name.replace(/^\d+_\d+_/, ""))}</small>
            <button type="button" class="secondary" data-delete-agreement-photo="${esc(path)}">Remove photo</button></div>
        </article>`);
      }
    }
    grid.innerHTML = cards.length ? cards.join("") : '<p class="empty">No condition photos uploaded for this agreement yet.</p>';
  } catch (error) {
    grid.innerHTML = `<p class="message error">Could not load photos: ${esc(error.message)}</p>`;
  }
}

async function uploadAgreementPhoto(event) {
  event.preventDefault();
  const agreementId = $("agreement-photos-panel").dataset.agreementId;
  const area = $("agreement-photo-area").value.trim();
  const files = Array.from($("agreement-photo-file").files || []);
  if (!agreementId || !area || !files.length) return;
  if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
    message("agreement-photo-status", "Choose a JPG, PNG, or WebP photo.", "error");
    return;
  }
  if (files.some(file => file.size > 20 * 1024 * 1024)) {
    message("agreement-photo-status", "Each photo must be smaller than 20 MB.", "error");
    return;
  }
  try {
    const userId = await currentUserId();
    const areaFolder = safeAgreementPhotoArea(area);
    for (const [index, file] of files.entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${agreementPhotoRoot(userId, agreementId)}/${areaFolder}/${Date.now()}_${index}_${safeName}`;
      const { error } = await db.storage.from(AGREEMENT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
    }
    $("agreement-photo-status").textContent = `${files.length} photo(s) uploaded under ${area}.`;
    $("agreement-photo-file").value = "";
    await loadAgreementPhotos(agreementId);
  } catch (error) {
    message("agreement-photo-status", agreementStorageError(error), "error");
  }
}

async function deleteAgreementPhoto(path) {
  if (!confirm("Remove this condition photo from the agreement?")) return;
  try {
    const { error } = await db.storage.from(AGREEMENT_BUCKET).remove([path]);
    if (error) throw error;
    await loadAgreementPhotos($("agreement-photos-panel").dataset.agreementId);
  } catch (error) {
    message("agreement-photo-status", error.message || "Photo could not be removed.", "error");
  }
}

async function openAgreementForm(tenancyId = "") {
  if (!state.tenancies.length) {
    message("app-message", "Create a long-term tenancy first before generating agreements.", "error");
    return;
  }
  populateSelects();
  $("agreement-form").reset();
  $("agreement-id").value = "";
  $("agreement-renewal-enabled").checked = false;
  if (tenancyId) $("agreement-tenancy").value = tenancyId;
  await loadAgreementTemplateInfo();
  await refreshAgreementExtraFields();
  $("agreement-form-wrap").classList.remove("hidden");
  $("agreement-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveAgreement(event) {
  event.preventDefault();
  const tenancyId = $("agreement-tenancy").value;
  const template = state.agreementTemplate || await loadAgreementTemplateInfo();
  if (!template) {
    message("app-message", "Upload a Word agreement template before creating a draft.", "error");
    return;
  }
  const missingSourceData = missingAgreementSourceData(tenancyId);
  if (missingSourceData.length) {
    message("agreement-autofill-summary", `Update the existing records first: ${missingSourceData.join("; ")}. Then create the agreement again.`, "error");
    $("agreement-autofill-summary").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  try {
    const context = agreementContext(tenancyId);
    const { blob, unresolved } = await createFilledWordDraft(template.path, tenancyId);
    const supplemental = agreementSupplementalValues();
    const formFields = Object.fromEntries(collectAgreementExtraValues());
    const contacts = collectAgreementWitnessContacts();
    const { data: created, error } = await db.from("tenancy_agreements").insert({
      tenancy_id: tenancyId,
      agreement_text: `Word template draft: ${template.name}. Complete the agreement details in the app and keep room condition photos with this tenancy agreement.`,
      agreement_data: {
        template_name: template.name,
        created_at: new Date().toISOString(),
        supplemental,
        template_fields: formFields,
        contacts
      },
      status: "draft"
    }).select().single();
    if (error) throw error;
    const userId = await currentUserId();
    const path = `${userId}/agreements/${created.id}/draft.docx`;
    const { error: uploadError } = await db.storage.from(AGREEMENT_BUCKET).upload(path, blob, {
      contentType: AGREEMENT_DOCX_MIME,
      upsert: true
    });
    if (uploadError) {
      await db.from("tenancy_agreements").delete().eq("id", created.id);
      throw uploadError;
    }
    $("agreement-form-wrap").classList.add("hidden");
    await loadAll();
    const details = `${context.tenant?.tenant_name || "Tenant"} · ${context.property?.property_name || "Property"} / ${context.unit?.unit_name || "Unit"}`;
    const warning = unresolved.length ? ` ${unresolved.length} bracketed template field(s) still need review.` : "";
    message("app-message", `Word draft created for ${details}.${warning}`, unresolved.length ? "" : "success");
  } catch (error) {
    reportError(error);
  }
}

async function downloadAgreementFile(agreementId, kind) {
  try {
    const userId = await currentUserId();
    const path = `${userId}/agreements/${agreementId}/${kind}.docx`;
    let { data, error } = await db.storage.from(AGREEMENT_BUCKET).download(path);
    if (error && kind === "signed") {
      const agreement = state.agreements.find(item => item.id === agreementId);
      const signatures = {
        landlord: parseSavedSignature(agreement?.landlord_signature),
        tenant: parseSavedSignature(agreement?.tenant_signature),
        witness: parseSavedSignature(agreement?.witness_signature)
      };
      if (!signatures.landlord.image || !signatures.tenant.image || !signatures.witness.image) {
        throw new Error("This older agreement has no saved signature images to place in its Word file. Its stored signature record is still available to view.");
      }
      const signedAt = agreement.signed_date || new Date().toISOString();
      data = await createSignedAgreementDocx(agreementId, signatures, signedAt);
      const { error: uploadError } = await db.storage.from(AGREEMENT_BUCKET).upload(path, data, {
        contentType: AGREEMENT_DOCX_MIME,
        upsert: true
      });
      if (uploadError) throw uploadError;
    } else if (error) {
      throw error;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tenancy-agreement-${kind}-${agreementId}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    reportError(error);
  }
}

function downloadAgreementDraft(agreementId) {
  return downloadAgreementFile(agreementId, "draft");
}

function downloadSignedAgreement(agreementId) {
  return downloadAgreementFile(agreementId, "signed");
}

function openSigningPanel(agreementId) {
  const agreement = state.agreements.find(item => String(item.id) === String(agreementId));
  if (!agreement) return;
  $("agreement-photos-panel").classList.add("hidden");
  setupSignaturePads();
  let context = {};
  let contextError = "";
  try {
    context = agreementContext(agreement.tenancy_id);
  } catch (error) {
    contextError = error.message || "The linked tenancy could not be loaded.";
  }
  const { tenant, owner } = context;
  const landlordSignature = parseSavedSignature(agreement.landlord_signature);
  const tenantSignature = parseSavedSignature(agreement.tenant_signature);
  const witnessSignature = parseSavedSignature(agreement.witness_signature);
  const savedContacts = parseAgreementData(agreement).contacts || {};
  const witnessContact = savedContacts.witness || savedContacts.landlord || savedContacts.tenant || {};
  $("landlord-sign-name").value = landlordSignature.name || owner?.owner_name || "";
  $("tenant-sign-name").value = tenantSignature.name || tenant?.tenant_name || "";
  $("witness-sign-name").value = witnessSignature.name || witnessContact.name || "";
  restoreSignature("landlord", landlordSignature.image);
  restoreSignature("tenant", tenantSignature.image);
  restoreSignature("witness", witnessSignature.image);
  const readOnly = agreement.status === "signed";
  ["landlord", "tenant", "witness"].forEach(party => {
    $(`${party}-sign-name`).readOnly = readOnly;
    $(`${party}-sign-pad`).dataset.readonly = String(readOnly);
    document.querySelector(`[data-clear-signature="${party}"]`)?.classList.toggle("hidden", readOnly);
  });
  $("save-signatures-button").classList.toggle("hidden", readOnly);
  $("signature-message").textContent = readOnly
    ? `Saved on ${agreement.signed_date ? new Date(agreement.signed_date).toLocaleDateString() : "the recorded signing date"}. These signatures are read-only.`
    : "The landlord, tenant, and witness must sign before this agreement can be finalized.";
  $("signing-panel").dataset.agreementId = agreementId;
  $("signing-info").textContent = contextError
    ? `${contextError} You can still review this signing form; check that this agreement is linked to an existing tenancy.`
    : readOnly
      ? "Saved signatures for this tenancy agreement."
      : `Landlord: ${owner?.owner_name || "Landlord"} · Tenant: ${tenant?.tenant_name || "Tenant"} · Witness: ${witnessContact.name || "Witness"}. All three can sign below.`;
  $("signing-panel").classList.remove("hidden");
  $("signing-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function signatureImageBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1];
  if (!base64) throw new Error("A saved signature image is missing.");
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function wordElement(xml, namespace, qualifiedName, attributes = {}) {
  const element = xml.createElementNS(namespace, qualifiedName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function appendWordText(xml, paragraph, text, options = {}) {
  const run = wordElement(xml, WORD_NS, "w:r");
  if (options.fontSize) {
    const properties = wordElement(xml, WORD_NS, "w:rPr");
    properties.appendChild(wordElement(xml, WORD_NS, "w:sz", { "w:val": options.fontSize }));
    run.appendChild(properties);
  }
  const textNode = wordElement(xml, WORD_NS, "w:t");
  textNode.textContent = text;
  textNode.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  run.appendChild(textNode);
  paragraph.appendChild(run);
}

function appendWordSignatureImage(xml, paragraph, relationshipId, party, imageId) {
  const ns = {
    wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    a: "http://schemas.openxmlformats.org/drawingml/2006/main",
    pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
    r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };
  const width = 1645920; // 1.8 inches in EMUs
  const height = 685800; // 0.75 inches; matches the signature pad's aspect ratio
  const run = wordElement(xml, WORD_NS, "w:r");
  const drawing = wordElement(xml, WORD_NS, "w:drawing");
  drawing.setAttributeNS(ns.xmlns, "xmlns:wp", ns.wp);
  drawing.setAttributeNS(ns.xmlns, "xmlns:a", ns.a);
  drawing.setAttributeNS(ns.xmlns, "xmlns:pic", ns.pic);
  drawing.setAttributeNS(ns.xmlns, "xmlns:r", ns.r);

  const inline = wordElement(xml, ns.wp, "wp:inline", { distT: 0, distB: 0, distL: 0, distR: 0 });
  inline.appendChild(wordElement(xml, ns.wp, "wp:extent", { cx: width, cy: height }));
  inline.appendChild(wordElement(xml, ns.wp, "wp:effectExtent", { l: 0, t: 0, r: 0, b: 0 }));
  inline.appendChild(wordElement(xml, ns.wp, "wp:docPr", { id: 900000 + imageId, name: `${party} signature`, descr: `${party} handwritten signature` }));
  const frame = wordElement(xml, ns.wp, "wp:cNvGraphicFramePr");
  frame.appendChild(wordElement(xml, ns.a, "a:graphicFrameLocks", { noChangeAspect: 1 }));
  inline.appendChild(frame);

  const graphic = wordElement(xml, ns.a, "a:graphic");
  const graphicData = wordElement(xml, ns.a, "a:graphicData", { uri: ns.pic });
  const picture = wordElement(xml, ns.pic, "pic:pic");
  const nonVisual = wordElement(xml, ns.pic, "pic:nvPicPr");
  nonVisual.appendChild(wordElement(xml, ns.pic, "pic:cNvPr", { id: imageId, name: `${party}-signature.png` }));
  nonVisual.appendChild(wordElement(xml, ns.pic, "pic:cNvPicPr"));
  picture.appendChild(nonVisual);

  const fill = wordElement(xml, ns.pic, "pic:blipFill");
  const blip = wordElement(xml, ns.a, "a:blip");
  blip.setAttributeNS(ns.r, "r:embed", relationshipId);
  fill.appendChild(blip);
  const stretch = wordElement(xml, ns.a, "a:stretch");
  stretch.appendChild(wordElement(xml, ns.a, "a:fillRect"));
  fill.appendChild(stretch);
  picture.appendChild(fill);

  const shape = wordElement(xml, ns.pic, "pic:spPr");
  const transform = wordElement(xml, ns.a, "a:xfrm");
  transform.appendChild(wordElement(xml, ns.a, "a:off", { x: 0, y: 0 }));
  transform.appendChild(wordElement(xml, ns.a, "a:ext", { cx: width, cy: height }));
  shape.appendChild(transform);
  const geometry = wordElement(xml, ns.a, "a:prstGeom", { prst: "rect" });
  geometry.appendChild(wordElement(xml, ns.a, "a:avLst"));
  shape.appendChild(geometry);
  picture.appendChild(shape);
  graphicData.appendChild(picture);
  graphic.appendChild(graphicData);
  inline.appendChild(graphic);
  drawing.appendChild(inline);
  run.appendChild(drawing);
  paragraph.appendChild(run);
}

async function createSignedAgreementDocx(agreementId, signatures, signedAt) {
  if (!window.JSZip) throw new Error("The Word document library did not load. Refresh the page and try again.");
  const userId = await currentUserId();
  const draftPath = `${userId}/agreements/${agreementId}/draft.docx`;
  const { data: draft, error: downloadError } = await db.storage.from(AGREEMENT_BUCKET).download(draftPath);
  if (downloadError) throw downloadError;
  const zip = await window.JSZip.loadAsync(draft);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("The agreement Word file is missing its main document content.");
  const xml = new DOMParser().parseFromString(await documentFile.async("string"), "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("The agreement Word file could not be read.");

  const packageRelNs = "http://schemas.openxmlformats.org/package/2006/relationships";
  const officeRelNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const contentTypeNs = "http://schemas.openxmlformats.org/package/2006/content-types";
  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  if (!relsFile) throw new Error("The agreement Word file is missing its document relationships.");
  const relsXml = new DOMParser().parseFromString(await relsFile.async("string"), "application/xml");
  const relsRoot = relsXml.documentElement;
  let nextRel = Array.from(relsRoot.getElementsByTagNameNS(packageRelNs, "Relationship"))
    .reduce((highest, relationship) => Math.max(highest, Number((relationship.getAttribute("Id") || "").replace(/^rId/, "")) || 0), 0) + 1;
  const relationships = {};

  const contentFile = zip.file("[Content_Types].xml");
  if (!contentFile) throw new Error("The agreement Word file is missing its content type definitions.");
  const contentXml = new DOMParser().parseFromString(await contentFile.async("string"), "application/xml");
  const hasPngType = Array.from(contentXml.getElementsByTagNameNS(contentTypeNs, "Default"))
    .some(item => item.getAttribute("Extension").toLowerCase() === "png");
  if (!hasPngType) {
    const pngType = contentXml.createElementNS(contentTypeNs, "Default");
    pngType.setAttribute("Extension", "png");
    pngType.setAttribute("ContentType", "image/png");
    contentXml.documentElement.appendChild(pngType);
  }

  const signatureTargets = [
    { party: "landlord", marker: "Signature:", excludes: ["Company Chop", "Witness"] },
    { party: "tenant", marker: "Signature / Company Chop:" },
    { party: "witness", marker: "Witness Signature:" }
  ];
  const paragraphs = Array.from(xml.getElementsByTagNameNS(WORD_NS, "p"));
  const dateText = new Date(signedAt).toLocaleDateString("en-MY");
  for (let index = 0; index < signatureTargets.length; index++) {
    const target = signatureTargets[index];
    const paragraph = paragraphs.find(item => {
      const text = Array.from(item.getElementsByTagNameNS(WORD_NS, "t")).map(node => node.textContent || "").join("");
      return text.includes(target.marker) && !(target.excludes || []).some(excluded => text.includes(excluded));
    });
    if (!paragraph) throw new Error(`The Word template needs a signature line labelled "${target.marker}" for the ${target.party}.`);

    const relationshipId = `rId${nextRel++}`;
    const imageName = `signature-${target.party}.png`;
    const relationship = relsXml.createElementNS(packageRelNs, "Relationship");
    relationship.setAttribute("Id", relationshipId);
    relationship.setAttribute("Type", `${officeRelNs}/image`);
    relationship.setAttribute("Target", `media/${imageName}`);
    relsRoot.appendChild(relationship);
    relationships[target.party] = relationshipId;
    zip.file(`word/media/${imageName}`, signatureImageBytes(signatures[target.party].image));

    const properties = Array.from(paragraph.childNodes).find(node => node.namespaceURI === WORD_NS && node.localName === "pPr");
    Array.from(paragraph.childNodes).forEach(node => {
      if (node !== properties) paragraph.removeChild(node);
    });
    if (properties && properties.parentNode !== paragraph) paragraph.insertBefore(properties, paragraph.firstChild);
    appendWordText(xml, paragraph, `${target.party === "witness" ? "Witness signature: " : `${target.party === "tenant" ? "Signature / Company Chop: " : "Signature: "}`}`);
    appendWordSignatureImage(xml, paragraph, relationships[target.party], target.party, 900001 + index);

    const dateParagraph = xml.createElementNS(WORD_NS, "w:p");
    appendWordText(xml, dateParagraph, `Signed on: ${dateText}`, { fontSize: 18 });
    paragraph.parentNode.insertBefore(dateParagraph, paragraph.nextSibling);
  }

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xml));
  zip.file(relsPath, new XMLSerializer().serializeToString(relsXml));
  zip.file("[Content_Types].xml", new XMLSerializer().serializeToString(contentXml));
  return zip.generateAsync({ type: "blob", mimeType: AGREEMENT_DOCX_MIME });
}

async function saveAgreementSignatures(event) {
  event.preventDefault();
  const agreementId = $("signing-panel").dataset.agreementId;
  if (!agreementId) return;
  if (!signaturePads.landlord?.hasInk || !signaturePads.tenant?.hasInk || !signaturePads.witness?.hasInk) {
    message("signature-message", "The landlord, tenant, and witness each need to add a signature before saving.", "error");
    return;
  }
  const landlordName = $("landlord-sign-name").value.trim();
  const tenantName = $("tenant-sign-name").value.trim();
  const witnessName = $("witness-sign-name").value.trim();
  if (!landlordName || !tenantName || !witnessName) {
    message("signature-message", "Enter the landlord, tenant, and witness full names before saving.", "error");
    return;
  }
  try {
    const signedAt = new Date().toISOString();
    const signatures = {
      landlord: { name: landlordName, image: signaturePads.landlord.canvas.toDataURL("image/png") },
      tenant: { name: tenantName, image: signaturePads.tenant.canvas.toDataURL("image/png") },
      witness: { name: witnessName, image: signaturePads.witness.canvas.toDataURL("image/png") }
    };
    const signedDocument = await createSignedAgreementDocx(agreementId, signatures, signedAt);
    const userId = await currentUserId();
    const signedPath = `${userId}/agreements/${agreementId}/signed.docx`;
    const { error: uploadError } = await db.storage.from(AGREEMENT_BUCKET).upload(signedPath, signedDocument, {
      contentType: AGREEMENT_DOCX_MIME,
      upsert: true
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await db.from("tenancy_agreements").update({
      status: "signed",
      signed_date: signedAt,
      landlord_signature: JSON.stringify(signatures.landlord),
      tenant_signature: JSON.stringify(signatures.tenant),
      witness_signature: JSON.stringify(signatures.witness)
    }).eq("id", agreementId);
    if (updateError) {
      const { error: cleanupError } = await db.storage.from(AGREEMENT_BUCKET).remove([signedPath]);
      if (cleanupError) console.warn("Could not remove the unreferenced signed agreement file:", cleanupError);
      throw updateError;
    }
    $("signing-panel").classList.add("hidden");
    await loadAll();
    message("app-message", "The signed Word agreement is saved with the tenancy record and ready to download.", "success");
  } catch (error) {
    reportError(error);
  }
}

async function deleteAgreement(id) {
  if (!confirm("Delete this agreement record, its saved draft, and its signatures?")) return;
  try {
    const userId = await currentUserId();
    const photoPaths = await listAgreementPhotoPaths(id);
    const { error: storageError } = await db.storage.from(AGREEMENT_BUCKET).remove([
      `${userId}/agreements/${id}/draft.docx`,
      `${userId}/agreements/${id}/signed.docx`,
      ...photoPaths
    ]);
    if (storageError) throw storageError;
    await runQuery(db.from("tenancy_agreements").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- SHORT-TERM BOOKINGS ---------------- */

function renderBookings() {
  const container = $("bookings-list");
  if (!container) return;
  container.innerHTML = state.bookings.length
    ? state.bookings.map(b => {
      const unit = state.units.find(u => u.id === b.unit_id);
      const tenant = state.tenants.find(x => x.id === b.tenant_id);
      const prop = state.properties.find(p => p.id === unit?.property_id);
      return `
        <article class="record-card">
          <h3>${esc(tenant?.tenant_name || "Guest")} — Stay Booking</h3>
          <p>${esc(prop?.property_name || "")} / ${esc(unit?.unit_name || "Unit")}</p>
          <div class="record-meta">
            <span class="pill">${esc(b.status)}</span>
            <span class="pill">Total: ${money(b.total_price)}</span>
          </div>
          <p>Check-in: ${esc(b.check_in_date)} → Check-out: ${esc(b.check_out_date)}</p>
          <p>${esc(b.notes || "")}</p>
          <div class="record-actions">
            <button data-edit-booking="${b.id}">Edit</button>
            <button class="secondary" data-delete-booking="${b.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No short-term bookings recorded yet.</div>';
}

function resetBookingForm() {
  $("booking-form").reset();
  $("booking-id").value = "";
  $("booking-form-title").textContent = "Add short-term booking";
  $("booking-form-wrap").classList.add("hidden");
}

function openBookingForm(id = "") {
  if (!state.units.length || !state.tenants.length) {
    message("app-message", "Create at least one unit and one tenant first.", "error");
    return;
  }
  resetBookingForm();
  populateSelects();
  if (id) {
    const b = state.bookings.find(x => x.id === id);
    if (!b) return;
    $("booking-id").value = b.id;
    $("booking-unit").value = b.unit_id;
    $("booking-tenant").value = b.tenant_id;
    $("booking-checkin").value = b.check_in_date;
    $("booking-checkout").value = b.check_out_date;
    $("booking-price").value = b.total_price;
    $("booking-status").value = b.status;
    $("booking-notes").value = b.notes || "";
    $("booking-form-title").textContent = "Edit booking";
  }
  $("booking-form-wrap").classList.remove("hidden");
  $("booking-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveBooking(event) {
  event.preventDefault();
  const id = $("booking-id").value;
  const record = {
    unit_id: $("booking-unit").value,
    tenant_id: $("booking-tenant").value,
    check_in_date: $("booking-checkin").value,
    check_out_date: $("booking-checkout").value,
    total_price: Number($("booking-price").value),
    status: $("booking-status").value,
    notes: $("booking-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("short_term_bookings").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("short_term_bookings").insert(record).select().single());
    }
    resetBookingForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteBooking(id) {
  if (!confirm("Delete this booking?")) return;
  try {
    await runQuery(db.from("short_term_bookings").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- DEPOSITS ---------------- */

function renderDeposits() {
  const rows = state.tenancies.map(tenancy => {
    const unit = state.units.find(item => item.id === tenancy.unit_id);
    const property = state.properties.find(item => item.id === unit?.property_id);
    const tenant = state.tenants.find(item => item.id === tenancy.tenant_id);
    return { tenancy, unit, property, tenant, deposits: state.deposits.filter(item => item.tenancy_id === tenancy.id) };
  }).sort((a, b) => (a.tenant?.tenant_name || "").localeCompare(b.tenant?.tenant_name || ""));

  const depositEntries = (deposits, type) => {
    const matching = deposits.filter(item => item.deposit_type === type);
    if (!matching.length) return '<span class="deposit-missing">Not recorded</span>';
    return matching.map(item => `
      <div class="deposit-table-entry">
        <div class="deposit-entry-heading"><strong>${money(item.amount)}</strong><span class="pill">${esc(item.status || "held")}</span></div>
        <small>Paid ${esc(item.paid_date || "—")} · Refunded ${esc(item.refunded_date || "—")}</small>
        ${item.notes ? `<small>${esc(item.notes)}</small>` : ""}
        <div class="deposit-entry-actions">
          <button class="secondary" data-edit-deposit="${esc(item.id)}">Edit</button>
          <button class="secondary" data-delete-deposit="${esc(item.id)}">Delete</button>
        </div>
      </div>`).join("");
  };

  $("deposits-list").innerHTML = rows.length
    ? `<div class="deposit-table-wrap"><table class="deposit-table">
        <thead><tr><th>Tenant / tenancy</th><th>Security deposit</th><th>Utility deposit</th><th>Other deposits</th></tr></thead>
        <tbody>${rows.map(({ tenancy, unit, property, tenant, deposits }) => {
          const searchable = [tenant?.tenant_name, property?.property_name, unit?.unit_name, tenancy.status,
            tenancy.monthly_rent, ...deposits.flatMap(item => [item.deposit_type, item.status, item.amount, item.notes])]
            .filter(Boolean).join(" ").toLowerCase();
          const otherTypes = [...new Set(deposits.map(item => item.deposit_type).filter(type => !["security", "utility"].includes(type)))];
          const otherContent = otherTypes.length
            ? otherTypes.map(type => `<div class="deposit-other-group"><strong>${esc(type)}</strong>${depositEntries(deposits, type)}</div>`).join("")
            : '<span class="deposit-missing">—</span>';
          return `<tr class="deposit-table-row" data-deposit-search="${esc(searchable)}">
            <td><strong>${esc(tenant?.tenant_name || "Unknown tenant")}</strong><small>${esc(property?.property_name || "Unknown property")} · ${esc(unit?.unit_name || "Unknown unit")}</small><small>${esc(tenancy.status || "")} · Rent ${money(tenancy.monthly_rent)} / month</small></td>
            <td>${depositEntries(deposits, "security")}</td>
            <td>${depositEntries(deposits, "utility")}</td>
            <td>${otherContent}</td>
          </tr>`;
        }).join("")}
        <tr id="deposit-no-results" class="hidden"><td colspan="4" class="deposit-no-results">No deposits match your search.</td></tr></tbody>
      </table></div>`
    : '<div class="panel empty">No long-term tenancies yet. Add a tenancy before recording deposits.</div>';
  filterDepositRows();
}

function filterDepositRows() {
  const query = ($("deposit-search")?.value || "").trim().toLowerCase();
  const rows = [...document.querySelectorAll(".deposit-table-row")];
  let visible = 0;
  rows.forEach(row => {
    const matches = !query || (row.dataset.depositSearch || "").includes(query);
    row.classList.toggle("hidden", !matches);
    if (matches) visible++;
  });
  $("deposit-no-results")?.classList.toggle("hidden", !rows.length || visible > 0);
}

function resetDepositForm() {
  $("deposit-form").reset();
  $("deposit-id").value = "";
  $("deposit-form-title").textContent = "Add deposit";
  $("deposit-form-wrap").classList.add("hidden");
}

function openDepositForm(id = "") {
  if (!state.tenancies.length) {
    message("app-message", "Create a long-term tenancy first.", "error");
    return;
  }
  resetDepositForm();
  populateSelects();
  if (id) {
    const d = state.deposits.find(x => x.id === id);
    if (!d) return;
    $("deposit-id").value = d.id;
    $("deposit-tenancy").value = d.tenancy_id;
    $("deposit-type").value = d.deposit_type;
    $("deposit-amount").value = d.amount;
    $("deposit-paid").value = d.paid_date || "";
    $("deposit-refunded").value = d.refunded_date || "";
    $("deposit-status").value = d.status;
    $("deposit-notes").value = d.notes || "";
    $("deposit-form-title").textContent = "Edit deposit";
  }
  $("deposit-form-wrap").classList.remove("hidden");
  $("deposit-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

const DEPOSIT_PACKAGES = {
  "1.5": { securityMonths: 1, utilityMonths: 0.5 },
  "2.5": { securityMonths: 2, utilityMonths: 0.5 },
  "3": { securityMonths: 2, utilityMonths: 1 }
};

function updateDepositPackagePreview() {
  const tenancy = state.tenancies.find(item => item.id === $("deposit-package-tenancy")?.value);
  const packagePlan = DEPOSIT_PACKAGES[$("deposit-package-type")?.value];
  const preview = $("deposit-package-preview");
  if (!preview) return;
  if (!tenancy || !packagePlan) {
    preview.textContent = "Select a tenancy and package to see the security and utility amounts.";
    return;
  }
  const rent = Number(tenancy.monthly_rent);
  if (!Number.isFinite(rent) || rent <= 0) {
    preview.textContent = "This tenancy has no valid monthly rent. Edit the tenancy first, then choose a package.";
    return;
  }
  const security = Math.round(rent * packagePlan.securityMonths * 100) / 100;
  const utility = Math.round(rent * packagePlan.utilityMonths * 100) / 100;
  preview.textContent = `Monthly rent ${money(rent)} → Security ${money(security)} + Utility ${money(utility)}.`;
}

function openDepositPackageForm() {
  if (!state.tenancies.length) {
    message("app-message", "Create a long-term tenancy first.", "error");
    return;
  }
  $("deposit-package-form").reset();
  populateSelects();
  updateDepositPackagePreview();
  $("deposit-package-form-wrap").classList.remove("hidden");
  $("deposit-package-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveDepositPackage(event) {
  event.preventDefault();
  const tenancyId = $("deposit-package-tenancy").value;
  const tenancy = state.tenancies.find(item => item.id === tenancyId);
  const packagePlan = DEPOSIT_PACKAGES[$("deposit-package-type").value];
  if (!tenancy || !packagePlan) {
    message("app-message", "Select a tenancy and deposit package.", "error");
    return;
  }
  const rent = Number(tenancy.monthly_rent);
  if (!Number.isFinite(rent) || rent <= 0) {
    message("app-message", "This tenancy has no valid monthly rent. Edit the tenancy before adding its deposit package.", "error");
    return;
  }

  const amounts = {
    security: Math.round(rent * packagePlan.securityMonths * 100) / 100,
    utility: Math.round(rent * packagePlan.utilityMonths * 100) / 100
  };
  const activeStatuses = new Set(["held", "partially_refunded"]);
  const changes = [];
  const inserts = [];
  for (const [type, amount] of Object.entries(amounts)) {
    const existing = state.deposits.filter(item =>
      item.tenancy_id === tenancyId && item.deposit_type === type && activeStatuses.has(item.status)
    );
    if (existing.length > 1) {
      message("app-message", `More than one active ${type} deposit exists for this tenancy. Review those records first, then add the package.`, "error");
      return;
    }
    if (existing.length === 1) {
      if (Math.round(Number(existing[0].amount) * 100) !== Math.round(amount * 100)) {
        if (existing[0].status === "partially_refunded") {
          message("app-message", `The ${type} deposit is partially refunded, so its original amount was left unchanged. Review it manually before applying a package.`, "error");
          return;
        }
        changes.push({ id: existing[0].id, type, oldAmount: Number(existing[0].amount), amount });
      }
    } else {
      inserts.push({
        tenancy_id: tenancyId,
        deposit_type: type,
        amount,
        paid_date: null,
        refunded_date: null,
        status: "held",
        notes: `Created from ${$("deposit-package-type").value}-month rent deposit package.`
      });
    }
  }

  if (changes.length) {
    const summary = changes.map(change => `${change.type}: ${money(change.oldAmount)} → ${money(change.amount)}`).join("\n");
    if (!confirm(`This tenancy already has active deposits with different amounts. Update them to match the selected package?\n\n${summary}`)) return;
  }

  try {
    for (const change of changes) {
      await runQuery(db.from("deposits").update({ amount: change.amount }).eq("id", change.id));
    }
    if (inserts.length) await runQuery(db.from("deposits").insert(inserts).select());
    $("deposit-package-form").reset();
    $("deposit-package-form-wrap").classList.add("hidden");
    await loadAll();
    message("app-message", "Security and utility deposits saved from the selected rent package.", "success");
  } catch (error) {
    reportError(error);
  }
}

async function saveDeposit(event) {
  event.preventDefault();
  const id = $("deposit-id").value;
  const record = {
    tenancy_id: $("deposit-tenancy").value,
    deposit_type: $("deposit-type").value,
    amount: Number($("deposit-amount").value),
    paid_date: $("deposit-paid").value || null,
    refunded_date: $("deposit-refunded").value || null,
    status: $("deposit-status").value,
    notes: $("deposit-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("deposits").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("deposits").insert(record).select().single());
    }
    resetDepositForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteDeposit(id) {
  if (!confirm("Delete this deposit?")) return;
  try {
    await runQuery(db.from("deposits").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- PROPERTY SALES (Inside Finance Section) ---------------- */

function renderSales() {
  const container = $("sales-list");
  if (!container) return;
  container.innerHTML = state.sales.length
    ? state.sales.map(s => {
      const prop = state.properties.find(p => p.id === s.property_id);
      return `
        <article class="record-card">
          <h3>${esc(prop?.property_name || "Property Sale")}</h3>
          <div class="record-meta">
            <span class="pill">${esc(s.status)}</span>
            <span class="pill">Asking: ${money(s.target_asking_price)}</span>
          </div>
          <p>Agreed Price: ${money(s.agreed_selling_price)} | Fees/Comm: ${money(s.estimated_fees)}</p>
          <p>${esc(s.notes || "")}</p>
          <div class="record-actions">
            <button data-edit-sale="${s.id}">Edit</button>
            <button class="secondary" data-delete-sale="${s.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No property sales listed yet.</div>';
}

function resetSaleForm() {
  $("sale-form").reset();
  $("sale-id").value = "";
  $("sale-form-title").textContent = "Add sale listing";
  $("sale-form-wrap").classList.add("hidden");
}

function openSaleForm(id = "") {
  if (!state.properties.length) {
    message("app-message", "Create a property first.", "error");
    return;
  }
  resetSaleForm();
  populateSelects();
  if (id) {
    const s = state.sales.find(x => x.id === id);
    if (!s) return;
    $("sale-id").value = s.id;
    $("sale-property").value = s.property_id;
    $("sale-target-price").value = s.target_asking_price ?? "";
    $("sale-status").value = s.status;
    $("sale-agreed-price").value = s.agreed_selling_price ?? "";
    $("sale-fees").value = s.estimated_fees ?? "";
    $("sale-notes").value = s.notes || "";
    $("sale-form-title").textContent = "Edit sale listing";
  }
  $("sale-form-wrap").classList.remove("hidden");
  $("sale-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveSale(event) {
  event.preventDefault();
  const id = $("sale-id").value;
  const record = {
    property_id: $("sale-property").value,
    target_asking_price: $("sale-target-price").value === "" ? null : Number($("sale-target-price").value),
    status: $("sale-status").value,
    agreed_selling_price: $("sale-agreed-price").value === "" ? null : Number($("sale-agreed-price").value),
    estimated_fees: $("sale-fees").value === "" ? null : Number($("sale-fees").value),
    notes: $("sale-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("property_sales").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("property_sales").insert(record).select().single());
    }
    resetSaleForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteSale(id) {
  if (!confirm("Delete this sale listing?")) return;
  try {
    await runQuery(db.from("property_sales").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- FINANCE LEDGER & SLIPS ---------------- */

function renderFinances() {
  const container = $("finance-list");
  if (!container) return;
  container.innerHTML = state.finances.length
    ? state.finances.map(f => {
      const prop = state.properties.find(p => p.id === f.property_id);
      const isIncome = f.record_type === 'rental_income';
      return `
        <article class="record-card">
          <h3>${esc(prop?.property_name || "Property")} — ${esc(f.record_type.toUpperCase().replace('_', ' '))}</h3>
          <div class="record-meta">
            <span class="pill" style="background:${isIncome ? '#dcfce7; color:#166534;' : '#fee2e2; color:#991b1b;'}">${isIncome ? '+' : '-'} ${money(f.amount)}</span>
            <span class="pill">Date: ${esc(f.transaction_date)}</span>
            ${f.reference_no ? `<span class="pill">Ref: ${esc(f.reference_no)}</span>` : ''}
          </div>
          <p>${esc(f.description || "No description provided.")}</p>
          <div class="record-actions">
            <button data-edit-finance="${f.id}">Edit</button>
            <button class="secondary" data-delete-finance="${f.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No financial records or slips logged yet.</div>';
}

function resetFinanceForm() {
  $("finance-form").reset();
  $("finance-id").value = "";
  $("finance-form-title").textContent = "Add financial record";
  $("finance-form-wrap").classList.add("hidden");
}

function openFinanceForm(id = "") {
  if (!state.properties.length) {
    message("app-message", "Create a property first before logging finances.", "error");
    return;
  }
  resetFinanceForm();
  populateSelects();
  if (id) {
    const f = state.finances.find(x => x.id === id);
    if (!f) return;
    $("finance-id").value = f.id;
    $("finance-property").value = f.property_id;
    $("finance-type").value = f.record_type;
    $("finance-amount").value = f.amount;
    $("finance-date").value = f.transaction_date;
    $("finance-ref").value = f.reference_no || "";
    $("finance-notes").value = f.description || "";
    $("finance-form-title").textContent = "Edit financial record";
  }
  $("finance-form-wrap").classList.remove("hidden");
  $("finance-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveFinance(event) {
  event.preventDefault();
  const id = $("finance-id").value;
  const record = {
    property_id: $("finance-property").value,
    record_type: $("finance-type").value,
    amount: Number($("finance-amount").value),
    transaction_date: $("finance-date").value,
    reference_no: $("finance-ref").value.trim() || null,
    description: $("finance-notes").value.trim() || null
  };
  try {
    if (id) {
      await runQuery(db.from("property_finances").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("property_finances").insert(record).select().single());
    }
    resetFinanceForm();
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

async function deleteFinance(id) {
  if (!confirm("Delete this financial record?")) return;
  try {
    await runQuery(db.from("property_finances").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

/* ---------------- REPORTS & PORTFOLIO ANALYSIS ---------------- */

function renderReports() {
  const container = $("property-reports-list");
  if (!container) return;

  let grandIncome = 0;
  let grandExpenses = 0;

  const propertySummaries = state.properties.map(p => {
    // Filter finances for this property
    const propFinances = state.finances.filter(f => f.property_id === p.id);
    
    let propIncome = 0;
    let propOutflows = 0;

    propFinances.forEach(f => {
      if (f.record_type === 'rental_income') {
        propIncome += Number(f.amount);
      } else {
        propOutflows += Number(f.amount);
      }
    });

    grandIncome += propIncome;
    grandExpenses += propOutflows;

    const netFlow = propIncome - propOutflows;

    // Check if there is an active sale record for estimated proceeds scenario
    const saleRec = state.sales.find(s => s.property_id === p.id);
    const estimatedValuation = saleRec?.agreed_selling_price || saleRec?.target_asking_price || p.purchase_price || 0;
    const estimatedFees = saleRec?.estimated_fees || (estimatedValuation * 0.03); // default 3% agent/legal fee estimate
    const netProceedsScenario = estimatedValuation - estimatedFees;

    return `
      <article class="record-card" style="border-left: 4px solid #2563eb;">
        <h3>${esc(p.property_name)}</h3>
        <p>${esc(p.address)}, ${esc(p.city || "")}</p>
        <div class="record-meta">
          <span class="pill" style="background:#dcfce7; color:#166534;">Income: ${money(propIncome)}</span>
          <span class="pill" style="background:#fee2e2; color:#991b1b;">Outflows: ${money(propOutflows)}</span>
          <span class="pill" style="background:#eff6ff; color:#1d4ed8;">Net Cash Flow: ${money(netFlow)}</span>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 10px; font-size: 13px;">
          <p><b>Hold vs. Sell Valuation Scenario:</b></p>
          <p>Estimated Property Value / Price: <b>${money(estimatedValuation)}</b></p>
          <p>Estimated Sale Fees / Commission: <b>${money(estimatedFees)}</b></p>
          <p style="color: #1e3a8a; margin-top: 4px;"><b>Projected Net Sale Proceeds:</b> ${money(netProceedsScenario)}</p>
        </div>
      </article>`;
  });

  $("rep-total-income").textContent = money(grandIncome);
  $("rep-total-expenses").textContent = money(grandExpenses);
  
  const netGrand = grandIncome - grandExpenses;
  const netEl = $("rep-net-cashflow");
  netEl.textContent = money(netGrand);
  netEl.style.color = netGrand >= 0 ? "#16a34a" : "#dc2626";

  container.innerHTML = propertySummaries.length
    ? propertySummaries.join("")
    : '<div class="panel empty">No properties available for report generation.</div>';
}

/* ---------------- MAINTENANCE & REPAIRS ---------------- */

function renderMaintenance() {
  const container = $("maintenance-list");
  if (!container) return;

  container.innerHTML = state.maintenance.length
    ? state.maintenance.map(m => {
      const unit = state.units.find(u => u.id === m.unit_id);
      const prop = state.properties.find(p => p.id === unit?.property_id);
      const tenant = state.tenants.find(t => t.id === m.tenant_id);

      const isEmergency = m.is_emergency;

      return `
        <article class="record-card" style="${isEmergency ? 'border-left: 5px solid #dc2626;' : ''}">
          <h3>${esc(m.issue_title)}</h3>
          <p>${esc(prop?.property_name || "")} / ${esc(unit?.unit_name || "Unit")} ${tenant ? `• Tenant: ${esc(tenant.tenant_name)}` : ''}</p>
          <div class="record-meta">
            <span class="pill" style="background:${isEmergency ? '#fee2e2; color:#991b1b; font-weight:bold;' : '#fef9c3; color:#854d0e;'}">${isEmergency ? '🚨 EMERGENCY FIX' : esc(m.status.toUpperCase())}</span>
            <span class="pill">Cost: ${money(m.actual_cost)}</span>
          </div>
          <p>${esc(m.description || "No description provided.")}</p>
          <div style="display:flex; gap:12px; margin-top:8px; font-size:12px;">
            ${m.before_photo_url ? `<a href="${esc(m.before_photo_url)}" target="_blank" style="color:var(--blue);">View Before Photo</a>` : '<span style="color:var(--muted);">No Before Photo</span>'}
            ${m.after_photo_url ? `<a href="${esc(m.after_photo_url)}" target="_blank" style="color:var(--blue);">View After Photo</a>` : '<span style="color:var(--muted);">No After Photo</span>'}
          </div>
          <div class="record-actions">
            <button data-edit-maintenance="${m.id}">Edit</button>
            <button class="secondary" data-delete-maintenance="${m.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No maintenance repair tickets logged yet.</div>';
}

function resetMaintenanceForm() {
  $("maintenance-form").reset();
  $("maintenance-id").value = "";
  $("maintenance-form-title").textContent = "Log Maintenance Ticket";
  $("maintenance-form-wrap").classList.add("hidden");
}

function openMaintenanceForm(id = "") {
  if (!state.units.length) {
    message("app-message", "Create at least one rentable unit first.", "error");
    return;
  }
  resetMaintenanceForm();
  populateSelects();
  if (id) {
    const m = state.maintenance.find(x => x.id === id);
    if (!m) return;
    $("maintenance-id").value = m.id;
    $("maint-unit").value = m.unit_id || "";
    $("maint-tenant").value = m.tenant_id || "";
    $("maint-title").value = m.issue_title;
    $("maint-desc").value = m.description || "";
    $("maint-emergency").value = String(m.is_emergency);
    $("maint-status").value = m.status;
    $("maint-cost").value = m.actual_cost ?? "";
    $("maint-before").value = m.before_photo_url || "";
    $("maint-after").value = m.after_photo_url || "";
    $("maintenance-form-title").textContent = "Edit Repair Ticket";
  }
  $("maintenance-form-wrap").classList.remove("hidden");
  $("maintenance-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveMaintenance(event) {
  event.preventDefault();
  const id = $("maintenance-id").value;
  
  let beforeUrl = $("maint-before").value || null;
  let afterUrl = $("maint-after").value || null;

  try {
    // 1. Upload Before Photo if selected
    const beforeFileEl = $("maint-before-file");
    if (beforeFileEl && beforeFileEl.files.length > 0) {
      const file = beforeFileEl.files[0];
      const fileName = `before_${Date.now()}_${file.name}`;
      const { data, error } = await db.storage.from("maintenance-photos").upload(fileName, file);
      if (error) throw error;
      
      // Get public URL
      const { data: publicData } = db.storage.from("maintenance-photos").getPublicUrl(fileName);
      beforeUrl = publicData.publicUrl;
    }

    // 2. Upload After Photo if selected
    const afterFileEl = $("maint-after-file");
    if (afterFileEl && afterFileEl.files.length > 0) {
      const file = afterFileEl.files[0];
      const fileName = `after_${Date.now()}_${file.name}`;
      const { data, error } = await db.storage.from("maintenance-photos").upload(fileName, file);
      if (error) throw error;

      // Get public URL
      const { data: publicData } = db.storage.from("maintenance-photos").getPublicUrl(fileName);
      afterUrl = publicData.publicUrl;
    }

    const record = {
      unit_id: $("maint-unit").value,
      tenant_id: $("maint-tenant").value || null,
      issue_title: $("maint-title").value.trim(),
      description: $("maint-desc").value.trim() || null,
      is_emergency: $("maint-emergency").value === "true",
      status: $("maint-status").value,
      actual_cost: $("maint-cost").value === "" ? null : Number($("maint-cost").value),
      before_photo_url: beforeUrl,
      after_photo_url: afterUrl
    };

    if (id) {
      await runQuery(db.from("maintenance_records").update(record).eq("id", id).select().single());
    } else {
      await runQuery(db.from("maintenance_records").insert(record).select().single());
    }
    resetMaintenanceForm();
    await loadAll();
    message("app-message", "Repair ticket and photos saved successfully!", "success");
  } catch (error) {
    reportError(error);
  }
}

async function deleteMaintenance(id) {
  if (!confirm("Delete this maintenance ticket?")) return;
  try {
    await runQuery(db.from("maintenance_records").delete().eq("id", id));
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}


/* ---------------- NAVIGATION ---------------- */

function navigate(page) {
  state.page = page;
  if (page === "agreements") loadAgreementTemplateInfo();

  document.querySelectorAll(".page").forEach(el => el.classList.add("hidden"));

  if (page === "dashboard") {
    $("dashboard-page").classList.remove("hidden");
  } else if (page === "owners-group") {
    $("owners-group-page").classList.remove("hidden");
  } else if (page === "tenants-group") {
    $("tenants-group-page").classList.remove("hidden");
  } else if (page === "finance-group") {
    $("finance-group-page").classList.remove("hidden");
  } else if (page === "reports") {
    $("reports-page").classList.remove("hidden"); // <-- REPLACE placeholder-page here
    renderReports();
  } else {
    const el = $(page + "-page");
    if (el) el.classList.remove("hidden");
    else {
      $("placeholder-page").classList.remove("hidden");
      $("placeholder-title").textContent = "Module workflow";
    }
  }

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const titles = {
    dashboard: "Dashboard",
    "owners-group": "Owners & Properties",
    "tenants-group": "Tenants & Tenancies",
    "finance-group": "Finance",
    reports: "Reports & Documents",
    properties: "Properties & Units",
    owners: "Owners",
    ownership: "Ownership Links",
    tenants: "Tenants",
    tenancies: "Long-Term Tenancies",
    agreements: "Tenancy Agreements",
    bookings: "Short-Term Bookings",
    deposits: "Deposits",
    finance: "Finance Ledger & Slips",
    sales: "Property Sales",
    maintenance: "Maintenance & Repairs"
  };
  $("page-title").textContent = titles[page] || "Dashboard";
}

/* ---------------- EVENT HANDLERS ---------------- */

function bindEvents() {
  document.querySelectorAll("[data-list-search]").forEach(input => {
    input.addEventListener("input", () => filterCompactRecordList(input.dataset.listSearch));
  });

  $("auth-form").addEventListener("submit", signIn);
  $("signup-button").addEventListener("click", signUp);
  $("logout-button").addEventListener("click", logout);

  $("navigation").addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (button) navigate(button.dataset.page);
  });
    
  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.go));
  });

  // Properties
  $("new-property-button")?.addEventListener("click", () => {
    resetPropertyForm();
    $("property-form-wrap").classList.remove("hidden");
  });
  $("cancel-property")?.addEventListener("click", resetPropertyForm);
  $("property-form")?.addEventListener("submit", saveProperty);
  $("property-search")?.addEventListener("input", () => {
    renderProperties();
    formatCompactRecordLists();
  });
  $("property-filter")?.addEventListener("change", () => {
    renderProperties();
    formatCompactRecordLists();
  });

  $("properties-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-property]");
    const add = event.target.closest("[data-add-unit]");
    const del = event.target.closest("[data-delete-property]");
    if (edit) editProperty(edit.dataset.editProperty);
    if (add) openUnitForm("", add.dataset.addUnit);
    if (del) deleteProperty(del.dataset.deleteProperty);
  });

  // Owners
  $("new-owner-button")?.addEventListener("click", () => {
    resetOwnerForm();
    $("owner-form-wrap").classList.remove("hidden");
  });
  $("cancel-owner")?.addEventListener("click", resetOwnerForm);
  $("owner-form")?.addEventListener("submit", saveOwner);

  $("owners-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-owner]");
    const del = event.target.closest("[data-delete-owner]");
    if (edit) editOwner(edit.dataset.editOwner);
    if (del) deleteOwner(del.dataset.deleteOwner);
  });

  // Units
  $("new-unit-button")?.addEventListener("click", () => openUnitForm());
  $("cancel-unit")?.addEventListener("click", resetUnitForm);
  $("unit-form")?.addEventListener("submit", saveUnit);

  $("units-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-unit]");
    const del = event.target.closest("[data-delete-unit]");
    if (edit) openUnitForm(edit.dataset.editUnit);
    if (del) deleteUnit(del.dataset.deleteUnit);
  });

  // Ownership Links
  $("new-link-button")?.addEventListener("click", () => openLinkForm());
  $("cancel-link")?.addEventListener("click", () => {
    $("link-form").reset();
    delete $("link-form").dataset.editId;
    $("link-form-wrap").classList.add("hidden");
  });
  $("link-form")?.addEventListener("submit", saveLink);

  $("links-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-link]");
    const del = event.target.closest("[data-delete-link]");
    if (edit) openLinkForm(edit.dataset.editLink);
    if (del) deleteLink(del.dataset.deleteLink);
  });

  // Tenants
  $("new-tenant-button")?.addEventListener("click", () => {
    resetTenantForm();
    $("tenant-form-wrap").classList.remove("hidden");
  });
  $("cancel-tenant")?.addEventListener("click", resetTenantForm);
  $("tenant-form")?.addEventListener("submit", saveTenant);

  $("tenants-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-tenant]");
    const addTenancy = event.target.closest("[data-add-tenancy-for]");
    const del = event.target.closest("[data-delete-tenant]");
    if (edit) editTenant(edit.dataset.editTenant);
    if (addTenancy) {
      navigate("tenancies");
      openTenancyForm("", addTenancy.dataset.addTenancyFor);
    }
    if (del) deleteTenant(del.dataset.deleteTenant);
  });

  // Tenancies
  $("new-tenancy-button")?.addEventListener("click", () => openTenancyForm());
  $("cancel-tenancy")?.addEventListener("click", resetTenancyForm);
  $("tenancy-form")?.addEventListener("submit", saveTenancy);

  $("tenancies-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-tenancy]");
    const genAg = event.target.closest("[data-generate-agreement-for]");
    const del = event.target.closest("[data-delete-tenancy]");
    if (edit) openTenancyForm(edit.dataset.editTenancy);
    if (genAg) {
      navigate("agreements");
      openAgreementForm(genAg.dataset.generateAgreementFor);
    }
    if (del) deleteTenancy(del.dataset.deleteTenancy);
  });

  // Tenancy Agreements & Digital Signing
  $("new-agreement-button")?.addEventListener("click", () => openAgreementForm());
  $("cancel-agreement")?.addEventListener("click", () => $("agreement-form-wrap").classList.add("hidden"));
  $("agreement-template-form")?.addEventListener("submit", uploadAgreementTemplate);
  $("agreement-form")?.addEventListener("submit", saveAgreement);
  $("agreement-tenancy")?.addEventListener("change", refreshAgreementExtraFields);
  $("agreement-renewal-enabled")?.addEventListener("change", refreshAgreementExtraFields);
  $("agreement-sign-form")?.addEventListener("submit", saveAgreementSignatures);
  $("agreement-photo-form")?.addEventListener("submit", uploadAgreementPhoto);
  $("close-agreement-photos")?.addEventListener("click", () => $("agreement-photos-panel").classList.add("hidden"));
  $("agreement-photos-grid")?.addEventListener("click", event => {
    const remove = event.target.closest("[data-delete-agreement-photo]");
    if (remove) deleteAgreementPhoto(remove.dataset.deleteAgreementPhoto);
  });
  document.querySelectorAll("[data-clear-signature]").forEach(button => {
    button.addEventListener("click", () => clearSignature(button.dataset.clearSignature));
  });

  $("agreements-list")?.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const signBtn = target.closest("[data-sign-agreement]");
    const downloadBtn = target.closest("[data-download-agreement]");
    const signedDownloadBtn = target.closest("[data-download-signed-agreement]");
    const photosBtn = target.closest("[data-photos-agreement]");
    const delBtn = target.closest("[data-delete-agreement]");
    if (signBtn) {
      event.preventDefault();
      try {
        openSigningPanel(signBtn.dataset.signAgreement);
      } catch (error) {
        reportError(error);
      }
    }
    if (downloadBtn) downloadAgreementDraft(downloadBtn.dataset.downloadAgreement);
    if (signedDownloadBtn) downloadSignedAgreement(signedDownloadBtn.dataset.downloadSignedAgreement);
    if (photosBtn) openAgreementPhotosPanel(photosBtn.dataset.photosAgreement);
    if (delBtn) deleteAgreement(delBtn.dataset.deleteAgreement);
  });

  $("cancel-sign-btn")?.addEventListener("click", () => $("signing-panel").classList.add("hidden"));

  // Short-term Bookings
  $("new-booking-button")?.addEventListener("click", () => openBookingForm());
  $("cancel-booking")?.addEventListener("click", resetBookingForm);
  $("booking-form")?.addEventListener("submit", saveBooking);

  $("bookings-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-booking]");
    const del = event.target.closest("[data-delete-booking]");
    if (edit) openBookingForm(edit.dataset.editBooking);
    if (del) deleteBooking(del.dataset.deleteBooking);
  });

  // Deposits
  $("new-deposit-button")?.addEventListener("click", () => openDepositForm());
  $("new-deposit-package-button")?.addEventListener("click", openDepositPackageForm);
  $("cancel-deposit-package")?.addEventListener("click", () => $("deposit-package-form-wrap").classList.add("hidden"));
  $("deposit-package-form")?.addEventListener("submit", saveDepositPackage);
  $("deposit-package-tenancy")?.addEventListener("change", updateDepositPackagePreview);
  $("deposit-package-type")?.addEventListener("change", updateDepositPackagePreview);
  $("deposit-search")?.addEventListener("input", filterDepositRows);
  $("cancel-deposit")?.addEventListener("click", resetDepositForm);
  $("deposit-form")?.addEventListener("submit", saveDeposit);

  $("deposits-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-deposit]");
    const del = event.target.closest("[data-delete-deposit]");
    if (edit) openDepositForm(edit.dataset.editDeposit);
    if (del) deleteDeposit(del.dataset.deleteDeposit);
  });

  // Property Sales
  $("new-sale-button")?.addEventListener("click", () => openSaleForm());
  $("cancel-sale")?.addEventListener("click", resetSaleForm);
  $("sale-form")?.addEventListener("submit", saveSale);

  $("sales-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-sale]");
    const del = event.target.closest("[data-delete-sale]");
    if (edit) openSaleForm(edit.dataset.editSale);
    if (del) deleteSale(del.dataset.deleteSale);
  });

// Finance Ledger & Slips
  $("new-finance-button")?.addEventListener("click", () => openFinanceForm());
  $("cancel-finance")?.addEventListener("click", resetFinanceForm);
  $("finance-form")?.addEventListener("submit", saveFinance);

  $("finance-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-finance]");
    const del = event.target.closest("[data-delete-finance]");
    if (edit) openFinanceForm(edit.dataset.editFinance);
    if (del) deleteFinance(del.dataset.deleteFinance);
  });

// Maintenance & Repairs
  $("new-maintenance-button")?.addEventListener("click", () => openMaintenanceForm());
  $("cancel-maintenance")?.addEventListener("click", resetMaintenanceForm);
  $("maintenance-form")?.addEventListener("submit", saveMaintenance);

  $("maintenance-list")?.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-maintenance]");
    const del = event.target.closest("[data-delete-maintenance]");
    if (edit) openMaintenanceForm(edit.dataset.editMaintenance);
    if (del) deleteMaintenance(del.dataset.deleteMaintenance);
  });


}



/* ---------------- START ---------------- */

async function start() {
  bindEvents();

  if (!db) {
    showApp(false);
    message("auth-message", "Setup required: add your Supabase project URL and publishable/anon key in script.js.", "error");
    return;
  }

  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    showApp(Boolean(data.session));
    if (data.session) await loadAll();
  } catch (error) {
    reportAuthError(error);
    showApp(false);
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") showApp(false);
    if (event === "SIGNED_IN" && session) {
      showApp(true);
      loadAll().catch(reportError);
    }
  });
}

start();
