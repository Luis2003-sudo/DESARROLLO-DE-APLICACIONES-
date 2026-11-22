const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

const worksContainer = document.getElementById("works-container");
const filterLabel = document.getElementById("filter-label");
const clearFilter = document.getElementById("clear-filter");

// Modal "añadir más" (solo admin)
const addModal = document.getElementById("add-modal");
const addForm = document.getElementById("add-form");
const addWorkName = document.getElementById("add-work-name");
const addFiles = document.getElementById("add-files");
const addFilesCount = document.getElementById("add-files-count");
const addLink = document.getElementById("add-link");
const addLinkLabel = document.getElementById("add-link-label");
const addSave = document.getElementById("add-save");
const addCancel = document.getElementById("add-cancel");
const addMessage = document.getElementById("add-message");
const addFilesHelp = addFilesCount ? addFilesCount.textContent : "";

let allWorks = [];
let activeUnit = null;
let activeWeek = null;
let isAdmin = false;
let addingWorkId = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setupListeners();
  await checkAdminRole();
  await loadWorks();

  // Si inicia o cierra sesión en otra pestaña, actualiza los botones
  supabaseClient.auth.onAuthStateChange(() => {
    setTimeout(async () => {
      await checkAdminRole();
      renderWorks();
    }, 0);
  });
}

/* ---------- Rol de administrador ---------- */

async function checkAdminRole() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { isAdmin = false; return; }

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    isAdmin = !error && !!data && data.role === "admin";
  } catch (e) {
    isAdmin = false;
  }
}

/* ---------- Carga de trabajos ---------- */

async function loadWorks() {
  worksContainer.innerHTML = '<div class="loading-card">CARGANDO ACTIVIDADES...</div>';

  const { data, error } = await supabaseClient
    .from("works")
    .select("*")
    .order("unit", { ascending: true })
    .order("week", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    worksContainer.innerHTML = `<div class="empty-card">No se pudieron cargar las actividades.<br><small>${escapeHtml(error.message)}</small></div>`;
    return;
  }

  allWorks = data || [];
  updateUnitCounts();
  renderWorks();
}

/* ---------- Listeners (se registran una sola vez) ---------- */

function setupListeners() {
  document.querySelectorAll(".unit-card").forEach(card => {
    card.addEventListener("click", (event) => {
      if (!event.target.matches("button")) return;
      const unit = Number(card.dataset.unit);
      const week = Number(event.target.dataset.week);
      setFilter(unit, week);
    });
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      setFilter(Number(card.dataset.unit), null);
    });
  });

  clearFilter.addEventListener("click", () => {
    activeUnit = null;
    activeWeek = null;
    updateActiveCards();
    filterLabel.textContent = "TODAS LAS ACTIVIDADES";
    renderWorks();
  });

  // Botón "+ AÑADIR" de cada tarjeta (delegación de eventos)
  worksContainer.addEventListener("click", (event) => {
    const btn = event.target.closest(".add-more-btn");
    if (!btn || !isAdmin) return;
    openAddModal(btn.dataset.id);
  });

  if (addModal) {
    addCancel.addEventListener("click", closeAddModal);
    addModal.addEventListener("click", (event) => {
      if (event.target === addModal) closeAddModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !addModal.classList.contains("hidden")) closeAddModal();
    });
    addFiles.addEventListener("change", () => {
      const n = addFiles.files.length;
      addFilesCount.textContent = n > 1
        ? `${n} archivos seleccionados`
        : (n === 1 ? addFiles.files[0].name : addFilesHelp);
    });
    addForm.addEventListener("submit", saveExtraResources);
  }
}

/* ---------- Filtros ---------- */

