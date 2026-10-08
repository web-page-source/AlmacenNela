// Captura global de errores para avisar si algo falla en tiempo de ejecución
window.onerror = function(msg, url, lineNo) {
  alert(`Error JS Detectado: ${msg}\nLínea: ${lineNo}`);
  return false;
};

window.onunhandledrejection = function(event) {
  alert(`Error de Red / Promesa sin capturar: ${event.reason?.message || event.reason}`);
};

// 1. Configuración e Inicialización de Supabase a través de config/env.js
const supabaseUrl = window.ENV?.SUPABASE_URL;
const supabaseKey = window.ENV?.SUPABASE_KEY;

let _supabase = null;

if (typeof supabase !== "undefined" && supabase.createClient && supabaseUrl && supabaseKey) {
  _supabase = supabase.createClient(supabaseUrl, supabaseKey);
} else {
  alert("No se encontraron las credenciales de Supabase. Revisa el archivo config/env.js");
}

// Variables globales
let todosLosProductos = [];
let filtroCategoriaActual = null;
let tasaZelleCUP = 350;
let idProductoAEliminar = null;

// Alternar visibilidad del formulario "Agregar Producto"
document.getElementById("btn-agregar").addEventListener("click", () => {
  const formContainer = document.getElementById("form-producto");
  formContainer.style.display = (formContainer.style.display === "none" || formContainer.style.display === "") ? "block" : "none";
});

// --- LÓGICA DEL MODAL "ACTUALIZAR PRECIO DEL ZELLE" ---

document.getElementById("btn-zelle").addEventListener("click", async () => {
  await cargarTasaZelle();
  document.getElementById("tasa-zelle-input").value = tasaZelleCUP;
  document.getElementById("modal-zelle").style.display = "flex";
});

window.cerrarModalZelle = function() {
  document.getElementById("modal-zelle").style.display = "none";
};

async function cargarTasaZelle() {
  if (!_supabase) return;
  try {
    const { data, error } = await _supabase
      .from("configuracion")
      .select("valor")
      .eq("clave", "tasa_zelle")
      .maybeSingle();

    if (data && data.valor !== undefined) {
      tasaZelleCUP = parseFloat(data.valor);
      localStorage.setItem("tasa_zelle", tasaZelleCUP);
    } else {
      const localValue = localStorage.getItem("tasa_zelle");
      if (localValue) tasaZelleCUP = parseFloat(localValue);
    }
  } catch (err) {
    const localValue = localStorage.getItem("tasa_zelle");
    if (localValue) tasaZelleCUP = parseFloat(localValue);
  }
}

document.getElementById("form-tasa-zelle").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nuevaTasa = parseFloat(document.getElementById("tasa-zelle-input").value);

  if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
    alert("Por favor ingrese un número válido.");
    return;
  }

  tasaZelleCUP = nuevaTasa;
  localStorage.setItem("tasa_zelle", nuevaTasa);

  if (_supabase) {
    const { error } = await _supabase
      .from("configuracion")
      .upsert({ clave: "tasa_zelle", valor: nuevaTasa }, { onConflict: "clave" });

    if (error) {
      alert(`Tasa guardada localmente (${nuevaTasa} CUP).\nNota de Supabase: ${error.message}`);
    } else {
      alert(`Tasa Zelle actualizada correctamente: 1 Zelle = ${nuevaTasa} CUP`);
    }
  }

  cerrarModalZelle();
});

// --- LÓGICA DE PRODUCTOS ---

