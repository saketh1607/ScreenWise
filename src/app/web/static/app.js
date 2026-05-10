const candidateList = document.getElementById("candidate-list");
const candidateTemplate = document.getElementById("candidate-template");
const analysisForm = document.getElementById("analysis-form");
const leaderboard = document.getElementById("leaderboard");
const statusBanner = document.getElementById("status-banner");
const resultSubtitle = document.getElementById("result-subtitle");
const compareA = document.getElementById("compare-a");
const compareB = document.getElementById("compare-b");
const comparisonContent = document.getElementById("comparison-content");
const addCandidateButton = document.getElementById("add-candidate");
const textModeSection = document.getElementById("text-mode-section");
const fileModeSection = document.getElementById("file-mode-section");
const resumeFilesInput = document.getElementById("resume-files");
const dropZone = document.getElementById("drop-zone");
const uploadPreview = document.getElementById("upload-preview");
const previewStatus = document.getElementById("preview-status");
const profilePreviewCards = document.getElementById("profile-preview-cards");
const modeInputs = Array.from(document.querySelectorAll('input[name="analysis-mode"]'));
const historyList = document.getElementById("history-list");
const refreshHistoryButton = document.getElementById("refresh-history");
const clearHistoryButton = document.getElementById("clear-history");

let latestCandidates = [];
let selectedFiles = [];
const DEFAULT_API_BASE = "http://127.0.0.1:8001";
const HISTORY_STORAGE_KEY = "talentrank_scan_history";

function getApiBaseUrl() {
  const explicitBase = window.localStorage.getItem("talentrank_api_base");
  if (explicitBase) {
    return explicitBase.replace(/\/$/, "");
  }

  if (window.location.protocol === "file:") {
    return DEFAULT_API_BASE;
  }

  return window.location.origin;
}

function apiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createScanId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLocalHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(scans) {
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(scans.slice(0, 100)));
}

function normalizeKeyPart(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function listKeyPart(values) {
  return (values || []).map(normalizeKeyPart).sort().join(",");
}

function getScanKey(scan) {
  return [
    normalizeKeyPart(scan.job_title),
    normalizeKeyPart(scan.role_family),
    normalizeKeyPart(scan.job_description),
    listKeyPart(scan.required_skills),
    listKeyPart(scan.must_have_skills),
    listKeyPart(scan.nice_to_have_skills),
  ].join("|");
}

function getCandidateKey(candidate) {
  const directIdentity = candidate.email || candidate.phone || candidate.source_file;
  return normalizeKeyPart(directIdentity || candidate.name);
}

function sortedCandidates(candidates) {
  return [...(candidates || [])].sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0));
}

function mergeCandidates(existingCandidates, newCandidates) {
  const merged = new Map();
  [...(existingCandidates || []), ...(newCandidates || [])].forEach((candidate) => {
    const key = getCandidateKey(candidate);
    const previous = merged.get(key);
    if (!previous || Number(candidate.total_score || 0) >= Number(previous.total_score || 0)) {
      merged.set(key, candidate);
    }
  });
  return sortedCandidates(Array.from(merged.values()));
}

function mergeScanIntoHistory(history, scan) {
  const key = getScanKey(scan);
  const existingIndex = history.findIndex((item) => getScanKey(item) === key);
  const savedScan = {
    ...scan,
    scan_id: scan.scan_id || createScanId(),
    created_at: scan.created_at || new Date().toISOString(),
    ranked_candidates: sortedCandidates(scan.ranked_candidates || []),
  };

  if (existingIndex === -1) {
    return [savedScan, ...history];
  }

  const existing = history[existingIndex];
  const mergedScan = {
    ...existing,
    ...savedScan,
    scan_id: existing.scan_id || savedScan.scan_id,
    created_at: new Date().toISOString(),
    ranked_candidates: mergeCandidates(existing.ranked_candidates, savedScan.ranked_candidates),
  };

  return [
    mergedScan,
    ...history.filter((_, index) => index !== existingIndex),
  ];
}

function compactHistory(scans) {
  return [...scans].reverse().reduce((history, scan) => mergeScanIntoHistory(history, scan), []);
}

