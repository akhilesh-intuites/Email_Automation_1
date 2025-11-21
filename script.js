// script.js (FULL updated file)
// Replaces 'Add ID to Title' modal with a multi-select candidate picker (Option C)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
/* ---------------- Supabase config ---------------- */
const SUPABASE_URL = "https://wltbgkbljjhkwmomosxo.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdGJna2Jsampoa3dtb21vc3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzIzNjMsImV4cCI6MjA3OTMwODM2M30.eXiy1rQKCeYIGOtayYTXF3kQU5iTCt3iMuhhTC_oyLg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

/*---------------- Webhook (Google Apps Script) ----------------*/
const EDGE_SHEET_URL =
  "https://oykgmkoplpcbwohmvvfh.supabase.co/functions/v1/quick-endpoint";

/* ---------------- DOM references ---------------- */
const statusEl = document.getElementById("connectionStatus");
const tableBody = document.querySelector("#dataTable tbody");
const form = document.getElementById("candidateForm");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelEditBtn");
const searchEl = document.getElementById("searchInput");
const openFormBtn = document.getElementById("openFormBtn");

// Title Map UI refs
const titleMapBtn = document.getElementById("titleMapBtn");
const titleMapPopup = document.getElementById("titleMapPopup");
const closeTitleMap = document.getElementById("closeTitleMap");
const listEl = document.getElementById("list");
const searchInputTM = document.getElementById("searchInputTM");
const openAddBtnTM = document.getElementById("openAddBtnTM");
const modalBackTM = document.getElementById("modalBack"); // reused as the modal container for both add-title and multi-select
const editBackTM = document.getElementById("editBack");

const modeSelect = document.getElementById("modeSelect");
const newTitleInput = document.getElementById("newTitleInput");
const newItemInput = document.getElementById("newItemInput");
const selectTitleForItem = document.getElementById("selectTitleForItem");
const suggestionContainer = document.getElementById("suggestionContainer");
const submitModalBtn = document.getElementById("submitModalBtn");
const cancelBtnTM = document.getElementById("cancelBtnTM");
const editFields = document.getElementById("editFields");
const editSave = document.getElementById("editSave");
const editCancel = document.getElementById("editCancel");

/* ---------------- State ---------------- */
let allRows = []; // Email_Atm rows (full records)
let editingId = null; // Unique for candidate edit
let titles = []; // Title_Map rows cached
let currentEdit = null; // { type:'title' , id: titleid } for edit modal
let selectedCandidateId = null;
let suggestionTimer = null;

// small cache map Unique -> Candidate Name
let candidatesMap = new Map();
allRows.forEach((r) => {
  const uid = String(r.Unique); // <--- Always use correct column name
  const name = r["Candidate Name"] || "";
  candidatesMap.set(uid, name);
});

/* ---------------- Helpers ---------------- */
const encodeHTML = (str = "") =>
  String(str).replace(
    /[&<>"'`=\/]/g,
    (s) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#x60;",
        "=": "&#x3D;",
      }[s])
  );

function setStatusOk(text) {
  if (!statusEl) return;
  statusEl.classList.remove("error");
  statusEl.classList.add("ok");
  statusEl.textContent = `✅ ${text}`;
}
function setStatusErr(text) {
  if (!statusEl) return;
  statusEl.classList.remove("ok");
  statusEl.classList.add("error");
  statusEl.textContent = `❌ ${text}`;
}

/* ---------------- Candidates (core) ---------------- */
async function testConnection() {
  try {
    const { count, error } = await supabase
      .from("Email_Atm")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    setStatusOk(`Connected to Supabase (${count} records)`);
  } catch (e) {
    setStatusErr(`Failed to connect: ${e.message}`);
  }
}

// load full candidate rows and build candidatesMap
async function loadData() {
  try {
    const { data, error } = await supabase.from("Email_Atm").select("*");
    if (error) {
      setStatusErr(`Query failed: ${error.message}`);
      return;
    }
    allRows = data || [];
    // build candidatesMap - robust to different column casings
    candidatesMap = new Map();
    allRows.forEach((r) => {
      const uid = String(r.Unique ?? r.unique ?? "");
      const name =
        r["Candidate Name"] ?? r["candidate_name"] ?? r.CandidateName ?? "";
      candidatesMap.set(uid, name);
    });
    renderTable(allRows);
  } catch (err) {
    console.error("loadData error", err);
  }
}

// function renderTable(rows) {
//   if (!tableBody) return;
//   tableBody.innerHTML = "";
//   rows.forEach((row) => {
//     const tr = document.createElement("tr");
//     tr.innerHTML = `
//       <td>${row.Unique}</td>
//       <td>${encodeHTML(row["Candidate Name"] || "")}</td>
//       <td>${encodeHTML(row["Contact No"] || "")}</td>
//       <td>${encodeHTML(row.Email || "")}</td>
//       <td>
//   const skills = row.Skills ? encodeHTML(row.Skills) : "NULL";
// const showSkillsMore = row.Skills && row.Skills.length > 40;