// Agregar nuevo producto
document.getElementById("form-producto").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("img");
  let imgBase64 = null;
  if (fileInput.files.length > 0) {
    imgBase64 = await toBase64(fileInput.files[0]);
  }

  const nuevoProducto = {
    cat: document.getElementById("cat").value.trim(),
    nombre: document.getElementById("nombre").value.trim(),
    zelle: parseFloat(document.getElementById("zelle").value),
    nota: document.getElementById("nota").value.trim(),
    img: imgBase64, 
    activo: document.getElementById("activo").checked
  };

  try {
    const { error } = await _supabase.from("productos").insert([nuevoProducto]);

    if (error) {
      alert("Error al guardar en Supabase: " + error.message);
    } else {
      alert("Producto agregado correctamente");
      document.getElementById("form-producto").reset();
      document.getElementById("form-producto").style.display = "none";
      cargarProductos(filtroCategoriaActual);
    }
  } catch (err) {
    alert("Error de red al agregar producto: " + err.message);
  }
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Cargar productos desde Supabase
async function cargarProductos(filtroCat = null) {
  filtroCategoriaActual = filtroCat;
  const lista = document.getElementById("lista-productos");
  lista.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>Cargando catálogo...</p>";

  if (!_supabase) {
    lista.innerHTML = "<p style='text-align:center; color:red; grid-column: 1/-1;'>Error: Supabase no está disponible.</p>";
    return;
  }

  try {
    const { data: productos, error } = await _supabase
      .from("productos")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      lista.innerHTML = `<p style='text-align:center; color:red; grid-column: 1/-1;'>Error al cargar productos: ${error.message}</p>`;
      return;
    }

    todosLosProductos = productos || [];
    renderizarProductos();
    mostrarCategorias();
  } catch (err) {
    lista.innerHTML = `<p style='text-align:center; color:red; grid-column: 1/-1;'>Error de conexión: ${err.message}</p>`;
  }
}

// Renderizar las tarjetas de producto
function renderizarProductos() {
  const lista = document.getElementById("lista-productos");
  lista.innerHTML = "";

  let productosFiltrados = filtroCategoriaActual 
    ? todosLosProductos.filter(p => p.cat === filtroCategoriaActual) 
    : todosLosProductos;

  const ordenPrioridad = ["La Sorpresa", "Decoración"];
  productosFiltrados.sort((a, b) => {
    const catA = String(a.cat || "");
    const catB = String(b.cat || "");
    const idxA = ordenPrioridad.indexOf(catA);
    const idxB = ordenPrioridad.indexOf(catB);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB || String(a.id).localeCompare(String(b.id));
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    if (catA === "Extras") return 1;
    if (catB === "Extras") return -1;

    const catCompare = catA.localeCompare(catB);
    return catCompare !== 0 ? catCompare : String(a.id).localeCompare(String(b.id));
  });

  if (productosFiltrados.length === 0) {
    lista.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>No hay productos en esta categoría.</p>";
    return;
  }

  productosFiltrados.forEach(p => {
    const card = document.createElement("div");
    card.className = `producto-card ${!p.activo ? 'oculto' : ''}`;
    
    const imagenHTML = p.img 
      ? `<img src="${p.img}" alt="${p.nombre}" class="producto-img">`
      : `<div class="producto-img-placeholder">Sin Imagen</div>`;

    card.innerHTML = `
      ${imagenHTML}
      <div class="producto-info">
        <div>
          <span class="producto-cat-badge">${p.cat || 'Sin Categoría'}</span>
          <h3 class="producto-titulo">${p.nombre}</h3>
          <div class="producto-precio">$${p.zelle} Zelle</div>
          ${p.nota ? `<p class="producto-nota">"${p.nota}"</p>` : ''}
        </div>
        
        <div class="producto-acciones">
          <button type="button" class="btn-accion btn-editar" data-id="${p.id}">✎ Editar</button>
          <button type="button" class="btn-accion btn-estado" data-id="${p.id}">
            ${p.activo ? "Ocultar" : "Mostrar"}
          </button>
          <button type="button" class="btn-accion btn-eliminar" data-id="${p.id}">Eliminar</button>
        </div>
      </div>
    `;

    lista.appendChild(card);
  });
}

// CAPTURA CENTRALIZADA DE CLICS EN LOS BOTONES DE LAS TARJETAS
document.getElementById("lista-productos").addEventListener("click", (e) => {
  const btnEliminar = e.target.closest(".btn-eliminar");
  if (btnEliminar) {
    const id = btnEliminar.getAttribute("data-id");
    abrirModalEliminar(id);
    return;
  }

  const btnEditar = e.target.closest(".btn-editar");
  if (btnEditar) {
    const id = btnEditar.getAttribute("data-id");
    abrirModalEditar(id);
    return;
  }

  const btnEstado = e.target.closest(".btn-estado");
  if (btnEstado) {
    const id = btnEstado.getAttribute("data-id");
    ocultarProducto(id);
    return;
  }
});

