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
  $("owner-phone").value = o.phone || "";
  $("owner-email").value = o.email || "";
  $("owner-address").value = o.mailing_address || "";
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
    phone: $("owner-phone").value.trim() || null,
    email: $("owner-email").value.trim() || null,
    mailing_address: $("owner-address").value.trim() || null,
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

function openTenancyForm(id = "") {
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

/* ---------------- TENANCY AGREEMENTS & AUTO-FILL / SIGNING ---------------- */

function renderAgreements() {
  const container = $("agreements-list");
  if (!container) return;

  container.innerHTML = state.agreements.length
    ? state.agreements.map(ag => {
      const tenancy = state.tenancies.find(t => t.id === ag.tenancy_id);
      const tenant = state.tenants.find(x => x.id === tenancy?.tenant_id);
      const unit = state.units.find(u => u.id === tenancy?.unit_id);
      const prop = state.properties.find(p => p.id === unit?.property_id);

      const isSigned = ag.status === 'signed';

      return `
        <article class="record-card">
          <h3>Tenancy Agreement: ${esc(tenant?.tenant_name || "Tenant")} (${esc(prop?.property_name || "")})</h3>
          <div class="record-meta">
            <span class="pill" style="background:${isSigned ? '#dcfce7; color:#166534;' : '#fef9c3; color:#854d0e;'}">${esc(ag.status.toUpperCase())}</span>
            <span class="pill">Monthly Rent: ${money(tenancy?.monthly_rent)}</span>
          </div>
          <p><b>Signatures:</b> Landlord: ${esc(ag.landlord_signature || "Pending")} | Tenant: ${esc(ag.tenant_signature || "Pending")}</p>
          <div style="background:#f8fafc; padding:12px; border-radius:6px; margin:10px 0; font-size:12px; white-space: pre-wrap; max-height:120px; overflow-y:auto;">${esc(ag.agreement_text)}</div>
          <div class="record-actions">
            ${!isSigned ? `<button data-sign-agreement="${ag.id}">Sign & Execute</button>` : ''}
            <button class="secondary" data-delete-agreement="${ag.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No tenancy agreements generated yet. Click "+ Generate Agreement" to create one.</div>';
}

function openAgreementForm(tenancyId = "") {
  if (!state.tenancies.length) {
    message("app-message", "Create a long-term tenancy first before generating agreements.", "error");
    return;
  }
  populateSelects();
  $("agreement-form").reset();
  $("agreement-id").value = "";
  
  if (tenancyId) {
    $("agreement-tenancy").value = tenancyId;
    autofillAgreementTemplate(tenancyId);
  }

  $("agreement-form-wrap").classList.remove("hidden");
  $("agreement-form-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
}

function autofillAgreementTemplate(tenancyId) {
  const tenancy = state.tenancies.find(t => t.id === tenancyId);
  if (!tenancy) return;
  const tenant = state.tenants.find(x => x.id === tenancy.tenant_id);
  const unit = state.units.find(u => u.id === tenancy.unit_id);
  const prop = state.properties.find(p => p.id === unit?.property_id);

  const defaultTemplate = `TENANCY AGREEMENT
--------------------------------------------------
This Agreement is made between the Landlord and Tenant detailed below:

1. PROPERTY DETAILS:
Property Name: ${prop?.property_name || "N/A"}
Address: ${prop?.address || "N/A"}, ${prop?.city || ""}
Unit: ${unit?.unit_name || "N/A"}

2. TENANT DETAILS:
Name: ${tenant?.tenant_name || "N/A"}
IC / Passport: ${tenant?.ic_or_passport || "N/A"}
Contact: ${tenant?.phone || "N/A"} (${tenant?.email || "N/A"})

3. TENANCY PERIOD & RENT:
Start Date: ${tenancy.start_date}
End Date: ${tenancy.end_date || "Open / Periodic"}
Monthly Rental: RM ${Number(tenancy.monthly_rent).toFixed(2)} (Due on day ${tenancy.rent_due_day} of each calendar month)

4. COVENANTS & CONDITIONS:
- The Tenant shall punctually pay the monthly rent on or before the due date.
- The Tenant shall maintain the interior condition of the premises in good tenantable repair.
- The Landlord agrees to provide peaceful enjoyment of the property throughout the term.
--------------------------------------------------`;

  $("agreement-text").value = defaultTemplate;
}

async function saveAgreement(event) {
  event.preventDefault();
  const tenancyId = $("agreement-tenancy").value;
  const agreementText = $("agreement-text").value.trim();

  const record = {
    tenancy_id: tenancyId,
    agreement_text: agreementText,
    status: 'draft'
  };

  try {
    await runQuery(db.from("tenancy_agreements").insert(record).select().single());
    $("agreement-form-wrap").classList.add("hidden");
    await loadAll();
  } catch (error) {
    reportError(error);
  }
}

let activeSigningAgreementId = null;

function openSigningPanel(agreementId) {
  const ag = state.agreements.find(x => x.id === agreementId);
  if (!ag) return;
  activeSigningAgreementId = agreementId;

  const tenancy = state.tenancies.find(t => t.id === ag.tenancy_id);
  const tenant = state.tenants.find(x => x.id === tenancy?.tenant_id);

  $("signing-info").textContent = `Signing agreement for Tenant: ${tenant?.tenant_name || "Tenant"}. Type full legal names below to execute digital signature.`;
  $("landlord-sig-input").value = ag.landlord_signature || "";
  $("tenant-sig-input").value = ag.tenant_signature || "";
  
  $("signing-panel").classList.remove("hidden");
  $("signing-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function executeSignAgreement() {
  if (!activeSigningAgreementId) return;
  const landlordSig = $("landlord-sig-input").value.trim();
  const tenantSig = $("tenant-sig-input").value.trim();

  if (!landlordSig || !tenantSig) {
    alert("Both Landlord and Tenant signature inputs are required to finalize signing.");
    return;
  }

  const updates = {
    landlord_signature: landlordSig,
    tenant_signature: tenantSig,
    status: 'signed',
    signed_date: new Date().toISOString()
  };

  try {
    await runQuery(db.from("tenancy_agreements").update(updates).eq("id", activeSigningAgreementId).select().single());
    $("signing-panel").classList.add("hidden");
    activeSigningAgreementId = null;
    await loadAll();
    message("app-message", "Tenancy agreement successfully signed and stored!", "success");
  } catch (error) {
    reportError(error);
  }
}

async function deleteAgreement(id) {
  if (!confirm("Delete this agreement record?")) return;
  try {
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
  $("deposits-list").innerHTML = state.deposits.length
    ? state.deposits.map(d => {
      const tenancy = state.tenancies.find(t => t.id === d.tenancy_id);
      const tenant = state.tenants.find(t => t.id === tenancy?.tenant_id);
      return `
        <article class="record-card">
          <h3>${esc(tenant?.tenant_name || "Unknown")} — ${esc(d.deposit_type)}</h3>
          <div class="record-meta">
            <span class="pill">${esc(d.status)}</span>
            <span class="pill">${money(d.amount)}</span>
          </div>
          <p>Paid: ${esc(d.paid_date || "—")} | Refunded: ${esc(d.refunded_date || "—")}</p>
          <p>${esc(d.notes || "")}</p>
          <div class="record-actions">
            <button data-edit-deposit="${d.id}">Edit</button>
            <button class="secondary" data-delete-deposit="${d.id}">Delete</button>
          </div>
        </article>`;
    }).join("")
    : '<div class="panel empty">No deposits recorded yet.</div>';
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
  $("property-search")?.addEventListener("input", renderProperties);
  $("property-filter")?.addEventListener("change", renderProperties);

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
    const del = event.target.closest("[data-delete-tenant]");
    if (edit) editTenant(edit.dataset.editTenant);
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
  $("agreement-tenancy")?.addEventListener("change", (e) => autofillAgreementTemplate(e.target.value));
  $("agreement-form")?.addEventListener("submit", saveAgreement);

  $("agreements-list")?.addEventListener("click", event => {
    const signBtn = event.target.closest("[data-sign-agreement]");
    const delBtn = event.target.closest("[data-delete-agreement]");
    if (signBtn) openSigningPanel(signBtn.dataset.signAgreement);
    if (delBtn) deleteAgreement(delBtn.dataset.deleteAgreement);
  });

  $("execute-sign-btn")?.addEventListener("click", executeSignAgreement);
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