//       <td>${encodeHTML(row["Visa status"] || "")}</td>
//       <td>${encodeHTML(row["Skype ID"] || "")}</td>
//       <td>${encodeHTML(row["Current Location"] || "")}</td>
//       <td>${encodeHTML(row["DOB(MM/DD)"] || "")}</td>
//       <td>${encodeHTML(row["Relocation (Yes/No)"] || "")}</td>
//       <td>${encodeHTML(row["Onsite or Remote:"] || "")}</td>
//       <td>
//   <span class="bachelor-text">
//     ${encodeHTML(row["Bachelor: University//year of completion"] || "")}
//   </span>
//   <span class="more-less-btn">More</span>
// </td>

// <td>
//   <span class="bachelor-text">
//     ${encodeHTML(row["Master's /university/ year of completion"] || "Null")}
//   </span>
//   <span class="more-less-btn">More</span>
// </td>

//       <td>${encodeHTML(row["SSN no. last 4 digit"] || "")}</td>
//       <td>${encodeHTML(row.LinkedIn || "")}</td>
//       <td>${encodeHTML(row["PP No"] || "")}</td>
//       <td>${encodeHTML(row["Total Exp"] || "")}</td>
//       <td>${encodeHTML(row["Total years of Exp in US"] || "")}</td>
//       <td>${encodeHTML(row["Availability for Project"] || "")}</td>
//       <td>${encodeHTML(row["Availability for Interview"] || "")}</td>
//       <td>${encodeHTML(row["Best Time to reach"] || "")}</td>
//       <td>${encodeHTML(row.Resume || "")}</td>
//       <td>${encodeHTML(row.DL || "")}</td>
//       <td>${encodeHTML(row.Title || "")}</td>
//       <td>${encodeHTML(row.Rate || "")}</td>
//       <td>${encodeHTML(row["Recruiter name"] || "")}</td>
//       <td>${encodeHTML(row["Recruiter email"] || "")}</td>
//       <td>${encodeHTML(row["Recruiter Phone"] || "")}</td>
//       <td>${encodeHTML(row.Match || "")}</td>
//       <td class="actions">
//         <button class="btn secondary btn-edit" data-id="${
//           row.Unique
//         }">Edit</button>
//         <button class="btn danger btn-delete" data-id="${
//           row.Unique
//         }" data-name="${encodeHTML(
//       row["Candidate Name"] || ""
//     )}">Delete</button>
//       </td>
//     `;
//     tableBody.appendChild(tr);
//   });
// }
// document.addEventListener("click", (e) => {
//   if (!e.target.classList.contains("more-less-btn")) return;

//   const btn = e.target;
//   const skillText = btn.previousElementSibling;

//   const expanded = skillText.classList.toggle("expanded");

//   btn.textContent = expanded ? "Less" : "More";
// });

function renderTable(rows) {
  if (!tableBody) return;
  rows = rows.sort((a, b) => Number(a.Unique) - Number(b.Unique));
  tableBody.innerHTML = "";

  rows.forEach((row) => {
    // Prepare values
    const skillsRaw = row.Skills || "";
    const skills = skillsRaw ? encodeHTML(skillsRaw) : "NULL";
    const skillsMore = skillsRaw && skillsRaw.length > 40;

    const bachelorRaw = row["Bachelor: University//year of completion"] || "";
    const bachelor = bachelorRaw ? encodeHTML(bachelorRaw) : "NULL";
    const bachelorMore = bachelorRaw && bachelorRaw.length > 40;

    const mastersRaw = row["Master's /university/ year of completion"] || "";
    const masters = mastersRaw ? encodeHTML(mastersRaw) : "NULL";
    const mastersMore = mastersRaw && mastersRaw.length > 40;

    // Resume link
    const resumeLink = row.Resume
      ? `<a href="${encodeHTML(row.Resume)}" target="_blank">Open Resume</a>`
      : "NULL";

    // DL link
    const dlLink = row.DL
      ? `<a href="${encodeHTML(row.DL)}" target="_blank">Open DL</a>`
      : "NULL";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.Unique}</td>
      <td>${encodeHTML(row["Candidate Name"] || "NULL")}</td>
      <td>${encodeHTML(row["Contact No"] || "NULL")}</td>
      <td>${encodeHTML(row.Email || "NULL")}</td>

      <td>
        <span class="skill-text">${skills}</span>
        ${skillsMore ? `<span class="more-less-btn">More</span>` : ""}
      </td>

      <td>${encodeHTML(row["Visa status"] || "NULL")}</td>
      <td>${encodeHTML(row["Skype ID"] || "NULL")}</td>
      <td>${encodeHTML(row["Current Location"] || "NULL")}</td>
      <td>${encodeHTML(row["DOB(MM/DD)"] || "NULL")}</td>
      <td>${encodeHTML(row["Relocation (Yes/No)"] || "NULL")}</td>
      <td>${encodeHTML(row["Onsite or Remote:"] || "NULL")}</td>

      <td>
        <span class="bachelor-text">${bachelor}</span>
        ${bachelorMore ? `<span class="more-less-btn">More</span>` : ""}
      </td>

      <td>
        <span class="bachelor-text">${masters}</span>
        ${mastersMore ? `<span class="more-less-btn">More</span>` : ""}
      </td>

      <td>${encodeHTML(row["SSN no. last 4 digit"] || "NULL")}</td>
      <td>${encodeHTML(row.LinkedIn || "NULL")}</td>
      <td>${encodeHTML(row["PP No"] || "NULL")}</td>
      <td>${encodeHTML(row["Total Exp"] || "NULL")}</td>
      <td>${encodeHTML(row["Total years of Exp in US"] || "NULL")}</td>
      <td>${encodeHTML(row["Availability for Project"] || "NULL")}</td>
      <td>${encodeHTML(row["Availability for Interview"] || "NULL")}</td>
      <td>${encodeHTML(row["Best Time to reach"] || "NULL")}</td>

      <td>${resumeLink}</td>
      <td>${dlLink}</td>

      <td>${encodeHTML(row.Title || "NULL")}</td>
      <td>${encodeHTML(row.Rate || "NULL")}</td>
      <td>${encodeHTML(row["Recruiter name"] || "NULL")}</td>
      <td>${encodeHTML(row["Recruiter email"] || "NULL")}</td>
      <td>${encodeHTML(row["Recruiter Phone"] || "NULL")}</td>
      <td>${encodeHTML(row.Match || "NULL")}</td>

      <td class="actions">
        <button class="btn secondary btn-edit" data-id="${
          row.Unique
        }">Edit</button>
        <button class="btn danger btn-delete" data-id="${row.Unique}"
          data-name="${encodeHTML(row["Candidate Name"] || "")}">
          Delete
        </button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".more-less-btn");
  if (!btn) return;

  const cell = btn.parentElement;

  // Find the preview span inside the same <td>
  const textSpan = cell.querySelector(".skill-text, .bachelor-text");
  if (!textSpan) return;

  textSpan.classList.toggle("expanded");

  btn.textContent = textSpan.classList.contains("expanded") ? "Less" : "More";
});

