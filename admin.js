// 1. Configura tu proyecto Supabase (SIN EL IMPORT DE ARRIBA)
const supabaseUrl = "https://yibtjtlkaaphyikdsbvq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpYnRqdGxrYWFwaHlpa2RzYnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTE0MTUsImV4cCI6MjA5MjAyNzQxNX0.flnpvqOZNxS7uOny4TozRBveagv5j47rgnPhObKOKGU";

// IMPORTANTE: Usamos 'supabase.createClient' porque la librería del CDN inyecta el objeto 'supabase'
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Mostrar/ocultar formulario al presionar el botón
document.getElementById("btn-agregar").addEventListener("click", () => {
  const formContainer = document.getElementById("form-producto");
  if (formContainer.style.display === "none") {
    formContainer.style.display = "block";
  } else {
    formContainer.style.display = "none";
  }
});


document.getElementById("form-producto").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("img");
  let imgBase64 = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    imgBase64 = await toBase64(file);
  }

  const producto = {
    cat: document.getElementById("cat").value.trim(),
    nombre: document.getElementById("nombre").value.trim(),
    zelle: parseFloat(document.getElementById("zelle").value),
    nota: document.getElementById("nota").value.trim(),
    img: imgBase64, 
    activo: document.getElementById("activo").checked
  };

  // Usamos _supabase para evitar conflictos
  const { error } = await _supabase.from("productos").insert([producto]);

  if (error) {
    alert("Error al guardar: " + error.message);
  } else {
    alert("Producto agregado correctamente");
    cargarProductos();
    mostrarCategorias();
    e.target.reset();
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
async function cargarProductos(filtroCat = null) {
  const lista = document.getElementById("lista-productos");
  lista.innerHTML = "";

  // Traer TODOS los productos, sin filtrar por activo
  const { data: productos, error } = await _supabase
    .from("productos")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    lista.innerHTML = "<p>Error al cargar productos</p>";
    return;
  }

  // Filtrar si se seleccionó una categoría
  let productosFiltrados = filtroCat ? productos.filter(p => p.cat === filtroCat) : productos;

  // Ordenar productos según reglas de categoría y luego por id
  const ordenPrioridad = ["La Sorpresa", "Decoración"];
  productosFiltrados.sort((a, b) => {
    const idxA = ordenPrioridad.indexOf(a.cat);
    const idxB = ordenPrioridad.indexOf(b.cat);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB || a.id - b.id;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    if (a.cat === "Extras") return 1;
    if (b.cat === "Extras") return -1;

    const catCompare = a.cat.localeCompare(b.cat);
    return catCompare !== 0 ? catCompare : a.id - b.id;
  });

  // Renderizar productos
  productosFiltrados.forEach(p => {
    const item = document.createElement("div");
    item.className = "producto-item";
    item.innerHTML = `
      <span>${p.cat} - ${p.nombre} (${p.zelle} Zelle)</span>
      ${p.img ? `<img src="${p.img}" alt="${p.nombre}" style="max-width:100px; display:block;">` : ''}
      <button onclick="ocultarProducto(${p.id}, ${p.activo ? 'true' : 'false'})">
        ${p.activo ? "Ocultar" : "Mostrar"}
      </button>
    `;
    lista.appendChild(item);
  });

  // Actualizar categorías
  mostrarCategorias();
}

// Función para ocultar/mostrar producto
window.ocultarProducto = async function(id, estadoActual) {
  const nuevoEstado = !estadoActual;

  const { error } = await _supabase
    .from("productos")
    .update({ activo: nuevoEstado })
    .eq("id", id);

  if (error) {
    alert("Error al actualizar: " + error.message);
  } else {
    cargarProductos(); // refresca lista con nuevo estado
    mostrarCategorias();
  }
};

async function mostrarCategorias() {
  const contenedor = document.getElementById("categorias-container");

  // Traer todas las categorías (sin filtrar por activo)
  const { data: productos, error } = await _supabase
    .from("productos")
    .select("cat");

  if (error) {
    contenedor.innerHTML = "<p>Error al cargar categorías</p>";
    return;
  }

  // Extraer categorías únicas
  let categoriasUnicas = [...new Set(productos.map(p => p.cat))];

  // Ordenar categorías según reglas
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

  // Construir botones
  let html = `<label style="display:block; margin-top:10px; font-weight:bold;text-align:center">Categorías existentes:</label>`;
  
  // Botón "Todas"
  html += `<button class="btn-cat" onclick="cargarProductos()">Todas</button> `;

  // Botones de categorías
  categoriasUnicas.forEach(cat => {
    html += `<button class="btn-cat" onclick="cargarProductos('${cat}')">${cat}</button> `;
  });

  contenedor.innerHTML = html;
}

// Ejecutar al cargar
cargarProductos();