function setFilter(unit, week) {
  activeUnit = unit;
  activeWeek = week;
  filterLabel.textContent = week
    ? `UNIDAD ${unit} · SEMANA ${week}`
    : `UNIDAD ${unit}`;
  updateActiveCards();
  renderWorks();
  document.getElementById("works-container").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateActiveCards() {
  document.querySelectorAll(".unit-card").forEach(card => {
    card.classList.toggle("active", Number(card.dataset.unit) === activeUnit);
  });
}

function updateUnitCounts() {
  for (let unit = 1; unit <= 4; unit++) {
    const count = allWorks.filter(w => Number(w.unit) === unit).length;
    document.getElementById(`count-unit-${unit}`).textContent = `${count} ${count === 1 ? "trabajo" : "trabajos"}`;
  }
}

/* ---------- Archivos y enlaces de un trabajo ---------- */

// Rutas de archivos (compatible con trabajos antiguos)
function getWorkPaths(work) {
  if (work.file_paths && work.file_paths.length) return work.file_paths;
  return work.file_path ? [work.file_path] : [];
}

// Enlaces extra añadidos desde el modo admin: [{ url, label }]
function getExtraLinks(work) {
  return Array.isArray(work.extra_links) ? work.extra_links : [];
}

function getPublicUrl(path) {
  return supabaseClient.storage.from(window.SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Nombre legible: quita la carpeta y el prefijo de fecha
function getFileName(path) {
  return path.split("/").pop().replace(/^\d+-/, "");
}

// Lista unificada: archivos + enlace principal + enlaces extra
function getWorkItems(work) {
  const items = [];
  getWorkPaths(work).forEach(p => {
    items.push({ kind: "file", url: getPublicUrl(p), label: getFileName(p) });
  });
  if (work.external_url) {
    items.push({ kind: "link", url: work.external_url, label: "ABRIR ENLACE" });
  }
  getExtraLinks(work).forEach(l => {
    if (l && l.url) items.push({ kind: "link", url: l.url, label: l.label || "ABRIR ENLACE" });
  });
  return items;
}

/* ---------- Pintar tarjetas ---------- */

function renderWorks() {
  const works = allWorks.filter(w => {
    if (activeUnit && Number(w.unit) !== activeUnit) return false;
    if (activeWeek && Number(w.week) !== activeWeek) return false;
    return true;
  });

  if (!works.length) {
    worksContainer.innerHTML = `<div class="empty-card">
      No hay trabajos publicados en esta sección todavía.<br>
      <small>El administrador puede agregarlos desde el panel Admin.</small>
    </div>`;
    return;
  }

  worksContainer.innerHTML = works.map(work => {
    const items = getWorkItems(work);
    const hasMany = items.length > 1;

    let actionHtml = "";

    if (hasMany) {
      const list = items.map((it, i) => `
        <li>
          <span class="file-num">${String(i + 1).padStart(2, "0")}</span>
          <a href="${escapeAttr(it.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.label)} ↗</a>
        </li>`).join("");

      actionHtml = `<details class="work-files">
        <summary>VER ${items.length} RECURSOS</summary>
        <ul>${list}</ul>
      </details>`;
    } else if (items.length === 1) {
      const it = items[0];
      const linkText = it.kind === "link" ? "ABRIR ENLACE ↗" : "VER / DESCARGAR ARCHIVO ↗";
      actionHtml = `<a class="work-link" href="${escapeAttr(it.url)}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    } else {
      actionHtml = '<span class="work-link">SIN ARCHIVO / ENLACE</span>';
    }

    // Botón visible SOLO para el administrador
    const adminBtn = isAdmin
      ? `<div><button type="button" class="add-more-btn" data-id="${escapeAttr(work.id)}">+ AÑADIR ARCHIVOS / ENLACES</button></div>`
      : "";

    return `<article class="work-card">
      <div class="work-meta">
        <span class="tag">UNIDAD ${work.unit}</span>
        <span class="tag">SEMANA ${work.week}</span>
        <span class="tag">${escapeHtml((work.work_type || "TRABAJO").toUpperCase())}</span>
        ${hasMany ? `<span class="tag">${items.length} RECURSOS</span>` : ""}
      </div>
      <h3>${escapeHtml(work.title)}</h3>
      <p>${escapeHtml(work.description || "Actividad académica del curso Desarrollo de Aplicaciones.")}</p>
      ${actionHtml}
      ${adminBtn}
    </article>`;
  }).join("");
}

/* ---------- Modal: añadir más archivos / enlaces ---------- */

function openAddModal(workId) {
  const work = allWorks.find(w => String(w.id) === String(workId));
  if (!work) return;

  addingWorkId = work.id;
  addForm.reset();
  addFilesCount.textContent = addFilesHelp;
  addMessage.textContent = "";
  addWorkName.textContent = `Trabajo: ${work.title}`;
  addModal.classList.remove("hidden");
}

function closeAddModal() {
  addModal.classList.add("hidden");
  addingWorkId = null;
}

// Sube un archivo al Storage y devuelve su ruta
async function uploadFile(file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folder = crypto.randomUUID();
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabaseClient.storage
    .from(window.SUPABASE_BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return path;
}

async function saveExtraResources(event) {
  event.preventDefault();
  if (!isAdmin) return;

  const work = allWorks.find(w => String(w.id) === String(addingWorkId));
  if (!work) return;

  const files = Array.from(addFiles.files);
  const url = addLink.value.trim();
  const label = addLinkLabel.value.trim();

  if (!files.length && !url) {
    addMessage.textContent = "Selecciona al menos un archivo o escribe un enlace.";
    return;
  }

  addSave.disabled = true;

  try {
    // Lo que ya tenía + lo nuevo (se AGREGA, no se reemplaza)
    const paths = [...getWorkPaths(work)];
    for (let i = 0; i < files.length; i++) {
      addMessage.textContent = `Subiendo archivo ${i + 1} de ${files.length}...`;
      paths.push(await uploadFile(files[i]));
    }

    const links = [...getExtraLinks(work)];
    if (url) links.push({ url, label: label || null });

    addMessage.textContent = "Guardando...";

    const { data, error } = await supabaseClient
      .from("works")
      .update({
        file_paths: paths,
        file_path: paths[0] || null,
        extra_links: links
      })
      .eq("id", work.id)
      .select();

    if (error) throw error;
    if (!data || !data.length) {
      throw new Error("No tienes permiso para modificar este trabajo. Inicia sesión como administrador.");
    }

    closeAddModal();
    await loadWorks();
  } catch (err) {
    addMessage.textContent = err.message || "Ocurrió un error.";
  } finally {
    addSave.disabled = false;
  }
}

/* ---------- Utilidades ---------- */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