/* Candidate search */
if (searchEl) {
  searchEl.addEventListener("input", () => {
    const q = (searchEl.value || "").toLowerCase();
    if (!q) return renderTable(allRows);
    const filtered = allRows.filter((r) => {
      return [
        r["Candidate Name"],
        r.Email,
        r.Skills,
        r.Title,
        r["Recruiter name"],
        r["Current Location"],
      ]
        .map((v) => (v || "").toString().toLowerCase())
        .some((v) => v.includes(q));
    });
    renderTable(filtered);
  });
}

/* Candidate add/edit/delete handlers (UI) */

// if (openFormBtn)
//   openFormBtn.addEventListener("click", () => {
//     editingId = null;
//     form.reset();
//     submitBtn.textContent = "Add Candidate";
//     cancelBtn.classList.add("hidden");
//     form.classList.remove("hidden");
//     form.scrollIntoView({ behavior: "smooth" });
//   });
if (openFormBtn)
  openFormBtn.addEventListener("click", () => {
    // If form is visible → hide it
    if (!form.classList.contains("hidden")) {
      form.classList.add("hidden");
      form.reset();
      editingId = null;
      cancelBtn.classList.add("hidden");
      submitBtn.textContent = "Add Candidate";
      openFormBtn.textContent = "Add Candidate"; // change button text back
      return;
    }

    // If form is hidden → show it
    editingId = null;
    form.reset();
    submitBtn.textContent = "Add Candidate";
    cancelBtn.classList.add("hidden");
    form.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth" });

    openFormBtn.textContent = "Hide Candidate Form"; // toggle text
  });

if (cancelBtn)
  cancelBtn.addEventListener("click", () => {
    form.classList.add("hidden");
    form.reset();
    editingId = null;
  });

document.addEventListener("click", async (e) => {
  const btn = e.target.closest && e.target.closest("button");
  if (!btn) return;

  // candidate edit button (table)
  if (btn.classList.contains("btn-edit") && btn.closest("tr")) {
    const id = Number(btn.dataset.id);
    if (!id) return;
    const { data, error } = await supabase
      .from("Email_Atm")
      .select("*")
      .eq("Unique", id)
      .single();
    if (error) return alert("Error loading record: " + error.message);
    editingId = id;
    form.classList.remove("hidden");
    const set = (idSelector, v = "") => {
      const el = document.getElementById(idSelector);
      if (el) el.value = v || "";
    };
    set("candidateName", data["Candidate Name"]);
    set("contactNo", data["Contact No"]);
    set("email", data.Email);
    set("skills", data.Skills);
    set("visaStatus", data["Visa status"]);
    set("skypeId", data["Skype ID"]);
    set("currentLocation", data["Current Location"]);
    set("dob", data["DOB(MM/DD)"]);
    set("relocation", data["Relocation (Yes/No)"]);
    set("onsiteRemote", data["Onsite or Remote:"]);
    set("bachelor", data["Bachelor: University//year of completion"]);
    set("masters", data["Master's /university/ year of completion"]);
    set("ssn", data["SSN no. last 4 digit"]);
    set("linkedin", data.LinkedIn);
    set("ppNo", data["PP No"]);
    set("totalExp", data["Total Exp"]);
    set("expUS", data["Total years of Exp in US"]);
    set("availProject", data["Availability for Project"]);
    set("availInterview", data["Availability for Interview"]);
    set("bestTime", data["Best Time to reach"]);
    set("resume", data.Resume);
    set("dl", data.DL);
    set("title", data.Title);
    set("rate", data.Rate);
    set("recruiterName", data["Recruiter name"]);
    set("recruiterEmail", data["Recruiter email"]);
    set("recruiterPhone", data["Recruiter Phone"]);
    set("match", data.Match);
    submitBtn.textContent = "Update Candidate";
    cancelBtn.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth" });
    return;
  }

  // candidate delete (table)
  if (btn.classList.contains("btn-delete") && btn.closest("tr")) {
    const id = Number(btn.dataset.id);
    const name = btn.dataset.name || "this candidate";
    const modal = document.getElementById("deleteModal");
    document.getElementById(
      "deleteText"
    ).textContent = `Are you sure you want to delete "${name}"?`;
    modal.classList.remove("hidden");
    modal.dataset.pendingDelete = id;
    return;
  }

  // -- Title Map (delegated) handled in separate listener (listEl) --
});