function saveScanToLocalHistory(scan) {
  const nextHistory = mergeScanIntoHistory(compactHistory(readLocalHistory()), scan);
  writeLocalHistory(nextHistory);
  return nextHistory[0];
}

function summarizeScan(scan) {
  const candidates = sortedCandidates(scan.ranked_candidates || []);
  const top = candidates[0] || {};
  return {
    scan_id: scan.scan_id,
    created_at: scan.created_at,
    job_title: scan.job_title || "Untitled scan",
    role_family: scan.role_family || "backend",
    candidate_count: candidates.length,
    top_candidate: top.name || null,
    top_score: top.total_score ?? null,
  };
}

function getAnalysisMode() {
  const selected = modeInputs.find((input) => input.checked);
  return selected ? selected.value : "text";
}

function updateModeVisibility() {
  const mode = getAnalysisMode();
  const isTextMode = mode === "text";

  textModeSection.classList.toggle("hidden-mode", !isTextMode);
  fileModeSection.classList.toggle("hidden-mode", isTextMode);
  addCandidateButton.classList.toggle("hidden-mode", !isTextMode);
}

function updateUploadPreview() {
  if (!selectedFiles.length) {
    uploadPreview.className = "upload-preview empty-state";
    uploadPreview.innerHTML = "<p>No files selected.</p>";
    profilePreviewCards.className = "profile-preview-cards empty-state";
    profilePreviewCards.innerHTML = "<p>Parsed profile previews will appear here.</p>";
    previewStatus.classList.add("hidden");
    return;
  }

  uploadPreview.className = "upload-preview";
  uploadPreview.innerHTML = `
    <p><strong>${selectedFiles.length}</strong> file(s) selected</p>
    <ul>${selectedFiles.map((file) => `<li>${file.name}</li>`).join("")}</ul>
  `;
}

function syncInputWithSelectedFiles() {
  const transfer = new DataTransfer();
  selectedFiles.forEach((file) => transfer.items.add(file));
  resumeFilesInput.files = transfer.files;
}

function setSelectedFiles(files) {
  selectedFiles = files;
  syncInputWithSelectedFiles();
  updateUploadPreview();
  void fetchUploadPreviews();
}

function renderProfilePreviews(previews) {
  if (!previews.length) {
    profilePreviewCards.className = "profile-preview-cards empty-state";
    profilePreviewCards.innerHTML = "<p>Parsed profile previews will appear here.</p>";
    return;
  }

  profilePreviewCards.className = "profile-preview-cards";
  profilePreviewCards.innerHTML = previews
    .map((preview) => {
      if (preview.status === "error") {
        return `
          <article class="profile-card error">
            <h4>${preview.file_name}</h4>
            <p class="profile-meta">Status: parse failed</p>
            <p>${preview.message || "Could not parse this file."}</p>
          </article>
        `;
      }

      const skills = (preview.detected_skills || []).map((skill) => `<span class="pill">${escapeHtml(skill)}</span>`).join("");
      const contact = [preview.email, preview.phone].filter(Boolean).map(escapeHtml).join(" | ");
      return `
        <article class="profile-card">
          <h4>${escapeHtml(preview.candidate_name || preview.file_name)}</h4>
          <p class="profile-meta">${escapeHtml(preview.file_name)} | ${preview.years_experience ?? 0} years detected</p>
          ${contact ? `<p class="profile-meta">${contact}</p>` : ""}
          <div class="pill-row">${skills || "<span class='pill'>No skill keywords detected</span>"}</div>
        </article>
      `;
    })
    .join("");
}

