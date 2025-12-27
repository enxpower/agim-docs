// === CONFIG: set these two ===
const DRIVE_API_KEY = "AIzaSyBflKsztPHlYFSM5oMTgsBqrXFtwQ2rFSg";
const DRIVE_FOLDER_ID = "1ZqY1PNVU5rvZ64-BJQygvWPks9SmOr3F";

// === classification rules ===
const RULES = {
  specs: ["spec", "datasheet", "technical"],
  contracts: ["contract", "agreement", "terms", "msa", "eula"],
  certs: ["cert", "certificate", "ul", "iec", "en", "compliance", "listing", "rule21", "ieee1547"],
  images: [".png", ".jpg", ".jpeg", ".webp", "image", "photo", "picture"],
};

const CATEGORY_TARGETS = {
  specs: "cat_specs",
  contracts: "cat_contracts",
  certs: "cat_certs",
  images: "cat_images",
  other: "cat_other",
};

const state = {
  all: [],
  filtered: [],
};

function normalize(s){ return (s || "").toLowerCase(); }

function classify(name){
  const n = normalize(name);
  const hit = (arr) => arr.some(k => n.includes(k));
  if (hit(RULES.specs)) return "specs";
  if (hit(RULES.contracts)) return "contracts";
  if (hit(RULES.certs)) return "certs";
  if (hit(RULES.images)) return "images";
  return "other";
}

function driveDownloadUrl(fileId){
  return `https://drive.google.com/uc?id=${encodeURIComponent(fileId)}&export=download`;
}

function extFromName(name){
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toUpperCase() : "FILE";
}

function el(tag, cls){
  const x = document.createElement(tag);
  if (cls) x.className = cls;
  return x;
}

function render(){
  // clear lists
  Object.values(CATEGORY_TARGETS).forEach(id => {
    const root = document.getElementById(id);
    root.innerHTML = "";
  });

  const groups = { specs: [], contracts: [], certs: [], images: [], other: [] };
  state.filtered.forEach(f => groups[f.category].push(f));

  // render each group
  for (const [cat, items] of Object.entries(groups)){
    const root = document.getElementById(CATEGORY_TARGETS[cat]);
    if (!items.length){
      const m = el("div", "muted");
      m.textContent = "No files.";
      root.appendChild(m);
      continue;
    }

    items
      .sort((a,b)=> a.name.localeCompare(b.name))
      .forEach(f => root.appendChild(renderItem(f)));
  }

  renderDownloads(state.filtered);
}

function renderItem(f){
  const row = el("div", "item");

  const left = el("div");
  const a = el("a", "name");
  a.href = f.url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = f.name;

  const meta = el("div", "meta");
  meta.textContent = "Google Drive";

  left.appendChild(a);
  left.appendChild(meta);

  const right = el("div", "badge");
  right.textContent = extFromName(f.name);

  row.appendChild(left);
  row.appendChild(right);
  return row;
}

function renderDownloads(files){
  const root = document.getElementById("downloads");
  root.innerHTML = "";

  // show top 12 (sorted)
  const top = [...files].sort((a,b)=>a.name.localeCompare(b.name)).slice(0, 12);
  if (!top.length){
    root.appendChild(Object.assign(el("div","muted"), {textContent:"No files."}));
    return;
  }

  top.forEach(f => {
    const a = el("a", "pill");
    a.href = f.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = f.name;
    root.appendChild(a);
  });
}

async function fetchAllFiles(){
  // Drive v3: list files in folder (public)
  const q = `'${DRIVE_FOLDER_ID}' in parents and trashed=false`;
  const fields = "files(id,name,mimeType)";
  const url =
    `https://www.googleapis.com/drive/v3/files?` +
    `q=${encodeURIComponent(q)}` +
    `&fields=${encodeURIComponent(fields)}` +
    `&pageSize=1000` +
    `&key=${encodeURIComponent(DRIVE_API_KEY)}`;

  const res = await fetch(url);
  if (!res.ok){
    const txt = await res.text().catch(()=> "");
    throw new Error(`Drive API error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const files = (data.files || [])
    .filter(f => f && f.id && f.name)
    .map(f => ({
      id: f.id,
      name: f.name,
      category: classify(f.name),
      url: driveDownloadUrl(f.id),
    }));
  return files;
}

function setStatus(msg, ok=false){
  const elx = document.getElementById("status");
  elx.textContent = msg;
  elx.className = ok ? "muted good" : "muted";
}

function wireSearch(){
  const input = document.getElementById("search");
  input.addEventListener("input", () => {
    const q = normalize(input.value.trim());
    if (!q){
      state.filtered = [...state.all];
    } else {
      state.filtered = state.all.filter(f => normalize(f.name).includes(q));
    }
    render();
  });
}

async function main(){
  document.getElementById("year").textContent = new Date().getFullYear();
  wireSearch();

  try{
    if (DRIVE_API_KEY.includes("PASTE_") || DRIVE_FOLDER_ID.includes("PASTE_")){
      setStatus("Please set DRIVE_API_KEY and DRIVE_FOLDER_ID in app.js", false);
      return;
    }
    const files = await fetchAllFiles();
    state.all = files;
    state.filtered = [...files];
    setStatus(`Loaded ${files.length} files.`, true);
    render();
  }catch(e){
    console.error(e);
    setStatus(String(e.message || e), false);
  }
}

main();