// confirm delete candidate (table)
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
if (confirmDeleteBtn)
  confirmDeleteBtn.addEventListener("click", async () => {
    const modal = document.getElementById("deleteModal");
    const id = Number(modal.dataset.pendingDelete);
    if (!id) return;
    try {
      const { error } = await supabase
        .from("Email_Atm")
        .delete()
        .eq("Unique", id);
      if (error) throw error;

      // notify sheet
      await fetch(EDGE_SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "Candidates",
          action: "delete",
          record: { Unique: id },
        }),
      });

      modal.classList.add("hidden");
      await loadData();
      await loadTitles(); // keep title map names up to date
    } catch (err) {
      alert("Delete failed: " + (err.message || err));
    }
  });
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
if (cancelDeleteBtn)
  cancelDeleteBtn.addEventListener("click", () =>
    document.getElementById("deleteModal").classList.add("hidden")
  );

// submit candidate form
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };
    const record = {
      "Candidate Name": getVal("candidateName"),
      "Contact No": getVal("contactNo"),
      Email: getVal("email"),
      Skills: getVal("skills"),
      "Visa status": getVal("visaStatus"),
      "Skype ID": getVal("skypeId"),
      "Current Location": getVal("currentLocation"),
      "DOB(MM/DD)": getVal("dob"),
      "Relocation (Yes/No)": getVal("relocation"),
      "Onsite or Remote:": getVal("onsiteRemote"),
      "Bachelor: University//year of completion": getVal("bachelor"),
      "Master's /university/ year of completion": getVal("masters"),
      "SSN no. last 4 digit": getVal("ssn"),
      LinkedIn: getVal("linkedin"),
      "PP No": getVal("ppNo"),
      "Total Exp": getVal("totalExp"),
      "Total years of Exp in US": getVal("expUS"),
      "Availability for Project": getVal("availProject"),
      "Availability for Interview": getVal("availInterview"),
      "Best Time to reach": getVal("bestTime"),
      Resume: getVal("resume"),
      DL: getVal("dl"),
      Title: getVal("title"),
      Rate: getVal("rate"),
      "Recruiter name": getVal("recruiterName"),
      "Recruiter email": getVal("recruiterEmail"),
      "Recruiter Phone": getVal("recruiterPhone"),
      Match: getVal("match"),
    };

    try {
      if (editingId) {
        const { data, error } = await supabase
          .from("Email_Atm")
          .update(record)
          .eq("Unique", editingId)
          .select()
          .single();
        if (error) throw error;

        // notify sheet
        await fetch(EDGE_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "Candidates",
            action: "update",
            record: data,
          }),
        });

        alert("Candidate Updated!");
      } else {
        const { data, error } = await supabase
          .from("Email_Atm")
          .insert([record])
          .select()
          .single();
        if (error) throw error;

        await fetch(EDGE_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "Candidates",
            action: "insert",
            record: data,
          }),
        });

        alert("Candidate Added!");
      }

      editingId = null;
      form.reset();
      form.classList.add("hidden");
      cancelBtn.classList.add("hidden");
      await loadData();
      await loadTitles();
    } catch (err) {
      alert("Error saving candidate: " + (err.message || err));
    }
  });
}

/* ---------------- Title Map logic ---------------- */

if (titleMapBtn)
  titleMapBtn.addEventListener("click", async () => {
    await loadData(); // MUST reload candidate names first
    await loadTitles(); // now titles will show names
    titleMapPopup.classList.remove("hidden");
  });

if (closeTitleMap)
  closeTitleMap.addEventListener("click", () =>
    titleMapPopup.classList.add("hidden")
  );