// Ocultar / Mostrar producto
window.ocultarProducto = async function(id) {
  const prod = todosLosProductos.find(p => String(p.id) === String(id));
  if (!prod) return;

  const nuevoEstado = !prod.activo;

  try {
    const { error } = await _supabase
      .from("productos")
      .update({ activo: nuevoEstado })
      .eq("id", id);

    if (error) {
      alert("Error al actualizar estado: " + error.message);
    } else {
      prod.activo = nuevoEstado;
      renderizarProductos();
    }
  } catch (err) {
    alert("Error de red al actualizar estado: " + err.message);
  }
};

// --- LÓGICA DE ELIMINACIÓN CON MODAL PROPIO ---

window.abrirModalEliminar = function(id) {
  const producto = todosLosProductos.find(p => String(p.id) === String(id));
  if (!producto) {
    alert("No se encontró el producto en la lista local.");
    return;
  }

  idProductoAEliminar = id;
  document.getElementById("texto-confirmar-eliminar").innerHTML = 
    `¿Estás seguro de eliminar permanentemente el producto:<br><strong style="color:#4A3222; font-size:1.1rem;">"${producto.nombre}"</strong>?<br><br><small style="color:#7C5136;">Esta acción no se puede deshacer.</small>`;
  
  document.getElementById("modal-eliminar").style.display = "flex";
};

window.cerrarModalEliminar = function() {
  document.getElementById("modal-eliminar").style.display = "none";
  idProductoAEliminar = null;
};

document.getElementById("btn-confirmar-eliminar-action").addEventListener("click", async () => {
  if (!idProductoAEliminar) return;

  const btnConfirmar = document.getElementById("btn-confirmar-eliminar-action");
  btnConfirmar.innerText = "Eliminando...";
  btnConfirmar.disabled = true;

  try {
    // Si la ID en BD es número se envía numérica, de lo contrario String
    const idTarget = isNaN(idProductoAEliminar) ? idProductoAEliminar : Number(idProductoAEliminar);

    const { error } = await _supabase
      .from("productos")
      .delete()
      .eq("id", idTarget);

    if (error) {
      alert(`Error al eliminar de Supabase:\n${error.message}\n\n⚠️ Si el error dice 'permission denied', debes revisar los permisos RLS en Supabase.`);
    } else {
      alert("Producto eliminado exitosamente de la base de datos.");
      todosLosProductos = todosLosProductos.filter(p => String(p.id) !== String(idProductoAEliminar));
      renderizarProductos();
      mostrarCategorias();
    }
  } catch (err) {
    alert("Error de conexión al eliminar: " + err.message);
  } finally {
    btnConfirmar.innerText = "Sí, Eliminar";
    btnConfirmar.disabled = false;
    cerrarModalEliminar();
  }
});

function mostrarCategorias() {
  const contenedor = document.getElementById("categorias-container");

  let categoriasUnicas = [...new Set(todosLosProductos.map(p => p.cat).filter(Boolean))];

  const ordenPrioridad = ["La Sorpresa", "Decoración"];
  categoriasUnicas.sort((a, b) => {
    const idxA = ordenPrioridad.indexOf(a);
    const idxB = ordenPrioridad.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    if (a === "Extras") return 1;
    if (b === "Extras") return -1;
    return a.localeCompare(b);
  });

  let html = `<label style="display:block; font-weight:bold; text-align:center;">Filtrar por Categoría:</label>`;
  html += `<div class="btn-cat-wrapper">`;
  
  const activeTodas = filtroCategoriaActual === null ? 'active-cat' : '';
  html += `<button type="button" class="btn-cat ${activeTodas}" onclick="filtrarCat(null)">Todas</button>`;

  categoriasUnicas.forEach(cat => {
    const active = filtroCategoriaActual === cat ? 'active-cat' : '';
    html += `<button type="button" class="btn-cat ${active}" onclick="filtrarCat('${cat}')">${cat}</button>`;
  });

  html += `</div>`;
  contenedor.innerHTML = html;
}

window.filtrarCat = function(cat) {
  filtroCategoriaActual = cat;
  mostrarCategorias();
  renderizarProductos();
};

// --- MODAL Y LÓGICA DE EDICIÓN ---

