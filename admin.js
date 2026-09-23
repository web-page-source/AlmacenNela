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