// open Add Title modal (top Add button) - keep behavior for adding titles
if (openAddBtnTM)
  openAddBtnTM.addEventListener("click", () => {
    // Reuse modalBackTM for adding a new title (simple UI)
    modalBackTM.innerHTML = `
    <div class="modal-content">
      <h3>Add Title</h3>
      <div class="row"><label>Title</label><input id="modalNewTitle" class="input" /></div>
      <div class="modal-actions" style="margin-top:12px">
        <button id="modalSaveTitle" class="btn primary">Save</button>
        <button id="modalCancel" class="btn secondary">Cancel</button>
      </div>
    </div>
  `;
    modalBackTM.classList.remove("hidden");

    document.getElementById("modalCancel").addEventListener("click", () => {
      modalBackTM.classList.add("hidden");
    });
    document
      .getElementById("modalSaveTitle")
      .addEventListener("click", async () => {
        const name = (
          document.getElementById("modalNewTitle").value || ""
        ).trim();
        if (!name) return alert("Enter title name");
        try {
          const { data, error } = await supabase
            .from("Title_Map")
            .insert([{ title: name, ids: "" }])
            .select()
            .single();
          if (error) throw error;
          if (data && data.titleid) {
            await sendTitleMapToSheetByTitleId(data.titleid, "insert");
          }
          modalBackTM.classList.add("hidden");
          await loadTitles();
        } catch (err) {
          alert("Add title failed: " + (err.message || err));
        }
      });
  });

function onModeChange() {
  // this app no longer uses "add item" old path — keep for backward compatibility but not used
}
if (modeSelect) modeSelect.addEventListener("change", onModeChange);

// Load titles from Supabase and display
async function loadTitles() {
  if (!listEl) return;
  listEl.innerHTML = '<div class="muted">Loading titles...</div>';
  try {
    const { data, error } = await supabase
      .from("Title_Map")
      .select("*")
      .order("titleid");
    if (error) {
      listEl.innerHTML = `<div class="muted">Error loading titles: ${error.message}</div>`;
      console.error("loadTitles error", error);
      return;
    }
    // keep titles as array of objects { titleid, title, ids }
    titles = (data || []).map((t) => ({
      titleid: t.titleid,
      title: t.title || "",
      ids: t.ids || "",
    }));
    renderTitles();
    fillTitleDropdown();
  } catch (err) {
    console.error("loadTitles error", err);
    listEl.innerHTML = `<div class="muted">Error loading titles</div>`;
  }
}