window.abrirModalEditar = function(id) {
  const producto = todosLosProductos.find(p => String(p.id) === String(id));
  if (!producto) {
    alert("No se encontró el producto para editar.");
    return;
  }

  document.getElementById("edit-id").value = producto.id;
  document.getElementById("edit-cat").value = producto.cat || "";
  document.getElementById("edit-nombre").value = producto.nombre || "";
  document.getElementById("edit-zelle").value = producto.zelle || 0;
  document.getElementById("edit-nota").value = producto.nota || "";
  document.getElementById("edit-activo").checked = !!producto.activo;

  const preview = document.getElementById("edit-img-preview");
  if (producto.img) {
    preview.src = producto.img;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }

  document.getElementById("edit-img-file").value = "";
  document.getElementById("modal-editar").style.display = "flex";
};

window.cerrarModalEditar = function() {
  document.getElementById("modal-editar").style.display = "none";
};

// Guardar cambios del producto
document.getElementById("form-editar-producto").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("edit-id").value;
  const cat = document.getElementById("edit-cat").value.trim();
  const nombre = document.getElementById("edit-nombre").value.trim();
  const zelle = parseFloat(document.getElementById("edit-zelle").value);
  const nota = document.getElementById("edit-nota").value.trim();
  const activo = document.getElementById("edit-activo").checked;

  const fileInput = document.getElementById("edit-img-file");
  
  const datosActualizados = {
    cat,
    nombre,
    zelle,
    nota,
    activo
  };

  if (fileInput.files.length > 0) {
    datosActualizados.img = await toBase64(fileInput.files[0]);
  }

  try {
    const idTarget = isNaN(id) ? id : Number(id);

    const { error } = await _supabase
      .from("productos")
      .update(datosActualizados)
      .eq("id", idTarget);

    if (error) {
      alert("Error al actualizar el producto: " + error.message);
    } else {
      const index = todosLosProductos.findIndex(p => String(p.id) === String(id));
      if (index !== -1) {
        todosLosProductos[index] = { ...todosLosProductos[index], ...datosActualizados };
      }

      alert("Producto actualizado con éxito");
      cerrarModalEditar();
      renderizarProductos();
      mostrarCategorias();
    }
  } catch (err) {
    alert("Error de red al editar: " + err.message);
  }
});

document.getElementById("edit-img-file").addEventListener("change", async (e) => {
  if (e.target.files.length > 0) {
    const base64 = await toBase64(e.target.files[0]);
    const preview = document.getElementById("edit-img-preview");
    preview.src = base64;
    preview.style.display = "block";
  }
});

// Carga Inicial
cargarTasaZelle();
cargarProductos();


// =====================================================
// ================  SECCIÓN: EQUIPO  ==================
// =====================================================

let todoElEquipo = [];
let idMiembroAEliminar = null;

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Cambiar entre la pantalla de productos y la de equipo
function mostrarVista(vista) {
  document.getElementById("vista-productos").style.display = (vista === "productos") ? "block" : "none";
  document.getElementById("vista-equipo").style.display = (vista === "equipo") ? "block" : "none";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("btn-equipo").addEventListener("click", () => {
  mostrarVista("equipo");
  cargarEquipo();
});

document.getElementById("btn-volver-catalogo").addEventListener("click", () => {
  mostrarVista("productos");
});

// Alternar visibilidad del formulario "Agregar Miembro"
document.getElementById("btn-agregar-miembro").addEventListener("click", () => {
  const form = document.getElementById("form-miembro");
  form.style.display = (form.style.display === "none" || form.style.display === "") ? "block" : "none";
});

// Convierte cualquier imagen a una foto ligera (máx. 900px) en base64.
// Si el navegador no puede leer el formato, guarda el archivo original tal cual.
async function fotoABase64(file, maxLado = 900, calidad = 0.85) {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    URL.revokeObjectURL(url);

    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; // fondo blanco para imágenes con transparencia (PNG, WebP...)
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", calidad);
  } catch (err) {
    return toBase64(file);
  }
}

