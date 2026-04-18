import { createClient } from '@supabase/supabase-js';

// Configura tu proyecto Supabase
const supabaseUrl = "https://yibtjtlkaaphyikdsbvq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpYnRqdGxrYWFwaHlpa2RzYnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTE0MTUsImV4cCI6MjA5MjAyNzQxNX0.flnpvqOZNxS7uOny4TozRBveagv5j47rgnPhObKOKGU";
const supabase = createClient(supabaseUrl, supabaseKey);

document.getElementById("form-producto").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Capturar archivo de imagen y convertirlo a Base64
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
    img: imgBase64, // ahora sí guardamos la imagen
    activo: document.getElementById("activo").checked
  };

  const { error } = await supabase.from("productos").insert([producto]);

  if (error) {
    alert("Error al guardar: " + error.message);
  } else {
    alert("Producto agregado correctamente");
    cargarProductos();
    e.target.reset();
  }
});

// Conversión a Base64
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Función para cargar productos existentes
async function cargarProductos() {
  const lista = document.getElementById("lista-productos");
  lista.innerHTML = "";

  const { data: productos, error } = await supabase
    .from("productos")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    lista.innerHTML = "<p>Error al cargar productos</p>";
    return;
  }

 productos.forEach(p => {
  const item = document.createElement("div");
  item.className = "producto-item";
  item.innerHTML = `
    <span>${p.cat} - ${p.nombre} (${p.zelle} Zelle)</span>
    <img src="${p.img}" alt="${p.nombre}" style="max-width:100px">
    <button onclick="ocultarProducto(${p.id})">${p.activo ? "Ocultar" : "Mostrar"}</button>
  `;
  lista.appendChild(item);
});

}

// Función para ocultar/mostrar producto
window.ocultarProducto = async function(id) {
  // Buscar producto actual
  const { data, error } = await supabase
    .from("productos")
    .select("activo")
    .eq("id", id)
    .single();

  if (error) {
    alert("Error al obtener producto: " + error.message);
    return;
  }

  const nuevoEstado = !data.activo;

  const { error: updateError } = await supabase
    .from("productos")
    .update({ activo: nuevoEstado })
    .eq("id", id);

  if (updateError) {
    alert("Error al actualizar: " + updateError.message);
  } else {
    cargarProductos();
  }
};

// Ejecutar al cargar
cargarProductos();