async function fetchUploadPreviews() {
  if (!selectedFiles.length) {
    return;
  }

  previewStatus.classList.remove("hidden");
  previewStatus.textContent = "Parsing uploaded resumes...";

  const formData = new FormData();
  selectedFiles.forEach((file) => {
    formData.append("resumes", file, file.name);
  });

  try {
    const response = await fetch(apiUrl("/v1/preview-files"), {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Preview parsing failed");
    }

    renderProfilePreviews(data.previews || []);
    previewStatus.textContent = "Preview ready. Parsed candidate profiles from uploaded resumes.";
  } catch (error) {
    profilePreviewCards.className = "profile-preview-cards empty-state";
    profilePreviewCards.innerHTML = "<p>Unable to parse preview right now.</p>";
    const message = error && error.message ? error.message : String(error);
    previewStatus.textContent = `Preview error: ${message}`;
  }
}

function splitCommaValues(value) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function addCandidate(data = {}) {
  const clone = candidateTemplate.content.cloneNode(true);
  const item = clone.querySelector(".candidate-item");

  item.querySelector(".candidate-name").value = data.name || "";
  item.querySelector(".candidate-years").value = data.years_experience || "";
  item.querySelector(".candidate-resume").value = data.resume_text || "";

  item.querySelector(".remove-candidate").addEventListener("click", () => {
    item.remove();
  });

  candidateList.appendChild(clone);
}

function collectCandidates() {
  const items = Array.from(candidateList.querySelectorAll(".candidate-item"));

  return items.map((item) => ({
    name: item.querySelector(".candidate-name").value.trim(),
    years_experience: Number(item.querySelector(".candidate-years").value || 0),
    resume_text: item.querySelector(".candidate-resume").value.trim(),
  }));
}

function collectFormContext() {
  return {
    jobTitle: document.getElementById("job-title").value.trim(),
    roleFamily: document.getElementById("role-family").value,
    jobDescription: document.getElementById("job-description").value.trim(),
    mustHaveInput: document.getElementById("must-have").value,
    niceToHaveInput: document.getElementById("nice-to-have").value,
  };
}

function validateTextCandidates(candidates) {
  if (!candidates.length) {
    return "Add at least one candidate.";
  }

  const hasInvalidCandidate = candidates.some(
    (candidate) => !candidate.name || !candidate.resume_text
  );
  if (hasInvalidCandidate) {
    return "Please provide complete data for all text candidates.";
  }

  return null;
}

function validateFileCandidates(files) {
  if (!files.length) {
    return "Upload at least one resume file.";
  }

  return null;
}

async function runTextAnalysis(context) {
  const payload = {
    job_title: context.jobTitle,
    role_family: context.roleFamily,
    job_description: context.jobDescription,
    must_have_skills: splitCommaValues(context.mustHaveInput),
    nice_to_have_skills: splitCommaValues(context.niceToHaveInput),
    candidates: collectCandidates(),
  };

  const validationError = validateTextCandidates(payload.candidates);
  if (validationError) {
    throw new Error(validationError);
  }

  return fetch(apiUrl("/v1/analyze"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function runFileAnalysis(context) {
  const validationError = validateFileCandidates(selectedFiles);
  if (validationError) {
    throw new Error(validationError);
  }

  const formData = new FormData();
  formData.append("job_title", context.jobTitle);
  formData.append("role_family", context.roleFamily);
  formData.append("job_description", context.jobDescription);
  formData.append("must_have_skills", context.mustHaveInput);
  formData.append("nice_to_have_skills", context.niceToHaveInput);

  selectedFiles.forEach((file) => {
    formData.append("resumes", file, file.name);
  });

  return fetch(apiUrl("/v1/analyze-files"), {
    method: "POST",
    body: formData,
  });
}

function setStatus(type, message) {
  statusBanner.classList.remove("hidden", "success", "error");
  statusBanner.classList.add(type === "error" ? "error" : "success");
  statusBanner.textContent = message;
}

function candidateContactLine(candidate) {
  const parts = [candidate.email, candidate.phone, candidate.source_file]
    .filter(Boolean)
    .map(escapeHtml);
  if (!parts.length) {
    return "";
  }
  return `<p class="candidate-contact">${parts.join(" | ")}</p>`;
}

function candidateScoreProfile(candidate) {
  const scores = [
    { label: "Required skills", value: Number(candidate.skill_score || 0) },
    { label: "Must-have", value: Number(candidate.must_have_match_rate || 0) },
    { label: "Nice-to-have", value: Number(candidate.nice_to_have_match_rate || 0) },
    { label: "Experience", value: Number(candidate.experience_score || 0) },
    { label: "Text similarity", value: Number(candidate.cosine_similarity_score || 0) },
  ];
  const highest = scores.reduce((best, item) => (item.value > best.value ? item : best), scores[0]);
  const lowest = scores.reduce((worst, item) => (item.value < worst.value ? item : worst), scores[0]);
  return `High: ${highest.label} ${highest.value.toFixed(1)} | Low: ${lowest.label} ${lowest.value.toFixed(1)}`;
}

function semanticEvidenceList(candidate) {
  return Object.entries(candidate.semantic_matches || {})
    .map(([target, support]) => `<li>${escapeHtml(target)}: ${escapeHtml(support.join(", "))}</li>`)
    .join("");
}

function renderKeywordPills(candidate) {
  return (candidate.extracted_keywords || [])
    .map((keyword) => `<span class="pill">${escapeHtml(keyword)}</span>`)
    .join("") || "<span class='pill'>none</span>";
}

function renderEntityGroups(candidate) {
  const entities = candidate.extracted_entities || {};
  const groups = Object.entries(entities).filter(([, values]) => Array.isArray(values) && values.length);
  if (!groups.length) {
    return "<p>No named entities extracted.</p>";
  }

  return groups
    .map(([group, values]) => `
      <div>
        <strong>${escapeHtml(group.replaceAll("_", " "))}:</strong>
        <div class="pill-row">${values.map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("")}</div>
      </div>
    `)
    .join("");
}

function scoreBar(label, value) {
  const safe = Math.max(0, Math.min(100, value));
  return `
    <div class="score-row">
      <span>${label}</span>
      <div class="score-bar"><div class="score-fill" style="width: ${safe}%"></div></div>
      <strong>${safe.toFixed(1)}</strong>
    </div>
  `;
}

function renderLeaderboard(candidates) {
  const rankedCandidates = sortedCandidates(candidates);
  if (!rankedCandidates.length) {
    leaderboard.className = "leaderboard empty-state";
    leaderboard.innerHTML = "<p>No candidates returned from analysis.</p>";
    return;
  }

  leaderboard.className = "leaderboard";
  leaderboard.innerHTML = rankedCandidates
    .map((candidate, index) => {
      const hardClass = candidate.hard_constraint_passed ? "good" : "warn";
      const hardLabel = candidate.hard_constraint_passed ? "Hard Constraint Passed" : "Hard Constraint Risk";
      const semanticRows = semanticEvidenceList(candidate);
      const detailsId = `candidate-details-${index}`;

      return `
        <article class="candidate-card" style="animation-delay:${index * 80}ms">
          <div class="candidate-top">
            <div>
              <h3>#${index + 1} ${escapeHtml(candidate.name)}</h3>
              ${candidateContactLine(candidate)}
              <p class="candidate-summary">${escapeHtml(candidateScoreProfile(candidate))}</p>
            </div>
            <span class="badge ${hardClass}">${hardLabel}</span>
          </div>
          <div class="candidate-actions">
            <strong>Total: ${Number(candidate.total_score || 0).toFixed(1)}</strong>
            <button type="button" class="btn btn-secondary toggle-details" data-target="${detailsId}">Show Result</button>
          </div>
          <div id="${detailsId}" class="candidate-details hidden">
            ${scoreBar("Total", candidate.total_score)}
            ${scoreBar("Required Skill", candidate.skill_score)}
            ${scoreBar("Must-Have", candidate.must_have_match_rate)}
            ${scoreBar("Nice-To-Have", candidate.nice_to_have_match_rate)}
            ${scoreBar("Experience", candidate.experience_score)}
            ${scoreBar("Cosine Similarity", candidate.cosine_similarity_score || 0)}
            <div>
              <strong>Matched Skills:</strong>
              <div class="pill-row">${(candidate.matched_skills || []).map((skill) => `<span class="pill">${escapeHtml(skill)}</span>`).join("") || "<span class='pill'>none</span>"}</div>
            </div>
            <div>
              <strong>Missing Skills:</strong>
              <div class="pill-row">${(candidate.missing_skills || []).map((skill) => `<span class="pill miss">${escapeHtml(skill)}</span>`).join("") || "<span class='pill'>none</span>"}</div>
            </div>
            <div>
              <strong>NLP Keywords:</strong>
              <div class="pill-row">${renderKeywordPills(candidate)}</div>
            </div>
            <div>
              <strong>NER Entities:</strong>
              <div class="entity-groups">${renderEntityGroups(candidate)}</div>
            </div>
            <p><strong>Strengths:</strong> ${escapeHtml((candidate.strengths || []).join(" | ") || "None")}</p>
            <p><strong>Concerns:</strong> ${escapeHtml((candidate.concerns || []).join(" | ") || "None")}</p>
            <p><strong>Semantic Evidence:</strong></p>
            <ul>${semanticRows || "<li>None</li>"}</ul>
          </div>
        </article>
      `;
    })
    .join("");

  Array.from(leaderboard.querySelectorAll(".toggle-details")).forEach((button) => {
    button.addEventListener("click", () => {
      const details = document.getElementById(button.dataset.target);
      if (!details) {
        return;
      }
      const shouldShow = details.classList.contains("hidden");
      details.classList.toggle("hidden", !shouldShow);
      button.textContent = shouldShow ? "Hide Result" : "Show Result";
    });
  });
}

function fillComparisonSelects(candidates) {
  latestCandidates = sortedCandidates(candidates);
  const options = latestCandidates
    .map((candidate, idx) => `<option value="${idx}">${escapeHtml(candidate.name)} (${Number(candidate.total_score || 0).toFixed(1)})</option>`)
    .join("");

  compareA.innerHTML = options;
  compareB.innerHTML = options;

  if (candidates.length > 1) {
    compareA.value = "0";
    compareB.value = "1";
  }

  renderComparison();
}

function compareCard(candidate) {
  const semanticRows = semanticEvidenceList(candidate);

  return `
    <article class="compare-card">
      <h4>${escapeHtml(candidate.name)}</h4>
      ${candidateContactLine(candidate)}
      ${scoreBar("Total", candidate.total_score)}
      ${scoreBar("Skill", candidate.skill_score)}
      ${scoreBar("Must-Have", candidate.must_have_match_rate)}
      ${scoreBar("Cosine", candidate.cosine_similarity_score || 0)}
      <p><strong>NLP Keywords:</strong></p>
      <div class="pill-row">${renderKeywordPills(candidate)}</div>
      <p><strong>Strengths:</strong> ${escapeHtml((candidate.strengths || []).join(" | ") || "None")}</p>
      <p><strong>Concerns:</strong> ${escapeHtml((candidate.concerns || []).join(" | ") || "None")}</p>
      <p><strong>Semantic Evidence:</strong></p>
      <ul>${semanticRows || "<li>None</li>"}</ul>
    </article>
  `;
}

function renderComparison() {
  if (latestCandidates.length < 2) {
    comparisonContent.className = "comparison-content empty-state";
    comparisonContent.innerHTML = "<p>Add at least 2 candidates to compare.</p>";
    return;
  }

  const a = latestCandidates[Number(compareA.value)];
  const b = latestCandidates[Number(compareB.value)];

  if (!a || !b) {
    return;
  }

  comparisonContent.className = "comparison-content";
  comparisonContent.innerHTML = `<div class="compare-grid">${compareCard(a)}${compareCard(b)}</div>`;
}

function renderSavedScan(scan) {
  resultSubtitle.textContent = `${scan.job_title} | role profile: ${scan.role_family} | saved scan`;
  const candidates = sortedCandidates(scan.ranked_candidates || []);
  renderLeaderboard(candidates);
  fillComparisonSelects(candidates);
  setStatus("success", "Loaded saved ranking from earlier scan.");
}

function loadSavedScan(scanId) {
  const scan = readLocalHistory().find((item) => item.scan_id === scanId);
  if (!scan) {
    throw new Error("Could not load saved scan from browser storage");
  }
  renderSavedScan(scan);
}

function renderHistory(scans) {
  if (!scans.length) {
    historyList.className = "history-list empty-state";
    historyList.innerHTML = "<p>No saved scans yet. Run resume screening once to create history.</p>";
    return;
  }

  historyList.className = "history-list";
  historyList.innerHTML = scans
    .map((scan) => `
      <article class="history-item">
        <div>
          <h3>${escapeHtml(scan.job_title)}</h3>
          <p>${escapeHtml(scan.created_at)} | ${escapeHtml(scan.role_family)} | ${scan.candidate_count} candidate(s)</p>
          <p>Top: ${escapeHtml(scan.top_candidate || "None")} ${scan.top_score == null ? "" : `(${Number(scan.top_score).toFixed(1)})`}</p>
        </div>
        <button type="button" class="btn btn-secondary load-scan" data-scan-id="${escapeHtml(scan.scan_id)}">Load Ranking</button>
      </article>
    `)
    .join("");

  Array.from(historyList.querySelectorAll(".load-scan")).forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        loadSavedScan(button.dataset.scanId);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        setStatus("error", `Error: ${message}`);
      }
    });
  });
}