// Cargar equipo desde Supabase
async function cargarEquipo() {
  const lista = document.getElementById("lista-equipo");
  lista.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>Cargando equipo...</p>";

  if (!_supabase) {
    lista.innerHTML = "<p style='text-align:center; color:red; grid-column: 1/-1;'>Error: Supabase no está disponible.</p>";
    return;
  }

  try {
    const { data, error } = await _supabase
      .from("equipo")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      lista.innerHTML = `<p style='text-align:center; color:red; grid-column: 1/-1;'>Error al cargar el equipo: ${escaparHTML(error.message)}<br><small>¿Ya creaste la tabla 'equipo' en Supabase?</small></p>`;
      return;
    }

    todoElEquipo = data || [];
    renderizarEquipo();
  } catch (err) {
    lista.innerHTML = `<p style='text-align:center; color:red; grid-column: 1/-1;'>Error de conexión: ${escaparHTML(err.message)}</p>`;
  }
}

// Renderizar las tarjetas de los miembros
function renderizarEquipo() {
  const lista = document.getElementById("lista-equipo");
  lista.innerHTML = "";

  if (todoElEquipo.length === 0) {
    lista.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>Aún no hay miembros en el equipo.</p>";
    return;
  }

  todoElEquipo.forEach(m => {
    const card = document.createElement("div");
    card.className = "producto-card";

    const imagenHTML = m.foto
      ? `<img src="${escaparHTML(m.foto)}" alt="${escaparHTML(m.nombre)}" class="producto-img">`
      : `<div class="producto-img-placeholder">Sin Foto</div>`;

    card.innerHTML = `
      ${imagenHTML}
      <div class="producto-info">
        <div>
          <span class="producto-cat-badge">${escaparHTML(m.funcion || "Sin función")}</span>
          <h3 class="producto-titulo">${escaparHTML(m.nombre)}</h3>
        </div>

        <div class="producto-acciones">
          <button type="button" class="btn-accion btn-editar btn-editar-miembro" data-id="${escaparHTML(m.id)}">✎ Editar</button>
          <button type="button" class="btn-accion btn-eliminar btn-eliminar-miembro" data-id="${escaparHTML(m.id)}">Eliminar</button>
        </div>
      </div>
    `;

    lista.appendChild(card);
  });
}

// Clics en los botones de las tarjetas del equipo
document.getElementById("lista-equipo").addEventListener("click", (e) => {
  const btnEliminar = e.target.closest(".btn-eliminar-miembro");
  if (btnEliminar) {
    abrirModalEliminarMiembro(btnEliminar.getAttribute("data-id"));
    return;
  }

  const btnEditar = e.target.closest(".btn-editar-miembro");
  if (btnEditar) {
    abrirModalEditarMiembro(btnEditar.getAttribute("data-id"));
  }
});

// --- AGREGAR MIEMBRO ---
document.getElementById("form-miembro").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const btnGuardar = form.querySelector("button[type='submit']");
  const textoOriginal = btnGuardar.innerText;
  btnGuardar.innerText = "Guardando...";
  btnGuardar.disabled = true;

  try {
    const fileInput = document.getElementById("m-foto");
    let foto = null;
    if (fileInput.files.length > 0) {
      foto = await fotoABase64(fileInput.files[0]);
    }

    const nuevoMiembro = {
      nombre: document.getElementById("m-nombre").value.trim(),
      funcion: document.getElementById("m-funcion").value.trim(),
      foto: foto
    };

    const { error } = await _supabase.from("equipo").insert([nuevoMiembro]);

    if (error) {
      alert("Error al guardar el miembro: " + error.message);
    } else {
      alert("Miembro agregado correctamente");
      form.reset();
      form.style.display = "none";
      cargarEquipo();
    }
  } catch (err) {
    alert("Error de red al agregar miembro: " + err.message);
  } finally {
    btnGuardar.innerText = textoOriginal;
    btnGuardar.disabled = false;
  }
});

// --- EDITAR MIEMBRO ---
window.abrirModalEditarMiembro = function(id) {
  const miembro = todoElEquipo.find(m => String(m.id) === String(id));
  if (!miembro) {
    alert("No se encontró el miembro para editar.");
    return;
  }

  document.getElementById("edit-m-id").value = miembro.id;
  document.getElementById("edit-m-nombre").value = miembro.nombre || "";
  document.getElementById("edit-m-funcion").value = miembro.funcion || "";

  const preview = document.getElementById("edit-m-foto-preview");
  if (miembro.foto) {
    preview.src = miembro.foto;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }

  document.getElementById("edit-m-foto-file").value = "";
  document.getElementById("modal-editar-miembro").style.display = "flex";
};

