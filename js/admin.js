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

workForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  workMessage.textContent = "Guardando...";
  saveBtn.disabled = true;

  try {
    const id = document.getElementById("work-id").value;
    const oldPath = document.getElementById("existing-file-path").value;
    const files = Array.from(fileInput.files);

    const baseTitle = document.getElementById("work-title").value.trim();
    const basePayload = {
      description: document.getElementById("work-description").value.trim(),
      unit: Number(document.getElementById("work-unit").value),
      week: Number(document.getElementById("work-week").value),
      work_type: document.getElementById("work-type").value,
      external_url: document.getElementById("work-url").value.trim() || null
    };

    if (id) {
      // ----- EDITAR (un solo archivo, como antes) -----
      let filePath = oldPath || null;
      const file = files[0];

      if (file) {
        filePath = await uploadFile(file);
        if (oldPath && oldPath !== filePath) {
          await supabaseClient.storage.from(window.SUPABASE_BUCKET).remove([oldPath]);
        }
      }

      const { error } = await supabaseClient
        .from("works")
        .update({ ...basePayload, title: baseTitle, file_path: filePath })
        .eq("id", id);
      if (error) throw error;

      workMessage.textContent = "Trabajo actualizado correctamente.";

    } else if (files.length > 1) {
      // ----- NUEVO CON VARIOS ARCHIVOS: un trabajo por archivo -----
      const rows = [];
      for (let i = 0; i < files.length; i++) {
        workMessage.textContent = `Subiendo archivo ${i + 1} de ${files.length}...`;
        const file = files[i];
        const filePath = await uploadFile(file);
        const nameNoExt = file.name.replace(/\.[^/.]+$/, "");
        rows.push({
          ...basePayload,
          title: `${baseTitle} - ${nameNoExt}`.slice(0, 160),
          file_path: filePath
        });
      }

      const { error } = await supabaseClient.from("works").insert(rows);
      if (error) throw error;

      workMessage.textContent = `${rows.length} trabajos publicados correctamente.`;

    } else {
      // ----- NUEVO CON 0 O 1 ARCHIVO -----
      const filePath = files[0] ? await uploadFile(files[0]) : null;

      const { error } = await supabaseClient
        .from("works")
        .insert({ ...basePayload, title: baseTitle, file_path: filePath });
      if (error) throw error;

      workMessage.textContent = "Trabajo publicado correctamente.";
    }

    const msg = workMessage.textContent;
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

  worksList.innerHTML = works.map(work => `
    <article class="admin-work">
      <div>
        <h3>${escapeHtml(work.title)}</h3>
        <div class="meta">Unidad ${work.unit} · Semana ${work.week} · ${escapeHtml(work.work_type || "trabajo")}</div>
      </div>
      <div class="admin-actions">
        <button class="icon-btn" onclick="editWork('${work.id}')">EDITAR</button>
        <button class="icon-btn danger" onclick="deleteWork('${work.id}')">BORRAR</button>
      </div>
    </article>
  `).join("");
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

  if (work.file_path) {
    await supabaseClient.storage.from(window.SUPABASE_BUCKET).remove([work.file_path]);
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