// Render titles with candidate name items
function renderTitles(filter = "") {
  if (!listEl) return;
  listEl.innerHTML = "";
  const filtered = titles.filter((t) =>
    (t.title || "").toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) {
    listEl.innerHTML = '<div class="muted">No titles yet</div>';
    return;
  }

  filtered.forEach((t) => {
    // create card
    const card = document.createElement("div");
    card.className = "tile";
    // parse ids into array
    const idsArr = (t.ids || "")
      .toString()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // build items html - show CandidateName (ID:x) and action buttons
    const itemsHtml = idsArr
      .map((id) => {
        const name = candidatesMap.get(String(id)) || "Unknown";
        // each item contains data attributes for id and titleid for delegation
        return `
        <div class="tm-item" data-titleid="${
          t.titleid
        }" data-unique="${id}" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
          <div class="tm-item-left">${encodeHTML(name)} </div>
          <div class="tm-item-actions" style="display:flex;gap:8px">
           
            <button class="btn small btn-delete-item danger" data-unique="${id}" data-titleid="${
          t.titleid
        }">Delete</button>
          </div>
        </div>
      `;
      })
      .join("");

    // card HTML with header and actions (toggle + add item)
    card.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
    <div>
      <div class="title-name" style="font-weight:700;font-size:15px">
        ${encodeHTML(t.title)}
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn small btn-toggle" data-titleid="${t.titleid}">
        Details
      </button>
      <button class="btn small btn-add-item" data-titleid="${t.titleid}">
        Add Candidate
      </button>
      <div style="display:flex;gap:6px">
        <button class="btn secondary edit-title-btn small" data-id="${
          t.titleid
        }">
          Edit
        </button>
        <button class="btn danger delete-title-btn small" data-id="${
          t.titleid
        }">
          Delete
        </button>
      </div>
    </div>
  </div>

  <div class="tm-items" data-titleid="${t.titleid}"
       style="margin-top:10px; display:none;">
    ${itemsHtml || '<div class="muted">No items</div>'}
  </div>
`;

    listEl.appendChild(card);
  });
}

// Fill dropdown for add item modal (kept for compatibility, not used by multi-select)
function fillTitleDropdown() {
  if (!selectTitleForItem) return;
  selectTitleForItem.innerHTML = "";
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = "-- Select title --";
  selectTitleForItem.appendChild(opt);
  titles.forEach((t) => {
    const o = document.createElement("option");
    o.value = t.titleid;
    o.textContent = t.title;
    selectTitleForItem.appendChild(o);
  });
}

/* Submit modal - add title OR add item (old behavior) */
// We'll keep this attached to submitModalBtn to support the top Add Title button if you still use modeSelect.
// But multi-select is the new path for "+ Add Candidate" on a title row.
if (submitModalBtn)
  submitModalBtn.addEventListener("click", async () => {
    const mode = modeSelect ? modeSelect.value : "title";
    try {
      if (mode === "title") {
        const name = (newTitleInput.value || "").trim();
        if (!name) return alert("Enter title name");
        const { data, error } = await supabase
          .from("Title_Map")
          .insert([{ title: name, ids: "" }])
          .select()
          .single();
        if (error) return alert("Add title failed: " + error.message);
        const newId = data && data.titleid;
        if (newId) {
          await sendTitleMapToSheetByTitleId(newId, "insert");
        }
        modalBackTM.classList.add("hidden");
        await loadTitles();
      } else {
        // kept for backward compatibility, but you selected Option C so you probably won't use this.
        const titleId = Number(selectTitleForItem.value);
        const raw = (newItemInput.value || "").trim();
        if (!titleId || !raw)
          return alert("Select title and enter ID or select suggestion");

        let idToSave = selectedCandidateId || null;
        if (!idToSave) {
          const match = raw.match(/\b(\d+)\b/);
          if (match) idToSave = match[1];
        }
        if (!idToSave) return alert("Could not determine numeric ID.");

        const { data: tdata, error: terr } = await supabase
          .from("Title_Map")
          .select("ids")
          .eq("titleid", titleId)
          .single();
        if (terr) return alert("Unable to fetch title row: " + terr.message);
        const existing = tdata.ids
          ? tdata.ids
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s)
          : [];
        if (!existing.includes(String(idToSave)))
          existing.push(String(idToSave));
        const newIds = existing.join(",");
        const { error } = await supabase
          .from("Title_Map")
          .update({ ids: newIds })
          .eq("titleid", titleId);
        if (error) return alert("Add item failed: " + error.message);
        await sendTitleMapToSheetByTitleId(titleId, "update");
        modalBackTM.classList.add("hidden");
        await loadTitles();
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong: " + (err.message || err));
    }
  });

/* LIST clicks: edit / delete for Title Map (delegated) */
if (listEl)
  listEl.addEventListener("click", async (e) => {
    const el = e.target;

    // Toggle items
    const toggleBtn = el.closest(".btn-toggle");
    if (toggleBtn) {
      const titleid = toggleBtn.dataset.titleid;
      const itemsDiv = listEl.querySelector(
        `.tm-items[data-titleid="${titleid}"]`
      );
      if (itemsDiv)
        itemsDiv.style.display =
          itemsDiv.style.display === "none" ? "block" : "none";
      return;
    }

    // Add item quickly (opens the new multi-select modal)
    const addBtn = el.closest(".btn-add-item");
    if (addBtn) {
      const titleid = Number(addBtn.dataset.titleid);
      openMultiSelectForTitle(titleid);
      return;
    }

    // delete-title-btn (delete entire title)
    const delTitle = el.closest(".delete-title-btn");
    if (delTitle) {
      const id = Number(delTitle.dataset.id);
      if (!confirm("Delete this title and all its IDs?")) return;
      try {
        const { error } = await supabase
          .from("Title_Map")
          .delete()
          .eq("titleid", id);
        if (error) throw error;
        await fetch(EDGE_SHEET_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "Title_Map",
            action: "delete",
            record: { id },
          }),
        });
        await loadTitles();
      } catch (err) {
        alert("Delete failed: " + (err.message || err));
      }
      return;
    }

    // edit-title-btn (edit title name & ids)
    const editTitle = el.closest(".edit-title-btn");
    if (editTitle) {
      const id = Number(editTitle.dataset.id);
      const t = titles.find((x) => x.titleid === id);
      if (!t) return;
      currentEdit = { type: "title", id };
      editFields.innerHTML = `
      <div class="row modal-row">
      <label for="editTitleInput">Title</label>
      <input class="input modal-input" type="text" id="editTitleInput"
      placeholder="Enter new title"
      value="${encodeHTML(t.title)}" class="input" /></div>
      
      
      
    `;
      editBackTM.classList.remove("hidden");
      return;
    }

    // edit item (open candidate edit modal)
    const editItem = el.closest(".btn-edit-item");
    if (editItem) {
      const unique = Number(editItem.dataset.unique);
      if (!unique) return;
      const { data, error } = await supabase
        .from("Email_Atm")
        .select("*")
        .eq("Unique", unique)
        .single();
      if (error) return alert("Error loading candidate: " + error.message);
      editingId = unique;
      form.classList.remove("hidden");
      const set = (idSelector, v = "") => {
        const el2 = document.getElementById(idSelector);
        if (el2) el2.value = v || "";
      };
      set("candidateName", data["Candidate Name"]);
      set("contactNo", data["Contact No"]);
      set("email", data.Email);
      set("skills", data.Skills);
      set("visaStatus", data["Visa status"]);
      set("skypeId", data["Skype ID"]);
      set("currentLocation", data["Current Location"]);
      set("dob", data["DOB(MM/DD)"]);
      set("relocation", data["Relocation (Yes/No)"]);
      set("onsiteRemote", data["Onsite or Remote:"]);
      set("bachelor", data["Bachelor: University//year of completion"]);
      set("masters", data["Master's /university/ year of completion"]);
      set("ssn", data["SSN no. last 4 digit"]);
      set("linkedin", data.LinkedIn);
      set("ppNo", data["PP No"]);
      set("totalExp", data["Total Exp"]);
      set("expUS", data["Total years of Exp in US"]);
      set("availProject", data["Availability for Project"]);
      set("availInterview", data["Availability for Interview"]);
      set("bestTime", data["Best Time to reach"]);
      set("resume", data.Resume);
      set("dl", data.DL);
      set("title", data.Title);
      set("rate", data.Rate);
      set("recruiterName", data["Recruiter name"]);
      set("recruiterEmail", data["Recruiter email"]);
      set("recruiterPhone", data["Recruiter Phone"]);
      set("match", data.Match);
      submitBtn.textContent = "Update Candidate";
      cancelBtn.classList.remove("hidden");
      form.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // delete item from a title
    const deleteItem = el.closest(".btn-delete-item");
    if (deleteItem) {
      const titleid = Number(deleteItem.dataset.titleid);
      const unique = String(deleteItem.dataset.unique);
      if (!confirm("Remove this candidate from the title?")) return;
      try {
        // fetch current ids for title
        const { data: tdata, error: terr } = await supabase
          .from("Title_Map")
          .select("ids")
          .eq("titleid", titleid)
          .single();
        if (terr) throw terr;
        const existing = tdata.ids
          ? tdata.ids
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const newArr = existing.filter((x) => String(x) !== String(unique));
        const newIds = newArr.join(",");
        const { error } = await supabase
          .from("Title_Map")
          .update({ ids: newIds })
          .eq("titleid", titleid);
        if (error) throw error;
        await sendTitleMapToSheetByTitleId(titleid, "update");
        await loadTitles();
      } catch (err) {
        alert("Failed removing item: " + (err.message || err));
      }
      return;
    }
  });

/* Edit modal save/cancel */
if (editCancel)
  editCancel.addEventListener("click", () => {
    editBackTM.classList.add("hidden");
    currentEdit = null;
  });
if (editSave)
  editSave.addEventListener("click", async () => {
    if (!currentEdit) return;
    const titleVal = document.getElementById("editTitleInput").value.trim();
    const idsVal = document.getElementById("editIdsInput").value.trim();
    try {
      const { error } = await supabase
        .from("Title_Map")
        .update({ title: titleVal, ids: idsVal })
        .eq("titleid", currentEdit.id);
      if (error) return alert("Update failed: " + error.message);
      await sendTitleMapToSheetByTitleId(currentEdit.id, "update");
      editBackTM.classList.add("hidden");
      currentEdit = null;
      await loadTitles();
    } catch (err) {
      alert("Failed updating: " + (err.message || err));
    }
  });

/* ---------------- Suggestion box for newItemInput (kept but not used for multi-select) ---------------- */
function ensureSuggestionHandlers() {
  if (!newItemInput) return;
  newItemInput.addEventListener("input", onNewItemInput);
  newItemInput.addEventListener("focus", onNewItemInput);
  newItemInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (suggestionContainer) suggestionContainer.innerHTML = "";
    }, 150);
  });
}
function destroySuggestions() {
  if (!newItemInput) return;
  newItemInput.removeEventListener("input", onNewItemInput);
  newItemInput.removeEventListener("focus", onNewItemInput);
  if (suggestionContainer) suggestionContainer.innerHTML = "";
  selectedCandidateId = null;
}
async function onNewItemInput() {
  const q = (newItemInput.value || "").trim();
  selectedCandidateId = null;
  if (!q) {
    if (suggestionContainer) suggestionContainer.innerHTML = "";
    return;
  }
  if (suggestionTimer) clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => showSuggestions(q), 200);
}
async function showSuggestions(q) {
  if (!suggestionContainer) return;
  suggestionContainer.innerHTML = '<div class="muted">Searching...</div>';
  try {
    let results = [];
    if (/^\d+$/.test(q)) {
      const { data: exact } = await supabase
        .from("Email_Atm")
        .select('Unique,"Candidate Name"')
        .eq("Unique", Number(q))
        .limit(5);
      results = exact || [];
    }
    const { data: byName } = await supabase
      .from("Email_Atm")
      .select('Unique,"Candidate Name"')
      .ilike("Candidate Name", `%${q}%`)
      .limit(10);
    const map = new Map();
    (results || []).forEach((r) => map.set(String(r.Unique), r));
    (byName || []).forEach((r) => {
      if (!map.has(String(r.Unique))) map.set(String(r.Unique), r);
    });
    const merged = Array.from(map.values()).slice(0, 10);
    if (!merged.length) {
      suggestionContainer.innerHTML =
        '<div class="muted">No candidates found</div>';
      return;
    }
    suggestionContainer.innerHTML = merged
      .map(
        (c) => `
      <div class="suggestion-item" data-id="${
        c.Unique
      }" style="padding:6px;cursor:pointer;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>${encodeHTML(c["Candidate Name"] || "(no name)")}</strong>
          <div style="font-size:12px;color:#666"></div>
        </div>
        <div style="margin-left:8px;color:#0b5; font-weight:600">Select</div>
      </div>
    `
      )
      .join("");
    suggestionContainer.querySelectorAll(".suggestion-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const name = el.querySelector("strong").textContent;
        newItemInput.value = `${name} — ${id}`;
        selectedCandidateId = id;
        suggestionContainer.innerHTML = "";
      });
    });
  } catch (err) {
    suggestionContainer.innerHTML = `<div class="muted">Error: ${err.message}</div>`;
  }
}

/* ---------------- Multi-select modal implementation ---------------- */
/**
 * Opens a modal populated with all candidates (checkbox list). Pre-checks those currently in the title.
 * When saved, updates Title_Map.ids with comma-separated selected Unique ids.
 */
function openMultiSelectForTitle(titleId) {
  const titleObj = titles.find((t) => t.titleid === titleId);
  if (!titleObj) return alert("Title not found");

  // build modal HTML:
  // - search input to filter candidate list
  // - list of checkboxes (allRows)
  // - Save / Cancel buttons
  const currentIds = (titleObj.ids || "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const modalHtml = `
    <div class="modal-content" style="max-width:720px;">
      <h3 style="margin-bottom:8px">Add Candidates to: <strong>${encodeHTML(
        titleObj.title
      )}</strong></h3>
      <div style="margin-bottom:8px">
        <input id="multiSearch" placeholder="Search candidates by name or id..." class="input" style="width:100%;box-sizing:border-box;padding:8px" />
      </div>
      <div id="multiList" style="max-height:420px; overflow:auto; border:1px solid #eee; padding:8px; border-radius:6px;">
        ${allRows
          .map((r) => {
            const uid = String(r.Unique ?? r.unique ?? "");
            const name = r["Candidate Name"] ?? r["candidate_name"] ?? "";
            const checked = currentIds.includes(uid) ? "checked" : "";
            return `
            <label data-uid="${uid}" style="display:flex;align-items:center;gap:10px;padding:6px;border-bottom:1px solid rgba(0,0,0,0.03);">
              <input type="checkbox" class="multi-check" value="${encodeHTML(
                uid
              )}" ${checked} />
              <div style="flex:1">${encodeHTML(name)} </div>
            </label>
          `;
          })
          .join("")}
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button id="multiCancel" class="btn secondary">Cancel</button>
        <button id="multiSave" class="btn primary">Add Selected</button>
      </div>
    </div>
  `;
  modalBackTM.innerHTML = modalHtml;
  modalBackTM.classList.remove("hidden");

  // hook up search filtering inside modal
  const multiSearch = document.getElementById("multiSearch");
  const multiList = document.getElementById("multiList");
  if (multiSearch) {
    multiSearch.addEventListener("input", () => {
      const q = (multiSearch.value || "").toLowerCase().trim();
      const labels = Array.from(multiList.querySelectorAll("label"));
      labels.forEach((lbl) => {
        const uid = (lbl.dataset.uid || "").toString();
        const name = lbl.textContent.toLowerCase();
        const match = !q || uid.includes(q) || name.includes(q);
        lbl.style.display = match ? "flex" : "none";
      });
    });
  }

  // cancel handler
  document.getElementById("multiCancel").addEventListener("click", () => {
    modalBackTM.classList.add("hidden");
  });

  // save handler
  document.getElementById("multiSave").addEventListener("click", async () => {
    try {
      const checkedEls = Array.from(
        multiList.querySelectorAll(".multi-check:checked")
      );
      const selectedIds = checkedEls
        .map((i) => i.value.toString())
        .filter(Boolean);
      const newIdsCsv = selectedIds.join(",");

      const { error } = await supabase
        .from("Title_Map")
        .update({ ids: newIdsCsv })
        .eq("titleid", titleId);
      if (error) throw error;

      // notify sheet
      await sendTitleMapToSheetByTitleId(titleId, "update");

      modalBackTM.classList.add("hidden");
      await loadTitles();
    } catch (err) {
      alert("Failed to save selection: " + (err.message || err));
    }
  });
}

/* ---------------- Sheet sync helper ---------------- */
/**
 * payload.record:
 *   id: titleid
 *   ids: array of id strings
 *   title: title string
 */
async function sendTitleMapToSheetByTitleId(titleId, action = "update") {
  try {
    let row = null;
    if (action !== "delete") {
      const { data, error } = await supabase
        .from("Title_Map")
        .select("*")
        .eq("titleid", titleId)
        .single();
      if (error) {
        console.error("sendTitleMap fetch failed", error);
      } else {
        row = data;
      }
    }

    const idsArray =
      row && row.ids
        ? row.ids
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    const payload = {
      table: "Title_Map",
      action,
      record: {
        id: titleId,
        ids: idsArray,
        title: row ? row.title || "" : "",
      },
    };
    await fetch(EDGE_SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("sendTitleMapToSheet error", err);
  }
}

/* ---------------- Init ---------------- */
(async function init() {
  await testConnection();
  await loadData(); // loads Name, Unique, builds candidatesMap
  await loadTitles(); // now Title Map can use candidatesMap
})();