window.cerrarModalEditarMiembro = function() {
  document.getElementById("modal-editar-miembro").style.display = "none";
};

document.getElementById("edit-m-foto-file").addEventListener("change", async (e) => {
  if (e.target.files.length > 0) {
    const preview = document.getElementById("edit-m-foto-preview");
    preview.src = await fotoABase64(e.target.files[0]);
    preview.style.display = "block";
  }
});

document.getElementById("form-editar-miembro").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btnGuardar = e.target.querySelector("button[type='submit']");
  const textoOriginal = btnGuardar.innerText;
  btnGuardar.innerText = "Guardando...";
  btnGuardar.disabled = true;

  try {
    const id = document.getElementById("edit-m-id").value;
    const datosActualizados = {
      nombre: document.getElementById("edit-m-nombre").value.trim(),
      funcion: document.getElementById("edit-m-funcion").value.trim()
    };

    const fileInput = document.getElementById("edit-m-foto-file");
    if (fileInput.files.length > 0) {
      datosActualizados.foto = await fotoABase64(fileInput.files[0]);
    }

    const idTarget = isNaN(id) ? id : Number(id);
    const { error } = await _supabase
      .from("equipo")
      .update(datosActualizados)
      .eq("id", idTarget);

    if (error) {
      alert("Error al actualizar el miembro: " + error.message);
    } else {
      const index = todoElEquipo.findIndex(m => String(m.id) === String(id));
      if (index !== -1) {
        todoElEquipo[index] = { ...todoElEquipo[index], ...datosActualizados };
      }
      alert("Miembro actualizado con éxito");
      cerrarModalEditarMiembro();
      renderizarEquipo();
    }
  } catch (err) {
    alert("Error de red al editar: " + err.message);
  } finally {
    btnGuardar.innerText = textoOriginal;
    btnGuardar.disabled = false;
  }
});

// --- ELIMINAR MIEMBRO ---
window.abrirModalEliminarMiembro = function(id) {
  const miembro = todoElEquipo.find(m => String(m.id) === String(id));
  if (!miembro) {
    alert("No se encontró el miembro en la lista local.");
    return;
  }

  idMiembroAEliminar = id;
  document.getElementById("texto-confirmar-eliminar-miembro").innerHTML =
    `¿Estás seguro de eliminar permanentemente a:<br><strong style="color:#4A3222; font-size:1.1rem;">"${escaparHTML(miembro.nombre)}"</strong>?<br><br><small style="color:#7C5136;">Esta acción no se puede deshacer.</small>`;

  document.getElementById("modal-eliminar-miembro").style.display = "flex";
};

window.cerrarModalEliminarMiembro = function() {
  document.getElementById("modal-eliminar-miembro").style.display = "none";
  idMiembroAEliminar = null;
};

document.getElementById("btn-confirmar-eliminar-miembro").addEventListener("click", async () => {
  if (!idMiembroAEliminar) return;

  const btn = document.getElementById("btn-confirmar-eliminar-miembro");
  btn.innerText = "Eliminando...";
  btn.disabled = true;

  const idBorrado = idMiembroAEliminar;

  try {
    const idTarget = isNaN(idBorrado) ? idBorrado : Number(idBorrado);
    const { error } = await _supabase
      .from("equipo")
      .delete()
      .eq("id", idTarget);

    if (error) {
      alert(`Error al eliminar de Supabase:\n${error.message}\n\n⚠️ Si el error dice 'permission denied', revisa los permisos RLS de la tabla 'equipo'.`);
    } else {
      alert("Miembro eliminado correctamente.");
      todoElEquipo = todoElEquipo.filter(m => String(m.id) !== String(idBorrado));
      renderizarEquipo();
    }
  } catch (err) {
    alert("Error de conexión al eliminar: " + err.message);
  } finally {
    btn.innerText = "Sí, Eliminar";
    btn.disabled = false;
    cerrarModalEliminarMiembro();
  }
});
