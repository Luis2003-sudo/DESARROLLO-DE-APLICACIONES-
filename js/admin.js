const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const logoutBtn = document.getElementById("logout-btn");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginMessage = document.getElementById("login-message");
const signupMessage = document.getElementById("signup-message");
const workForm = document.getElementById("work-form");
const worksList = document.getElementById("admin-works");
const workMessage = document.getElementById("work-message");
const cancelEdit = document.getElementById("cancel-edit");
const formMode = document.getElementById("form-mode");
const saveBtn = document.getElementById("save-btn");
const totalWorks = document.getElementById("total-works");
const fileInput = document.getElementById("work-file");
const fileCount = document.getElementById("file-count");
const fileHelpText = fileCount ? fileCount.textContent : "";
let works = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await checkAdmin(session.user);
  else showLogin();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    if (session) await checkAdmin(session.user);
    else showLogin();
  });
}

async function checkAdmin(user) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (error || !data || data.role !== "admin") {
    showLogin();
    loginMessage.textContent = "Esta cuenta no tiene permisos de administrador.";
    await supabaseClient.auth.signOut();
    return;
  }

  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  document.getElementById("admin-user").textContent = `Sesión: ${data.full_name || user.email}`;
  await loadAdminWorks();
}

function showLogin() {
  loginPanel.classList.remove("hidden");
  dashboard.classList.add("hidden");
  logoutBtn.classList.add("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "Verificando...";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  loginMessage.textContent = error ? error.message : "Acceso concedido.";
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupMessage.textContent = "Creando cuenta...";
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  const { error } = await supabaseClient.auth.signUp({ email, password });
  signupMessage.textContent = error
    ? error.message
    : "Cuenta creada. Si Supabase pide confirmación de correo, confirma el correo y luego inicia sesión. Después debes asignar el rol admin en SQL.";
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

// Muestra cuántos archivos se seleccionaron
fileInput.addEventListener("change", () => {
  if (!fileCount) return;
  const n = fileInput.files.length;
  fileCount.textContent = n > 1 ? `${n} archivos seleccionados` : fileHelpText;
});

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

// Devuelve todas las rutas de archivos de un trabajo (compatible con trabajos antiguos)
function getWorkPaths(work) {
  if (work.file_paths && work.file_paths.length) return work.file_paths;
  return work.file_path ? [work.file_path] : [];
}

workForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  workMessage.textContent = "Guardando...";
  saveBtn.disabled = true;

  try {
    const id = document.getElementById("work-id").value;
    const files = Array.from(fileInput.files);

    // Rutas que ya tenía el trabajo (si se está editando)
    const currentWork = id ? works.find(w => w.id === id) : null;
    const paths = currentWork ? [...getWorkPaths(currentWork)] : [];

    // Subir todos los archivos nuevos
    for (let i = 0; i < files.length; i++) {
      workMessage.textContent = `Subiendo archivo ${i + 1} de ${files.length}...`;
      paths.push(await uploadFile(files[i]));
    }

    workMessage.textContent = "Guardando...";

    const payload = {
      title: document.getElementById("work-title").value.trim(),
      description: document.getElementById("work-description").value.trim(),
      unit: Number(document.getElementById("work-unit").value),
      week: Number(document.getElementById("work-week").value),
      work_type: document.getElementById("work-type").value,
      external_url: document.getElementById("work-url").value.trim() || null,
      file_paths: paths,
      file_path: paths[0] || null   // compatibilidad con el portafolio actual
    };

    let result;
    if (id) {
      result = await supabaseClient.from("works").update(payload).eq("id", id);
    } else {
      result = await supabaseClient.from("works").insert(payload);
    }

    if (result.error) throw result.error;

    const msg = id
      ? "Trabajo actualizado correctamente."
      : `Trabajo publicado correctamente${paths.length > 1 ? ` con ${paths.length} archivos` : ""}.`;
    resetForm();
    workMessage.textContent = msg;
    await loadAdminWorks();
  } catch (error) {
    workMessage.textContent = error.message || "Ocurrió un error.";
  } finally {
    saveBtn.disabled = false;
  }
});

cancelEdit.addEventListener("click", resetForm);

async function loadAdminWorks() {
  worksList.innerHTML = '<div class="loading-card">CARGANDO...</div>';

  const { data, error } = await supabaseClient
    .from("works")
    .select("*")
    .order("unit", { ascending: true })
    .order("week", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    worksList.innerHTML = `<div class="empty-card">${escapeHtml(error.message)}</div>`;
    return;
  }

  works = data || [];
  totalWorks.textContent = works.length;
  renderAdminWorks();
}

function renderAdminWorks() {
  if (!works.length) {
    worksList.innerHTML = '<div class="empty-card">Todavía no hay trabajos publicados.</div>';
    return;
  }

  worksList.innerHTML = works.map(work => {
    const n = getWorkPaths(work).length;
    const filesLabel = n > 1 ? ` · ${n} archivos` : "";
    return `
    <article class="admin-work">
      <div>
        <h3>${escapeHtml(work.title)}</h3>
        <div class="meta">Unidad ${work.unit} · Semana ${work.week} · ${escapeHtml(work.work_type || "trabajo")}${filesLabel}</div>
      </div>
      <div class="admin-actions">
        <button class="icon-btn" onclick="editWork('${work.id}')">EDITAR</button>
        <button class="icon-btn danger" onclick="deleteWork('${work.id}')">BORRAR</button>
      </div>
    </article>`;
  }).join("");
}

window.editWork = function(id) {
  const work = works.find(w => w.id === id);
  if (!work) return;

  document.getElementById("work-id").value = work.id;
  document.getElementById("existing-file-path").value = work.file_path || "";
  document.getElementById("work-title").value = work.title || "";
  document.getElementById("work-description").value = work.description || "";
  document.getElementById("work-unit").value = work.unit;
  document.getElementById("work-week").value = work.week;
  document.getElementById("work-type").value = work.work_type || "archivo";
  document.getElementById("work-url").value = work.external_url || "";
  fileInput.value = "";
  formMode.textContent = "EDITANDO TRABAJO";
  saveBtn.textContent = "GUARDAR CAMBIOS";
  cancelEdit.classList.remove("hidden");
  if (fileCount) {
    const n = getWorkPaths(work).length;
    fileCount.textContent = `Este trabajo tiene ${n} archivo(s). Los que selecciones se AGREGAN a los existentes.`;
  }
  document.getElementById("work-form").scrollIntoView({ behavior: "smooth" });
};

window.deleteWork = async function(id) {
  const work = works.find(w => w.id === id);
  if (!work) return;

  if (!confirm(`¿Borrar "${work.title}"? Esta acción no se puede deshacer.`)) return;

  workMessage.textContent = "Borrando...";
  const { error } = await supabaseClient.from("works").delete().eq("id", id);

  if (error) {
    workMessage.textContent = error.message;
    return;
  }

  const paths = getWorkPaths(work);
  if (paths.length) {
    await supabaseClient.storage.from(window.SUPABASE_BUCKET).remove(paths);
  }

  workMessage.textContent = "Trabajo eliminado.";
  await loadAdminWorks();
};

function resetForm() {
  workForm.reset();
  document.getElementById("work-id").value = "";
  document.getElementById("existing-file-path").value = "";
  formMode.textContent = "NUEVO TRABAJO";
  saveBtn.textContent = "PUBLICAR TRABAJO";
  cancelEdit.classList.add("hidden");
  if (fileCount) fileCount.textContent = fileHelpText;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
