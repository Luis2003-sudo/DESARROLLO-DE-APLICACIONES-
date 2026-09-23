const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

const worksContainer = document.getElementById("works-container");
const filterLabel = document.getElementById("filter-label");
const clearFilter = document.getElementById("clear-filter");
let allWorks = [];
let activeUnit = null;
let activeWeek = null;

document.addEventListener("DOMContentLoaded", loadWorks);

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
}

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

function renderWorks() {
  let works = allWorks.filter(w => {
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
    const fileUrl = work.file_path
      ? supabaseClient.storage.from(window.SUPABASE_BUCKET).getPublicUrl(work.file_path).data.publicUrl
      : null;
    const targetUrl = work.external_url || fileUrl;
    const linkText = work.external_url ? "ABRIR ENLACE ↗" : "VER / DESCARGAR ARCHIVO ↗";

    return `<article class="work-card">
      <div class="work-meta">
        <span class="tag">UNIDAD ${work.unit}</span>
        <span class="tag">SEMANA ${work.week}</span>
        <span class="tag">${escapeHtml((work.work_type || "TRABAJO").toUpperCase())}</span>
      </div>
      <h3>${escapeHtml(work.title)}</h3>
      <p>${escapeHtml(work.description || "Actividad académica del curso Desarrollo de Aplicaciones.")}</p>
      ${targetUrl ? `<a class="work-link" href="${escapeAttr(targetUrl)}" target="_blank" rel="noopener noreferrer">${linkText}</a>` : '<span class="work-link">SIN ARCHIVO / ENLACE</span>'}
    </article>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