function fetchHistory() {
  const compacted = compactHistory(readLocalHistory());
  writeLocalHistory(compacted);
  renderHistory(compacted.map(summarizeScan));
}

function clearLocalHistory() {
  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  fetchHistory();
  setStatus("success", "Earlier scans cleared from this browser.");
}

addCandidateButton.addEventListener("click", () => addCandidate());
compareA.addEventListener("change", renderComparison);
compareB.addEventListener("change", renderComparison);
refreshHistoryButton.addEventListener("click", fetchHistory);
clearHistoryButton.addEventListener("click", clearLocalHistory);
modeInputs.forEach((modeInput) => {
  modeInput.addEventListener("change", updateModeVisibility);
});
resumeFilesInput.addEventListener("change", () => {
  setSelectedFiles(Array.from(resumeFilesInput.files || []));
});

dropZone.addEventListener("click", () => {
  resumeFilesInput.click();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    resumeFilesInput.click();
  }
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("active");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("active");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("active");
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) {
    return;
  }
  setSelectedFiles(files);
});

analysisForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  setStatus("success", "Running analysis...");

  try {
    const mode = getAnalysisMode();
    const context = collectFormContext();
    const response = mode === "files"
      ? await runFileAnalysis(context)
      : await runTextAnalysis(context);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Analysis request failed");
    }

    resultSubtitle.textContent = `${data.job_title} | role profile: ${data.role_family}`;
    const savedScan = saveScanToLocalHistory({
      ...data,
      job_description: context.jobDescription,
    });
    resultSubtitle.textContent = `${savedScan.job_title} | role profile: ${savedScan.role_family}`;
    renderLeaderboard(savedScan.ranked_candidates || []);
    fillComparisonSelects(savedScan.ranked_candidates || []);
    fetchHistory();
    setStatus("success", "Analysis complete. Ranking merged into this job's saved leaderboard.");
  } catch (error) {
    const baseMessage = error && error.message ? error.message : String(error);
    if (baseMessage.toLowerCase().includes("failed to fetch")) {
      setStatus(
        "error",
        "Error: Failed to reach API. Start backend with uvicorn and open dashboard at the same origin or set localStorage talentrank_api_base."
      );
      return;
    }

    setStatus("error", `Error: ${baseMessage}`);
  }
});

addCandidate({
  name: "Aman",
  years_experience: 4,
  resume_text:
    "Python, FastAPI, AWS, Docker, PostgreSQL, API optimization, monitoring, CI/CD",
});
addCandidate({
  name: "Riya",
  years_experience: 3,
  resume_text:
    "Django, Azure, Kubernetes, Terraform, SQL, backend service integrations, observability",
});
addCandidate({
  name: "Nikhil",
  years_experience: 5,
  resume_text:
    "Java Spring, microservices, AWS, Docker, Jenkins, PostgreSQL, incident response",
});

  updateModeVisibility();
  updateUploadPreview();
  fetchHistory();
