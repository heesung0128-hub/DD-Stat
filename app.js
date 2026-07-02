/**
 * 고등학생용 통계 분석 프로그램 - 메인 애플리케이션 (app.js)
 * UI 이벤트 처리, 데이터 업로드, 가사/테이블 조작, 차트 바인딩 및 자연어 해석을 담당합니다.
 */

// --- 전역 런타임 에러 & 오프라인 라이브러리 감지 장치 (디버깅 지원) ---
window.addEventListener('error', function(e) {
  let errorDetail = e.message;
  if (e.error) {
    errorDetail = e.error.stack || e.error.message || e.message;
  }
  showGlobalErrorBanner(`실행 오류 발생: ${errorDetail} (파일: ${e.filename ? e.filename.split('/').pop() : '알수없음'}, 라인: ${e.lineno})`);
});

function showGlobalErrorBanner(msg) {
  let banner = document.getElementById('global-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'global-error-banner';
    banner.style.cssText = "position:fixed; top:0; left:0; width:100%; background:hsl(5, 75%, 55%); color:white; padding:12px 20px; text-align:center; font-weight:bold; z-index:99999; font-size:13px; box-shadow:0 3px 12px rgba(0,0,0,0.25);";
    document.body.appendChild(banner);
  }
  banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation animate-pulse"></i> ${msg} <button onclick="this.parentElement.remove()" style="background:none; border:none; color:white; float:right; cursor:pointer; font-weight:bold; font-size:16px;">×</button>`;
}

// 필수 CDN 라이브러리 로딩 상태 사후 확인
window.addEventListener('load', () => {
  const missingLibs = [];
  if (typeof jStat === 'undefined') missingLibs.push('jStat (통계분포 계산)');
  if (typeof ss === 'undefined') missingLibs.push('Simple-Statistics (통계 연산)');
  if (typeof Chart === 'undefined') missingLibs.push('Chart.js (그래프 시각화)');
  if (typeof XLSX === 'undefined') missingLibs.push('SheetJS (엑셀 파일 처리)');
  if (typeof Papa === 'undefined') missingLibs.push('PapaParse (CSV 파일 처리)');

  if (missingLibs.length > 0) {
    showGlobalErrorBanner(`필수 외부 라이브러리 로드 실패: ${missingLibs.join(', ')}. <br>인터넷 오프라인 상태이거나 네트워크 방화벽이 차단했을 수 있습니다. 인터넷이 연결된 환경에서 다시 실행해주세요.`);
  }
});

// --- 전역 애플리케이션 상태 ---
const AppState = {
  data: [],        // 행 객체 배열: [{ 'Sleep_Hours': 7.5, 'Academic_Score': 85 }, ...]
  headers: [],     // 열 이름 배열: ['Sleep_Hours', 'Academic_Score']
  colTypes: {},    // 열 유형: { 'Sleep_Hours': 'continuous', 'Academic_Score': 'continuous' }
  valueLabels: {}, // 값 레이블 매핑: { '성별': { '1': '남자', '2': '여자' } }
  missingRules: {}, // 각 열별 결측값 규칙 지정: { '수면_시간': '99, 999' }
  chartInstance: null, // Chart.js 인스턴스
  selectedRows: new Set(), // 삭제용 선택 행 번호
  hypothesis: "",  // 연구 가설
  theme: "light"   // 테마: light / dark
};

// --- 값 레이블 (Value Labels) 헬퍼 함수 ---
function getValueLabelsString(col) {
  const map = AppState.valueLabels[col];
  if (!map) return "";
  return Object.keys(map).map(k => `${k}=${map[k]}`).join(", ");
}

function parseValueLabelsString(col, str) {
  if (!str || !str.trim()) {
    AppState.valueLabels[col] = {};
    return;
  }
  const map = {};
  const pairs = str.split(",");
  pairs.forEach(p => {
    const parts = p.split("=");
    if (parts.length === 2) {
      const k = parts[0].trim();
      const v = parts[1].trim();
      if (k && v) {
        map[k] = v;
      }
    }
  });
  AppState.valueLabels[col] = map;
}

// --- 값 레이블 치환 헬퍼 ---
function getValLabel(col, val) {
  const strVal = String(val).trim();
  if (AppState.valueLabels[col] && AppState.valueLabels[col][strVal] !== undefined) {
    return AppState.valueLabels[col][strVal];
  }
  return val;
}

// --- 결측값 판별 헬퍼 함수 ---
function isMissingValue(col, val) {
  if (val === "" || val === null || val === undefined) return true;
  const ruleStr = AppState.missingRules[col];
  if (!ruleStr) return false;
  
  const numVal = parseFloat(val);
  const cleanStr = ruleStr.trim();
  if (!cleanStr) return false;

  const parts = cleanStr.split(",");
  for (let part of parts) {
    part = part.trim();
    if (part.includes("-") && !part.startsWith("-")) {
      const rangeParts = part.split("-");
      if (rangeParts.length === 2) {
        const min = parseFloat(rangeParts[0]);
        const max = parseFloat(rangeParts[1]);
        if (!isNaN(min) && !isNaN(max) && !isNaN(numVal)) {
          if (numVal >= min && numVal <= max) return true;
        }
      }
    } else {
      const targetNum = parseFloat(part);
      if (!isNaN(targetNum) && !isNaN(numVal) && targetNum === numVal) {
        return true;
      }
      if (String(val).trim() === part) {
        return true;
      }
    }
  }
  return false;
}

// --- 엑셀 입력 양식 다운로드 함수 ---
function downloadExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    alert("SheetJS 라이브러리가 로드되지 않아 템플릿을 생성할 수 없습니다.");
    return;
  }
  const ws_data = [
    ["학생_이름", "수면_시간(시간)", "학업_성적(점수)", "성별", "선호_음식"], // 헤더 (상단 변수 제목)
    ["홍길동", 7.5, 85, 1, "한식"], // 예시 행 1
    ["이영희", 6.0, 72, 2, "일식"], // 예시 행 2
    ["김철수", 5.5, 65, 1, "양식"]  // 예시 행 3
  ];
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "데이터_입력_양식");
  XLSX.writeFile(wb, "DD_Stat_Template.xlsx");
}

// --- DOM 로드 시 초기화 ---
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  initUpload();
  initSampleData();
  initTableControls();
  initPreprocessTools();
  initInferLayout();
  initProbCalculator();
  initWizard();

  // 템플릿 다운로드 버튼 바인딩
  const downloadBtn = document.getElementById("btn-download-template");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadExcelTemplate);
  }
});

// --- 테마 설정 (다크/라이트 모드) ---
function initTheme() {
  const btnToggle = document.getElementById("btn-theme-toggle");
  
  // 시스템 기본값 또는 기존 설정 반영
  const savedTheme = localStorage.getItem("stats-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  AppState.theme = savedTheme;
  updateThemeUI();

  btnToggle.addEventListener("click", () => {
    AppState.theme = AppState.theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", AppState.theme);
    localStorage.setItem("stats-theme", AppState.theme);
    updateThemeUI();
    
    // 그려진 차트가 있다면 색상 갱신을 위해 재렌더링
    if (AppState.chartInstance) {
      triggerChartRefresh();
    }
  });
}

function updateThemeUI() {
  const btnToggle = document.getElementById("btn-theme-toggle");
  const icon = btnToggle.querySelector("i");
  const label = btnToggle.querySelector("span");

  if (AppState.theme === "dark") {
    icon.className = "fa-solid fa-sun";
    label.textContent = "라이트 모드";
  } else {
    icon.className = "fa-solid fa-moon";
    label.textContent = "다크 모드";
  }
}

function triggerChartRefresh() {
  const activeTab = document.querySelector(".sidebar-nav li.active").getAttribute("data-tab");
  if (activeTab === "tab-desc") {
    document.getElementById("btn-run-desc").click();
  } else if (activeTab === "tab-infer") {
    document.getElementById("btn-run-infer").click();
  } else if (activeTab === "tab-prob") {
    document.getElementById("btn-run-prob").click();
  }
}

// --- 탭 전환 로직 ---
function initTabs() {
  const navItems = document.querySelectorAll(".sidebar-nav li");
  const panes = document.querySelectorAll(".tab-pane");

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabId = item.getAttribute("data-tab");
      
      navItems.forEach(i => i.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));
      
      item.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      updateHeaderInfo(tabId);

      if (tabId === "tab-desc") {
        populateDescSelects();
      } else if (tabId === "tab-infer") {
        updateInferMethodOptions();
      }
    });
  });
}

function updateHeaderInfo(tabId) {
  const title = document.getElementById("current-tab-title");
  const subtitle = document.getElementById("current-tab-subtitle");

  switch(tabId) {
    case "tab-data":
      title.textContent = "데이터 입력 및 관리";
      subtitle.textContent = "CSV/Excel 파일을 불러오거나 스프레드시트에 직접 데이터를 작성하세요.";
      break;
    case "tab-desc":
      title.textContent = "기술통계 & 시각화";
      subtitle.textContent = "데이터의 기본 특성을 표와 그래프를 통해 한눈에 파악합니다.";
      break;
    case "tab-infer":
      title.textContent = "추론통계 분석";
      subtitle.textContent = "표본 데이터를 통해 모집단의 특성을 추정하고 가설을 검정합니다.";
      break;
    case "tab-prob":
      title.textContent = "확률분포 계산기";
      subtitle.textContent = "수학 교육과정 속의 이항분포와 정규분포의 확률을 계산하고 그래프로 이해합니다.";
      break;
    case "tab-guide":
      title.textContent = "분석 추천 도우미";
      subtitle.textContent = "내 데이터와 궁금증에 딱 맞는 통계 분석법을 찾아봅니다.";
      break;
  }
}

// --- 파일 업로드 (PapaParse & SheetJS 연동) ---
function initUpload() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const uploadBtn = dropZone.querySelector("button");

  uploadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener("click", () => fileInput.click());

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUploadedFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleUploadedFile(files[0]);
    }
  });
}

function handleUploadedFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  
  if (ext === "csv") {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: function(results) {
        processRawData(results.data, results.meta.fields);
      },
      error: function(err) {
        alert("CSV 파싱에 실패했습니다: " + err.message);
      }
    });
  } else if (ext === "xlsx" || ext === "xls") {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (json.length === 0) {
          alert("파일에 유효한 데이터 행이 없습니다.");
          return;
        }

        const fields = Object.keys(json[0]);
        processRawData(json, fields);
      } catch (err) {
        alert("엑셀 파일 파싱 중 오류가 발생했습니다: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert("지원하지 않는 파일 형식입니다. CSV 또는 Excel 파일을 선택해주세요.");
  }
}

function processRawData(parsedRows, fields) {
  let cleanFields = fields.filter(f => f && !String(f).startsWith("__EMPTY"));

  AppState.valueLabels = {};
  AppState.missingRules = {};
  AppState.headers = cleanFields;
  
  const tempRows = [];
  parsedRows.forEach(row => {
    const cleanRow = {};
    let hasData = false;
    cleanFields.forEach(f => {
      const val = row[f];
      if (val === "" || val === null || val === undefined) {
        cleanRow[f] = "";
      } else {
        const num = parseFloat(val);
        cleanRow[f] = isNaN(num) ? String(val).trim() : num;
        if (cleanRow[f] !== "") {
          hasData = true;
        }
      }
    });
    if (hasData) {
      tempRows.push(cleanRow);
    }
  });
  AppState.data = tempRows;

  AppState.colTypes = {};
  cleanFields.forEach(f => {
    let numericCount = 0;
    let totalCount = 0;
    
    AppState.data.forEach(row => {
      if (row[f] !== "") {
        totalCount++;
        if (typeof row[f] === "number") numericCount++;
      }
    });

    if (totalCount > 0 && numericCount / totalCount > 0.8) {
      AppState.colTypes[f] = "continuous";
    } else {
      AppState.colTypes[f] = "categorical";
    }
  });

  AppState.selectedRows.clear();
  updateDataWorkspace();
  showWorkspace(true);
}

function showWorkspace(show) {
  const workspace = document.getElementById("data-workspace");
  if (show) {
    workspace.classList.remove("hidden");
    document.getElementById("data-status-empty").classList.add("hidden");
    document.getElementById("data-status-active").classList.remove("hidden");
  } else {
    workspace.classList.add("hidden");
    document.getElementById("data-status-empty").classList.remove("hidden");
    document.getElementById("data-status-active").classList.add("hidden");
  }
}

// --- 샘플 데이터 탑재 ---
function initSampleData() {
  document.getElementById("btn-sample-study").addEventListener("click", () => {
    const sleep = [7.5, 6.0, 5.5, 8.0, 4.5, 7.0, 6.5, 5.0, 8.5, 6.0, 7.0, 5.5, 6.5, 7.5, 5.0, 6.0, 8.0, 4.0, 7.0, 6.5, 9.0, 5.8, 6.8, 7.2, 5.2, 6.2, 8.2, 4.8, 7.8, 6.4];
    const score = [85, 72, 65, 90, 50, 80, 78, 60, 92, 70, 82, 68, 75, 88, 62, 74, 86, 45, 81, 76, 95, 71, 80, 84, 61, 73, 89, 58, 87, 72];
    
    const rows = sleep.map((s, idx) => ({
      "수면_시간(시간)": s,
      "학업_성적(점수)": score[idx]
    }));
    processRawData(rows, ["수면_시간(시간)", "학업_성적(점수)"]);
  });

  document.getElementById("btn-sample-diet").addEventListener("click", () => {
    const genders = ["남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여"];
    const foods = ["한식", "일식", "양식", "한식", "양식", "일식", "한식", "일식", "양식", "한식", "한식", "한식", "양식", "일식", "양식", "한식", "한식", "일식", "양식", "일식", "한식", "한식", "양식", "일식", "양식", "일식", "한식", "한식", "양식", "일식"];
    
    const rows = genders.map((g, idx) => ({
      "성별": g,
      "선호_음식": foods[idx]
    }));
    processRawData(rows, ["성별", "선호_음식"]);
  });

  document.getElementById("btn-sample-score").addEventListener("click", () => {
    const groups = ["강의식", "강의식", "강의식", "강의식", "강의식", "토론식", "토론식", "토론식", "토론식", "토론식", "자기주도", "자기주도", "자기주도", "자기주도", "자기주도"];
    const math = [75, 80, 78, 85, 72, 85, 90, 88, 92, 86, 60, 65, 58, 62, 65];
    
    const rows = groups.map((g, idx) => ({
      "학습_방법": g,
      "수학_성적": math[idx]
    }));
    processRawData(rows, ["학습_방법", "수학_성적"]);
  });

  document.getElementById("btn-reset-data").addEventListener("click", () => {
    if (confirm("정말로 모든 데이터를 초기화하시겠습니까?")) {
      AppState.data = [];
      AppState.headers = [];
      AppState.colTypes = {};
      AppState.selectedRows.clear();
      showWorkspace(false);
      
      document.getElementById("summary-rows").textContent = "0";
      document.getElementById("summary-vars").textContent = "0";
      document.getElementById("summary-missing").textContent = "0";
    }
  });
}

// --- 테이블 렌더링 및 편집 인터랙션 ---
function updateDataWorkspace() {
  const summaryRows = document.getElementById("summary-rows");
  const summaryVars = document.getElementById("summary-vars");
  const summaryMissing = document.getElementById("summary-missing");
  const infoBadge = document.getElementById("data-info-badge");

  const numRows = AppState.data.length;
  const numCols = AppState.headers.length;
  let missingCount = 0;
  
  AppState.data.forEach(row => {
    let hasMissing = false;
    AppState.headers.forEach(h => {
      if (row[h] === "") hasMissing = true;
    });
    if (hasMissing) missingCount++;
  });

  summaryRows.textContent = numRows;
  summaryVars.textContent = numCols;
  summaryMissing.textContent = missingCount;
  infoBadge.textContent = `총 ${numRows}행, ${numCols}열`;

  const cardsContainer = document.getElementById("variable-cards-container");
  cardsContainer.innerHTML = "";
  
  AppState.headers.forEach((h, idx) => {
    const card = document.createElement("div");
    card.className = "variable-card";
    
    const title = document.createElement("h5");
    title.textContent = h;
    card.appendChild(title);
    
    const select = document.createElement("select");
    select.className = "form-control mt-1";
    select.innerHTML = `
      <option value="continuous" ${AppState.colTypes[h] === "continuous" ? "selected" : ""}>연속형 (수치)</option>
      <option value="categorical" ${AppState.colTypes[h] === "categorical" ? "selected" : ""}>범주형 (그룹/문자)</option>
      <option value="likert" ${AppState.colTypes[h] === "likert" ? "selected" : ""}>리커트 (순서형 척도)</option>
    `;
    select.addEventListener("change", (e) => {
      AppState.colTypes[h] = e.target.value;
      AppState.data.forEach(row => {
        if (row[h] !== "") {
          if (e.target.value === "continuous" || e.target.value === "likert") {
            const num = parseFloat(row[h]);
            if (!isNaN(num)) row[h] = num;
          } else {
            row[h] = String(row[h]);
          }
        }
      });
    });
    card.appendChild(select);

    const labelInputGroup = document.createElement("div");
    labelInputGroup.className = "mt-2";
    
    const labelTitle = document.createElement("label");
    labelTitle.style.fontSize = "11px";
    labelTitle.style.display = "block";
    labelTitle.style.marginBottom = "2px";
    labelTitle.textContent = "값 레이블 (예: 1=남, 2=여)";
    
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "form-control label-input mt-1";
    labelInput.placeholder = "예: 1=남, 2=여";
    labelInput.value = getValueLabelsString(h);
    
    labelInput.addEventListener("change", (e) => {
      parseValueLabelsString(h, e.target.value);
    });

    labelInputGroup.appendChild(labelTitle);
    labelInputGroup.appendChild(labelInput);
    card.appendChild(labelInputGroup);

    const missingInputGroup = document.createElement("div");
    missingInputGroup.className = "mt-2";
    
    const missingTitle = document.createElement("label");
    missingTitle.style.fontSize = "11px";
    missingTitle.style.display = "block";
    missingTitle.style.marginBottom = "2px";
    missingTitle.textContent = "결측값 지정 (예: 99, 999 또는 90-100)";
    
    const missingInput = document.createElement("input");
    missingInput.type = "text";
    missingInput.className = "form-control missing-input mt-1";
    missingInput.placeholder = "예: 99, 999 또는 90-100";
    missingInput.value = AppState.missingRules[h] || "";
    
    missingInput.addEventListener("change", (e) => {
      AppState.missingRules[h] = e.target.value;
    });

    missingInputGroup.appendChild(missingTitle);
    missingInputGroup.appendChild(missingInput);
    card.appendChild(missingInputGroup);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-danger mt-2 w-100";
    deleteBtn.style.padding = "4px 8px";
    deleteBtn.style.fontSize = "11px";
    deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> 이 열 삭제`;
    deleteBtn.addEventListener("click", () => {
      deleteColumn(h);
    });
    card.appendChild(deleteBtn);

    cardsContainer.appendChild(card);
  });

  resetAnalysisVariables();
}

function deleteColumn(colName) {
  if (AppState.headers.length <= 1) {
    alert("최소 1개 이상의 열이 존재해야 합니다.");
    return;
  }
  if (!confirm(`'${colName}' 열을 정말 삭제하시겠습니까? 데이터와 속성이 모두 삭제됩니다.`)) {
    return;
  }
  
  AppState.headers = AppState.headers.filter(h => h !== colName);
  
  AppState.data.forEach(row => {
    delete row[colName];
  });
  
  delete AppState.colTypes[colName];
  delete AppState.valueLabels[colName];
  if (AppState.missingRules) {
    delete AppState.missingRules[colName];
  }
  
  updateDataWorkspace();
}

function resetAnalysisVariables() {
  const headerRow = document.getElementById("table-header-row");
  const bodyRows = document.getElementById("table-body-rows");

  headerRow.innerHTML = `<th style="width: 40px;"><input type="checkbox" id="check-all-rows"></th>`;
  AppState.headers.forEach(h => {
    headerRow.innerHTML += `<th>${h}</th>`;
  });

  const checkAll = document.getElementById("check-all-rows");
  checkAll.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    const itemChecks = bodyRows.querySelectorAll(".row-select-check");
    itemChecks.forEach(chk => {
      chk.checked = isChecked;
      const idx = parseInt(chk.dataset.rowIndex);
      if (isChecked) AppState.selectedRows.add(idx);
      else AppState.selectedRows.delete(idx);
    });
  });

  bodyRows.innerHTML = "";
  AppState.data.forEach((row, rIdx) => {
    const tr = document.createElement("tr");
    tr.id = `data-tr-${rIdx}`;
    
    const tdCheck = document.createElement("td");
    tdCheck.innerHTML = `<input type="checkbox" class="row-select-check" data-row-index="${rIdx}" ${AppState.selectedRows.has(rIdx) ? "checked" : ""}>`;
    tdCheck.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) AppState.selectedRows.add(rIdx);
      else AppState.selectedRows.delete(rIdx);
    });
    tr.appendChild(tdCheck);

    AppState.headers.forEach(h => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = AppState.colTypes[h] === "continuous" ? "number" : "text";
      input.value = row[h];
      input.step = "any";
      
      input.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "") {
          AppState.data[rIdx][h] = "";
        } else {
          if (AppState.colTypes[h] === "continuous" || AppState.colTypes[h] === "likert") {
            const num = parseFloat(val);
            AppState.data[rIdx][h] = isNaN(num) ? val : num;
          } else {
            AppState.data[rIdx][h] = val;
          }
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    bodyRows.appendChild(tr);
  });
}

function initTableControls() {
  document.getElementById("btn-add-row").addEventListener("click", () => {
    const newRow = {};
    AppState.headers.forEach(h => {
      newRow[h] = "";
    });
    AppState.data.push(newRow);
    updateDataWorkspace();
  });

  document.getElementById("btn-add-col").addEventListener("click", () => {
    const colName = prompt("새로운 열(변수) 이름을 입력해 주세요:", `변수_${AppState.headers.length + 1}`);
    if (colName) {
      const cleanCol = colName.trim().replace(/\s+/g, "_");
      if (AppState.headers.includes(cleanCol)) {
        alert("이미 같은 이름의 열이 존재합니다.");
        return;
      }
      AppState.headers.push(cleanCol);
      AppState.colTypes[cleanCol] = "continuous";
      AppState.data.forEach(row => {
        row[cleanCol] = "";
      });
      updateDataWorkspace();
    }
  });

  document.getElementById("btn-delete-selected").addEventListener("click", () => {
    if (AppState.selectedRows.size === 0) {
      alert("삭제할 행을 체크해 주세요.");
      return;
    }

    if (confirm(`선택한 ${AppState.selectedRows.size}개의 행을 삭제하시겠습니까?`)) {
      const sortedIdxs = Array.from(AppState.selectedRows).sort((a, b) => b - a);
      sortedIdxs.forEach(idx => {
        AppState.data.splice(idx, 1);
      });
      AppState.selectedRows.clear();
      updateDataWorkspace();
    }
  });
}

// --- 결측값, 역코딩, 이상치 탐색 도구 ---
function initPreprocessTools() {
  document.getElementById("btn-apply-missing").addEventListener("click", () => {
    const method = document.getElementById("select-missing-handler").value;
    if (AppState.data.length === 0) return;

    if (method === "exclude") {
      AppState.data = AppState.data.filter(row => {
        return AppState.headers.every(h => row[h] !== null && row[h] !== undefined && row[h] !== "");
      });
    } else if (method === "mean") {
      AppState.headers.forEach(h => {
        if (AppState.colTypes[h] === "continuous") {
          const vals = AppState.data.map(row => parseFloat(row[h])).filter(v => !isNaN(v));
          if (vals.length > 0) {
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            AppState.data.forEach(row => {
              if (row[h] === "" || row[h] === null || row[h] === undefined) {
                row[h] = parseFloat(avg.toFixed(3));
              }
            });
          }
        }
      });
    } else if (method === "zero") {
      AppState.data.forEach(row => {
        AppState.headers.forEach(h => {
          if (row[h] === "" || row[h] === null || row[h] === undefined) {
            row[h] = AppState.colTypes[h] === "continuous" ? 0 : "0";
          }
        });
      });
    }

    updateDataWorkspace();
    alert("결측치 전처리가 완료되었습니다.");
  });

  document.getElementById("select-recode-col").addEventListener("focus", (e) => {
    e.target.innerHTML = `<option value="">변수 선택</option>` + AppState.headers
      .filter(h => AppState.colTypes[h] === "continuous" || AppState.colTypes[h] === "likert")
      .map(h => `<option value="${h}">${h}</option>`).join("");
  });

  document.getElementById("btn-apply-recode").addEventListener("click", () => {
    const colName = document.getElementById("select-recode-col").value;
    const scale = parseInt(document.getElementById("select-recode-scale").value);

    if (!colName) {
      alert("역코딩을 적용할 변수를 선택해 주세요.");
      return;
    }

    let count = 0;
    AppState.data.forEach(row => {
      const v = parseFloat(row[colName]);
      if (!isNaN(v) && v >= 1 && v <= scale) {
        row[colName] = (scale + 1) - v;
        count++;
      }
    });

    updateDataWorkspace();
    alert(`변수 '${colName}'의 척도(${scale}점 기준) 역코딩이 ${count}개 데이터에 적용되었습니다.`);
  });

  const outlierModal = document.getElementById("outlier-modal");
  const closeOutlier = document.getElementById("btn-close-outlier");
  const confirmOutlier = document.getElementById("btn-confirm-outlier");

  document.getElementById("btn-detect-outliers").addEventListener("click", () => {
    if (AppState.data.length === 0) return;

    AppState.headers.forEach(h => {
      AppState.data.forEach((r, idx) => {
        const tr = document.getElementById(`data-tr-${idx}`);
        if (tr) tr.style.backgroundColor = "";
      });
    });

    const outlierReport = [];
    AppState.headers.forEach(h => {
      if (AppState.colTypes[h] === "continuous") {
        const desc = StatsHelper.calculateDescriptive(AppState.data.map(r => r[h]));
        if (desc && desc.outliers.length > 0) {
          AppState.data.forEach((row, idx) => {
            const v = parseFloat(row[h]);
            if (!isNaN(v) && (v < desc.lowerBound || v > desc.upperBound)) {
              const tr = document.getElementById(`data-tr-${idx}`);
              if (tr) tr.style.backgroundColor = "var(--danger-light)";
              outlierReport.push({
                rowNum: idx + 1,
                variable: h,
                value: v,
                reason: v < desc.lowerBound ? `Q1 하한치(${desc.lowerBound.toFixed(2)}) 미만` : `Q3 상한치(${desc.upperBound.toFixed(2)}) 초과`
              });
            }
          });
        }
      }
    });

    const listDiv = document.getElementById("outlier-results-list");
    if (outlierReport.length === 0) {
      listDiv.innerHTML = `<p class="text-center py-4">탐지된 이상치(극단치)가 없습니다. 깨끗한 데이터셋입니다!</p>`;
    } else {
      let tableHtml = `
        <table class="data-table-result mt-2">
          <thead>
            <tr><th>행 번호</th><th>변수</th><th>입력값</th><th>판단 기준</th></tr>
          </thead>
          <tbody>
      `;
      outlierReport.forEach(item => {
        tableHtml += `
          <tr>
            <td><strong>${item.rowNum}행</strong></td>
            <td>${item.variable}</td>
            <td class="text-danger"><strong>${item.value}</strong></td>
            <td>${item.reason}</td>
          </tr>
        `;
      });
      tableHtml += `</tbody></table>`;
      listDiv.innerHTML = tableHtml;
    }

    outlierModal.classList.remove("hidden");
  });

  closeOutlier.addEventListener("click", () => outlierModal.classList.add("hidden"));
  confirmOutlier.addEventListener("click", () => {
    outlierModal.classList.add("hidden");
    AppState.data.forEach((r, idx) => {
      const tr = document.getElementById(`data-tr-${idx}`);
      if (tr) tr.style.backgroundColor = "";
    });
  });
}

// --- 기술통계 및 시각화 화면 ---
function populateDescSelects() {
  const select1 = document.getElementById("desc-select-var1");
  const select2 = document.getElementById("desc-select-var2");

  select1.innerHTML = `<option value="">-- 변수를 선택해 주세요 --</option>`;
  select2.innerHTML = `<option value="">-- 선택 안함 (단일 분석) --</option>`;

  AppState.headers.forEach(h => {
    const typeLabel = AppState.colTypes[h] === "continuous" ? "수치" : "범주";
    select1.innerHTML += `<option value="${h}">${h} (${typeLabel})</option>`;
    if (AppState.colTypes[h] === "categorical" || AppState.colTypes[h] === "likert") {
      select2.innerHTML += `<option value="${h}">${h} (범주)</option>`;
    }
  });

  document.getElementById("btn-run-desc").onclick = runDescriptiveAnalysis;
}

function runDescriptiveAnalysis() {
  const var1 = document.getElementById("desc-select-var1").value;
  const var2 = document.getElementById("desc-select-var2").value;
  let chartType = document.getElementById("desc-chart-type").value;

  if (!var1) {
    alert("최소 한 개의 변수를 선택해 주세요.");
    return;
  }

  let data1, data2;
  if (!var2) {
    data1 = AppState.data.map(r => r[var1]).filter(v => !isMissingValue(var1, v));
  } else {
    const pairData = AppState.data.filter(r => !isMissingValue(var1, r[var1]) && !isMissingValue(var2, r[var2]));
    data1 = pairData.map(r => r[var1]);
    data2 = pairData.map(r => r[var2]);
  }
  const type1 = AppState.colTypes[var1];

  const resultsEmpty = document.getElementById("desc-results-empty");
  const resultsContent = document.getElementById("desc-results-content");
  
  resultsEmpty.classList.add("hidden");
  resultsContent.classList.remove("hidden");

  const descTable = document.getElementById("desc-table");
  
  if (!var2) {
    if (type1 === "continuous") {
      const stats = StatsHelper.calculateDescriptive(data1);
      if (!stats) return;
      
      descTable.innerHTML = `
        <tr><th>기술 통계량</th><th>값</th><th>설명</th></tr>
        <tr><td><strong>표본 크기 (N)</strong></td><td>${stats.n}</td><td>수집한 표본(학생)의 총 개수</td></tr>
        <tr><td><strong>평균 (Mean)</strong></td><td>${stats.mean.toFixed(3)}</td><td>모든 데이터의 합을 개수로 나눈 값 (중심 경향)</td></tr>
        <tr><td><strong>중앙값 (Median)</strong></td><td>${stats.median.toFixed(3)}</td><td>데이터를 순서대로 세웠을 때 정중앙에 위치한 값</td></tr>
        <tr><td><strong>최빈값 (Mode)</strong></td><td>${stats.mode}</td><td>가장 자주 나타난 빈출 값</td></tr>
        <tr><td><strong>표준편차 (Std Dev)</strong></td><td>${stats.stdDev.toFixed(3)}</td><td>데이터가 평균에서 얼마나 멀리 떨어져 흩어져 있는지의 척도</td></tr>
        <tr><td><strong>분산 (Variance)</strong></td><td>${stats.variance.toFixed(3)}</td><td>표준편차의 제곱</td></tr>
        <tr><td><strong>최소값 / 최대값</strong></td><td>${stats.min} / ${stats.max}</td><td>가장 작은 측정치와 가장 큰 측정치</td></tr>
        <tr><td><strong>사분위수 범위 (IQR)</strong></td><td>${stats.iqr.toFixed(3)} (Q1: ${stats.q1}, Q3: ${stats.q3})</td><td>중앙 50% 데이터가 분포하는 범위</td></tr>
        <tr><td><strong>왜도 (Skewness)</strong></td><td>${stats.skewness.toFixed(3)}</td><td>분포가 좌우로 치우친 정도 (0에 가까우면 좌우대칭)</td></tr>
        <tr><td><strong>첨도 (Kurtosis)</strong></td><td>${stats.kurtosis.toFixed(3)}</td><td>분포가 위로 얼마나 뾰족한지의 정도 (0에 가까우면 정규분포 높이)</td></tr>
      `;
      
      if (chartType === "auto") chartType = "histogram";
      
    } else {
      const freqs = StatsHelper.calculateFrequency(data1);
      let html = `<tr><th>범주 값</th><th>빈도 (Count)</th><th>비율 (Percentage)</th></tr>`;
      freqs.list.forEach(item => {
        const valLabel = getValLabel(var1, item.value);
        html += `<tr><td><strong>${valLabel}</strong></td><td>${item.count}명</td><td>${item.percentage.toFixed(1)}%</td></tr>`;
      });
      html += `<tr class="highlight-row"><td><strong>합계</strong></td><td>${freqs.total}명</td><td>100.0%</td></tr>`;
      descTable.innerHTML = html;
      
      if (chartType === "auto") chartType = "bar";
    }
    
    renderDescInterpretation(var1, null);
    
  } else {
    const cross = StatsHelper.calculateCrossTab(data1, data2);
    
    let html = `<tr><th>${var1} \\ ${var2}</th>`;
    cross.cols.forEach(c => { html += `<th>${getValLabel(var2, c)}</th>`; });
    html += `<th>합계</th></tr>`;
    
    cross.rows.forEach(r => {
      html += `<tr><td><strong>${getValLabel(var1, r)}</strong></td>`;
      cross.cols.forEach(c => {
        html += `<td>${cross.table[r][c]}명</td>`;
      });
      html += `<td><strong>${cross.rowTotals[r]}명</strong></td></tr>`;
    });
    
    html += `<tr class="highlight-row"><td><strong>합계</strong></td>`;
    cross.cols.forEach(c => {
      html += `<td><strong>${cross.colTotals[c]}명</strong></td>`;
    });
    html += `<td><strong>${cross.n}명</strong></td></tr>`;
    descTable.innerHTML = html;
    
    if (chartType === "auto") chartType = "bar";
    renderDescInterpretation(var1, var2);
  }

  drawDescriptiveChart(var1, var2, chartType);
}

function drawDescriptiveChart(var1, var2, chartType) {
  const ctx = document.getElementById("desc-chart");
  const stemLeaf = document.getElementById("stem-leaf-display");
  
  if (AppState.chartInstance) {
    AppState.chartInstance.destroy();
    AppState.chartInstance = null;
  }
  
  ctx.classList.remove("hidden");
  stemLeaf.classList.add("hidden");

  let data1, data2;
  if (!var2) {
    data1 = AppState.data.map(r => r[var1]).filter(v => !isMissingValue(var1, v));
  } else {
    const pairData = AppState.data.filter(r => !isMissingValue(var1, r[var1]) && !isMissingValue(var2, r[var2]));
    data1 = pairData.map(r => r[var1]);
    data2 = pairData.map(r => r[var2]);
  }
  const isDark = AppState.theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#c8cdd4" : "#2d3748";

  const primaryColor = "rgba(114, 46, 209, 0.7)";
  const secondaryColor = "rgba(22, 119, 255, 0.7)";
  const hoverColor = "rgba(114, 46, 209, 0.9)";
  const palette = [
    "rgba(114, 46, 209, 0.7)",
    "rgba(22, 119, 255, 0.7)",
    "rgba(56, 158, 13, 0.7)",
    "rgba(212, 107, 8, 0.7)",
    "rgba(207, 19, 34, 0.7)",
    "rgba(19, 194, 194, 0.7)"
  ];

  if (chartType === "histogram") {
    const stats = StatsHelper.calculateDescriptive(data1);
    if (!stats) return;

    const numBins = Math.ceil(Math.log2(stats.n) + 1);
    const binWidth = stats.range / numBins;
    const bins = Array(numBins).fill(0);
    const binLabels = [];

    for (let i = 0; i < numBins; i++) {
      const start = stats.min + i * binWidth;
      const end = start + binWidth;
      binLabels.push(`${start.toFixed(1)}~${end.toFixed(1)}`);
    }

    data1.forEach(v => {
      let idx = Math.floor((v - stats.min) / binWidth);
      if (idx >= numBins) idx = numBins - 1;
      if (idx >= 0) bins[idx]++;
    });

    AppState.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: binLabels,
        datasets: [{
          label: `${var1} 빈도`,
          data: bins,
          backgroundColor: primaryColor,
          borderColor: "var(--primary)",
          borderWidth: 1,
          barPercentage: 1.0,
          categoryPercentage: 1.0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `${var1}의 도수분포 히스토그램`, color: textColor }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
        }
      }
    });

  } else if (chartType === "boxplot") {
    ctx.classList.add("hidden");
    stemLeaf.classList.remove("hidden");
    
    const stats = StatsHelper.calculateDescriptive(data1);
    if (!stats) return;

    stemLeaf.innerHTML = `<div style="text-align:center;font-weight:600;margin-bottom:8px;">${var1}의 상자그림 (Box Plot)</div><canvas id="custom-box-canvas" width="450" height="180"></canvas>`;
    const cvs = document.getElementById("custom-box-canvas");
    const c = cvs.getContext("2d");

    const padding = 40;
    const w = cvs.width - padding * 2;
    const h = cvs.height;
    
    const scale = (val) => padding + ((val - stats.min) / (stats.range || 1)) * w;

    c.clearRect(0,0,cvs.width,cvs.height);

    c.strokeStyle = isDark ? "#555" : "#ccc";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(padding, h - 40);
    c.lineTo(cvs.width - padding, h - 40);
    c.stroke();

    const ticks = [stats.min, stats.q1, stats.median, stats.q3, stats.max];
    ticks.forEach(t => {
      const x = scale(t);
      c.beginPath();
      c.moveTo(x, h - 45);
      c.lineTo(x, h - 35);
      c.stroke();
      c.fillStyle = textColor;
      c.font = "10px sans-serif";
      c.textAlign = "center";
      c.fillText(t.toFixed(1), x, h - 22);
    });

    const boxY = 40;
    const boxH = 60;
    const q1X = scale(stats.q1);
    const q3X = scale(stats.q3);
    const medX = scale(stats.median);
    const minX = scale(stats.min);
    const maxX = scale(stats.max);

    c.beginPath();
    c.moveTo(minX, boxY + boxH/2);
    c.lineTo(q1X, boxY + boxH/2);
    c.moveTo(q3X, boxY + boxH/2);
    c.lineTo(maxX, boxY + boxH/2);
    c.moveTo(minX, boxY + 15);
    c.lineTo(minX, boxY + boxH - 15);
    c.moveTo(maxX, boxY + 15);
    c.lineTo(maxX, boxY + boxH - 15);
    c.stroke();

    c.fillStyle = isDark ? "rgba(114, 46, 209, 0.4)" : "rgba(114, 46, 209, 0.15)";
    c.fillRect(q1X, boxY, q3X - q1X, boxH);
    c.strokeStyle = "var(--primary)";
    c.lineWidth = 2;
    c.strokeRect(q1X, boxY, q3X - q1X, boxH);

    c.strokeStyle = "var(--danger)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(medX, boxY);
    c.lineTo(medX, boxY + boxH);
    c.stroke();

    stats.outliers.forEach(outVal => {
      const outX = scale(outVal);
      c.fillStyle = "var(--danger)";
      c.beginPath();
      c.arc(outX, boxY + boxH/2, 5, 0, Math.PI * 2);
      c.fill();
    });

  } else if (chartType === "freq-polygon") {
    const stats = StatsHelper.calculateDescriptive(data1);
    if (!stats) return;

    const numBins = Math.ceil(Math.log2(stats.n) + 1);
    const binWidth = stats.range / numBins;
    const bins = Array(numBins).fill(0);
    
    data1.forEach(v => {
      let idx = Math.floor((v - stats.min) / binWidth);
      if (idx >= numBins) idx = numBins - 1;
      if (idx >= 0) bins[idx]++;
    });

    const polygonLabels = [];
    const polygonData = [];
    
    const startLeft = stats.min - binWidth;
    const endLeft = stats.min;
    polygonLabels.push(`${startLeft.toFixed(1)}~${endLeft.toFixed(1)}`);
    polygonData.push(0);
    
    for (let i = 0; i < numBins; i++) {
      const start = stats.min + i * binWidth;
      const end = start + binWidth;
      polygonLabels.push(`${start.toFixed(1)}~${end.toFixed(1)}`);
      polygonData.push(bins[i]);
    }
    
    const startRight = stats.min + numBins * binWidth;
    const endRight = startRight + binWidth;
    polygonLabels.push(`${startRight.toFixed(1)}~${endRight.toFixed(1)}`);
    polygonData.push(0);

    AppState.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: polygonLabels,
        datasets: [{
          label: "도수 (빈도)",
          data: polygonData,
          borderColor: "var(--primary)",
          backgroundColor: "rgba(114, 46, 209, 0.1)",
          fill: true,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "var(--primary)",
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `${var1}의 도수분포다각형`, color: textColor }
        },
        scales: {
          x: { title: { display: true, text: `계급 (${var1})`, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
          y: { title: { display: true, text: "도수(명)", color: textColor }, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 }, beginAtZero: true }
        }
      }
    });

  } else if (chartType === "grouped-bar" || chartType === "stacked-bar") {
    if (!var2) {
      alert("그룹형/누적 막대 그래프를 그리려면 두 번째 변수(교차비교 변수)를 선택해야 합니다.");
      return;
    }

    const cross = StatsHelper.calculateCrossTab(data1, data2);
    
    const chartPalette = [
      "rgba(114, 46, 209, 0.7)",
      "rgba(22, 119, 255, 0.7)",
      "rgba(56, 158, 13, 0.7)",
      "rgba(212, 107, 8, 0.7)",
      "rgba(207, 19, 34, 0.7)",
      "rgba(19, 194, 194, 0.7)"
    ];

    const datasets = cross.cols.map((colVal, colIdx) => {
      const datasetData = cross.rows.map(rowVal => cross.table[rowVal][colVal] || 0);
      return {
        label: getValLabel(var2, colVal),
        data: datasetData,
        backgroundColor: chartPalette[colIdx % chartPalette.length],
        borderWidth: 0
      };
    });

    const xLabels = cross.rows.map(r => getValLabel(var1, r));

    AppState.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: xLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: "top", labels: { color: textColor } },
          title: { display: true, text: `${var1}별 ${var2}의 ${chartType === "stacked-bar" ? "누적" : "그룹형"} 막대그래프`, color: textColor }
        },
        scales: {
          x: { 
            title: { display: true, text: var1, color: textColor },
            grid: { display: false }, 
            ticks: { color: textColor },
            stacked: chartType === "stacked-bar"
          },
          y: { 
            title: { display: true, text: "빈도(명)", color: textColor },
            grid: { color: gridColor }, 
            ticks: { color: textColor, stepSize: 1 }, 
            beginAtZero: true,
            stacked: chartType === "stacked-bar"
          }
        }
      }
    });

  } else if (chartType === "line") {
    const freqs = StatsHelper.calculateFrequency(data1);
    const labels = freqs.list.map(l => getValLabel(var1, l.value)).reverse();
    const values = freqs.list.map(l => l.count).reverse();

    AppState.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "빈도(명)",
          data: values,
          borderColor: "var(--primary)",
          backgroundColor: "rgba(114, 46, 209, 0.1)",
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "var(--primary)",
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `${var1}의 빈도 꺾은선그래프`, color: textColor }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 }, beginAtZero: true }
        }
      }
    });

  } else if (chartType === "bar") {
    const freqs = StatsHelper.calculateFrequency(data1);
    const labels = freqs.list.map(l => getValLabel(var1, l.value));
    const values = freqs.list.map(l => l.count);

    AppState.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "빈도(명)",
          data: values,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `${var1}의 범주별 빈도 막대그래프`, color: textColor }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 }, beginAtZero: true }
        }
      }
    });

  } else if (chartType === "pie") {
    const freqs = StatsHelper.calculateFrequency(data1);
    const labels = freqs.list.map(l => getValLabel(var1, l.value));
    const values = freqs.list.map(l => l.count);

    AppState.chartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? "#1f1f1f" : "#fff"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "right", labels: { color: textColor } },
          title: { display: true, text: `${var1}의 비율 원그래프`, color: textColor }
        }
      }
    });

  } else if (chartType === "scatter") {
    if (!var2 || AppState.colTypes[var2] !== "continuous") {
      alert("산점도를 그리려면 두 번째 변수(교차비교 변수)도 수치형(연속형)이어야 합니다.");
      return;
    }
    const points = AppState.data.map(row => ({
      x: parseFloat(row[var1]),
      y: parseFloat(row[var2])
    })).filter(pt => !isNaN(pt.x) && !isNaN(pt.y));

    AppState.chartInstance = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "관측치",
          data: points,
          backgroundColor: primaryColor,
          borderColor: "var(--primary)",
          borderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `${var1} vs ${var2} 산점도`, color: textColor }
        },
        scales: {
          x: { title: { display: true, text: var1, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
          y: { title: { display: true, text: var2, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }
        }
      }
    });

  } else if (chartType === "stemleaf") {
    ctx.classList.add("hidden");
    stemLeaf.classList.remove("hidden");

    const numericVals = data1.map(v => parseFloat(v)).filter(v => !isNaN(v)).sort((a,b)=>a-b);
    const stemLeafMap = {};
    
    numericVals.forEach(v => {
      const rounded = Math.round(v);
      const stem = Math.floor(rounded / 10);
      const leaf = rounded % 10;
      
      if (!stemLeafMap[stem]) stemLeafMap[stem] = [];
      stemLeafMap[stem].push(leaf);
    });

    let displayHtml = `<strong>[줄기-잎 그림]</strong> (단위: 십의 자리 | 일의 자리)\n\n`;
    Object.keys(stemLeafMap).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(stem => {
      const leaves = stemLeafMap[stem].sort((a,b)=>a-b).join(" ");
      displayHtml += `${String(stem).padStart(3, " ")} | ${leaves}\n`;
    });
    
    stemLeaf.innerHTML = `<pre class="stem-leaf-box">${displayHtml}</pre>`;
  }

  document.getElementById("btn-download-desc-chart").onclick = () => {
    if (chartType === "boxplot" || chartType === "stemleaf") {
      alert("줄기-잎 그림 및 상자그림은 텍스트/커스텀 드로잉 기반이므로 차트 다운로드가 제한됩니다.");
      return;
    }
    const url = ctx.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chart_${var1}.png`;
    a.click();
  };
}

function renderDescInterpretation(var1, var2) {
  const box = document.getElementById("desc-korean-interpretation");
  const data1 = AppState.data.map(r => r[var1]).filter(v => v !== "");
  const type1 = AppState.colTypes[var1];

  if (!var2) {
    if (type1 === "continuous") {
      const stats = StatsHelper.calculateDescriptive(data1);
      box.innerHTML = `
        <p>수집된 변수 <strong>'${var1}'</strong>의 분석 결과, 총 <strong>${stats.n}명</strong>의 데이터가 수집되었습니다.</p>
        <p>전체 학생들의 평균값은 <strong>${stats.mean.toFixed(2)}</strong>이며, 가운데 위치한 중앙값은 <strong>${stats.median.toFixed(2)}</strong>입니다. 표준편차는 <strong>${stats.stdDev.toFixed(2)}</strong>로 나타나 측정값들이 평균 주위로 비교적 어떻게 퍼져있는지 보여줍니다.</p>
        <p>왜도는 <strong>${stats.skewness.toFixed(2)}</strong>로 ${Math.abs(stats.skewness) < 1.0 ? "비교적 대칭적인 분포를 보입니다." : "한쪽으로 다소 치우쳐 있습니다."} 첨도는 <strong>${stats.kurtosis.toFixed(2)}</strong>입니다.</p>
      `;
    } else {
      const freqs = StatsHelper.calculateFrequency(data1);
      const top = freqs.list[0];
      box.innerHTML = `
        <p>범주형 변수 <strong>'${var1}'</strong>의 빈도를 분석한 결과, 가장 높은 비율을 차지한 항목은 <strong>'${getValLabel(var1, top.value)}'</strong>(으)로 총 <strong>${top.count}명 (${top.percentage.toFixed(1)}%)</strong>이 응답했습니다.</p>
        <p>이어서 범주의 고른 분포 형태를 보이며, 총 <strong>${freqs.total}명</strong>의 응답이 정리되었습니다. 보고서의 기초 현황 테이블에 그대로 인용하실 수 있습니다.</p>
      `;
    }
  } else {
    box.innerHTML = `
      <p>두 범주형 변수인 <strong>'${var1}'</strong>와 <strong>'${var2}'</strong>를 연계하여 다차원 교차표를 도출한 결과입니다.</p>
      <p>각 집단 내에서 상대적인 빈도 패턴을 통해 두 변수 간에 어떠한 연관적 쏠림 경향이 있는지 직관적으로 살필 수 있습니다. 구체적인 연관 유의성을 검증하려면 <strong>3단계 추론통계 분석의 '카이제곱 독립성 검정'</strong>을 이용해 주십시오.</p>
    `;
  }
}

// --- 추론통계 분석 화면 ---
function initInferLayout() {
  const methodSelect = document.getElementById("infer-method");
  
  methodSelect.addEventListener("change", updateInferMethodOptions);
  
  document.getElementById("btn-run-infer").onclick = runInferentialAnalysis;
}

function updateInferMethodOptions() {
  const method = document.getElementById("infer-method").value;
  const container = document.getElementById("infer-variables-container");
  
  container.innerHTML = "";

  const optionsHTML = AppState.headers.map(h => `<option value="${h}">${h}</option>`).join("");
  const numOptionsHTML = AppState.headers
    .filter(h => AppState.colTypes[h] === "continuous" || AppState.colTypes[h] === "likert")
    .map(h => `<option value="${h}">${h}</option>`).join("");
  const catOptionsHTML = AppState.headers
    .filter(h => AppState.colTypes[h] === "categorical" || AppState.colTypes[h] === "likert")
    .map(h => `<option value="${h}">${h}</option>`).join("");

  switch(method) {
    case "ci":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var">분석할 수치형 변수:</label>
          <select id="infer-select-var" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-level">신뢰수준 선택:</label>
          <select id="infer-select-level" class="form-control mt-1">
            <option value="0.95" selected>95% 신뢰구간 (가장 보편적)</option>
            <option value="0.90">90% 신뢰구간</option>
            <option value="0.99">99% 신뢰구간 (매우 엄격)</option>
          </select>
        </div>
      `;
      break;
      
    case "ind-t":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var">분석할 연속형(수치) 변수:</label>
          <select id="infer-select-var" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-group">집단 구분 변수 (2개 범주):</label>
          <select id="infer-select-group" class="form-control mt-1">${catOptionsHTML}</select>
          <p class="input-tip mt-1">예: 성별에 따른 성적 비교 시, 수치 변수는 '성적', 집단 변수는 '성별'</p>
        </div>
      `;
      break;
      
    case "paired-t":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var1">사전 측정 연속형 변수:</label>
          <select id="infer-select-var1" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-var2">사후 측정 연속형 변수:</label>
          <select id="infer-select-var2" class="form-control mt-1">${numOptionsHTML}</select>
          <p class="input-tip mt-1">예: 동일 집단의 '프로그램_전' 점수와 '프로그램_후' 점수 비교</p>
        </div>
      `;
      break;
      
    case "anova":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var">분석할 연속형(수치) 변수:</label>
          <select id="infer-select-var" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-group">집단 구분 변수 (3개 이상 범주):</label>
          <select id="infer-select-group" class="form-control mt-1">${catOptionsHTML}</select>
          <p class="input-tip mt-1">예: 학습방법(강의/토론/셀프)에 따른 수학 성적 차이 분석</p>
        </div>
      `;
      break;
      
    case "chisq-fit":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var">검정할 범주형 변수:</label>
          <select id="infer-select-var" class="form-control mt-1">${catOptionsHTML}</select>
        </div>
        <p class="input-tip mt-2">각 범주의 실제 관측 비율이 균등한 분포를 따르는지 검증합니다.</p>
      `;
      break;
      
    case "chisq-ind":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var1">교차할 첫 번째 범주 변수:</label>
          <select id="infer-select-var1" class="form-control mt-1">${catOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-var2">교차할 두 번째 범주 변수:</label>
          <select id="infer-select-var2" class="form-control mt-1">${catOptionsHTML}</select>
        </div>
      `;
      break;
      
    case "correlation":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var1">연속형 변수 1:</label>
          <select id="infer-select-var1" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-var2">연속형 변수 2:</label>
          <select id="infer-select-var2" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
      `;
      break;
      
    case "regression":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var1">원인이 되는 독립변수 (X, 연속형):</label>
          <select id="infer-select-var1" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-var2">결과가 되는 종속변수 (Y, 연속형):</label>
          <select id="infer-select-var2" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
      `;
      break;
  }
}

function runInferentialAnalysis() {
  const method = document.getElementById("infer-method").value;
  const hypothesis = document.getElementById("txt-hypothesis").value.trim();

  if (!hypothesis) {
    alert("오용 방지를 위해 통계 검정 실행 전 반드시 '연구 가설 적어보기'를 입력해 주십시오!");
    document.getElementById("txt-hypothesis").focus();
    return;
  }

  AppState.hypothesis = hypothesis;

  const resultsEmpty = document.getElementById("infer-results-empty");
  const resultsContent = document.getElementById("infer-results-content");
  resultsEmpty.classList.add("hidden");
  resultsContent.classList.remove("hidden");

  document.getElementById("display-hypothesis").textContent = `"${hypothesis}"`;

  document.getElementById("anova-posthoc-card").classList.add("hidden");
  document.getElementById("infer-chart-card").classList.add("hidden");

  switch(method) {
    case "ci":
      runCIAnalysis();
      break;
    case "ind-t":
      runIndependentTTestAnalysis();
      break;
    case "paired-t":
      runPairedTTestAnalysis();
      break;
    case "anova":
      runAnovaAnalysis();
      break;
    case "chisq-fit":
      runChiSquareFitAnalysis();
      break;
    case "chisq-ind":
      runChiSquareIndAnalysis();
      break;
    case "correlation":
      runCorrelationAnalysis();
      break;
    case "regression":
      runRegressionAnalysis();
      break;
  }
}

// 1) 신뢰구간 분석 실행
function runCIAnalysis() {
  const varName = document.getElementById("infer-select-var").value;
  const level = parseFloat(document.getElementById("infer-select-level").value);
  const data = AppState.data.map(r => r[varName]).filter(v => v !== "");

  const normCheck = StatsHelper.checkNormality(data);
  renderAssumptionDashboard([normCheck]);

  const ci = StatsHelper.estimateConfidenceInterval(data, level);
  if (!ci) return;

  const table = document.getElementById("infer-result-table");
  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    <tr><td><strong>표본 크기 (N)</strong></td><td>${ci.n}명</td><td>유효 데이터 총 개수</td></tr>
    <tr><td><strong>표본 평균</strong></td><td>${ci.mean.toFixed(3)}</td><td>집단의 평균 측정치</td></tr>
    <tr><td><strong>표준편차 (S)</strong></td><td>${ci.stdDev.toFixed(3)}</td><td>흩어진 정도</td></tr>
    <tr><td><strong>표준오차 (SE)</strong></td><td>${ci.se.toFixed(4)}</td><td>표본평균이 모평균에서 얼마나 벗어나는지 추정오차</td></tr>
    <tr><td><strong>분포 종류</strong></td><td>${ci.distribution}</td><td>신뢰구간 도출용 임계값 분포</td></tr>
    <tr><td><strong>신뢰 한계선 (오차한계)</strong></td><td>±${ci.marginOfError.toFixed(4)}</td><td>평균에서 앞뒤로 멀어질 신뢰 구간 한계폭</td></tr>
    <tr class="highlight-row"><td><strong>${level*100}% 신뢰구간</strong></td><td>[${ci.lower.toFixed(3)} ~ ${ci.upper.toFixed(3)}]</td><td>모평균이 이 구간 내에 있을 확률이 ${level*100}%임</td></tr>
  `;

  const interpretation = document.getElementById("infer-korean-interpretation");
  interpretation.innerHTML = `
    <p>분석 대상 변수 <strong>'${varName}'</strong>의 모평균을 추정한 결과, 수집한 표본 ${ci.n}명을 기준으로 <strong>${level*100}% 신뢰구간은 [${ci.lower.toFixed(2)} ~ ${ci.upper.toFixed(2)}]</strong>입니다.</p>
    <p>이는 만약 동일한 조사를 무한히 반복했을 때, 도출된 구간들 중 <strong>${level*100}%</strong>가 실제 모집단의 평균을 포함하고 있음을 뜻합니다.</p>
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--info-light)";
  alertBox.style.color = "var(--info)";
  alertBox.style.borderColor = "var(--info)";
  alertTxt.textContent = "안내: 신뢰구간 추정은 모평균이 위치할 가능성이 높은 범위를 통계적으로 제시하는 것이며, 표본이 무작위적(대표성)으로 잘 수집되었을 때 정확한 신뢰도를 확보할 수 있습니다.";
}

// 2) 독립표본 t-검정 실행
function runIndependentTTestAnalysis() {
  const varName = document.getElementById("infer-select-var").value;
  const groupVar = document.getElementById("infer-select-group").value;

  const dataA = [];
  const dataB = [];
  const groupsSet = new Set();
  
  AppState.data.forEach(row => {
    if (isMissingValue(varName, row[varName]) || isMissingValue(groupVar, row[groupVar])) {
      return;
    }
    const v = parseFloat(row[varName]);
    const grp = String(row[groupVar]).trim();
    if (!isNaN(v) && grp !== "") {
      groupsSet.add(grp);
    }
  });

  const grpArray = Array.from(groupsSet);
  if (grpArray.length < 2) {
    alert("t-검정을 수행하려면 집단 변수의 범주가 최소 2개 필요합니다.");
    return;
  }
  
  if (grpArray.length > 2) {
    if (confirm(`집단 변수 '${groupVar}'에 3개 이상의 그룹(${grpArray.join(", ")})이 발견되었습니다. 세 집단 이상의 비교는 t-검정을 반복하는 대신 '일원분산분석(One-way ANOVA)'을 수행하는 것이 통계적으로 올바릅니다. 일원분산분석(ANOVA)으로 변경하여 실행할까요?`)) {
      document.getElementById("infer-method").value = "anova";
      updateInferMethodOptions();
      document.getElementById("infer-select-var").value = varName;
      document.getElementById("infer-select-group").value = groupVar;
      runAnovaAnalysis();
      return;
    }
  }

  const gA = grpArray[0];
  const gB = grpArray[1];

  AppState.data.forEach(row => {
    if (isMissingValue(varName, row[varName]) || isMissingValue(groupVar, row[groupVar])) {
      return;
    }
    const v = parseFloat(row[varName]);
    const grp = String(row[groupVar]).trim();
    if (!isNaN(v)) {
      if (grp === gA) dataA.push(v);
      if (grp === gB) dataB.push(v);
    }
  });

  const normA = StatsHelper.checkNormality(dataA);
  const normB = StatsHelper.checkNormality(dataB);
  const homos = StatsHelper.checkHomoscedasticity([dataA, dataB]);

  normA.reason = `'${getValLabel(groupVar, gA)}' 집단의 정규성: ` + normA.reason;
  normB.reason = `'${getValLabel(groupVar, gB)}' 집단의 정규성: ` + normB.reason;
  renderAssumptionDashboard([normA, normB, homos]);

  const tResult = StatsHelper.independentTTest(dataA, dataB);
  if (tResult.error) {
    alert(tResult.error);
    return;
  }

  const table = document.getElementById("infer-result-table");
  
  const passed = tResult.homoscedasticity.passed;
  const suggestionText = passed
    ? `<span style="color:var(--success);font-weight:bold;"><i class="fa-solid fa-circle-check"></i> [등분산 가정 만족]</span> 두 집단의 분산 비율이 ${tResult.homoscedasticity.ratio}배로 4배 이내에 있습니다. 아래 테이블에서 <strong>'등분산 가정됨'</strong> 행의 결과를 인용하십시오.`
    : `<span style="color:var(--danger);font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> [등분산 가정 위배 의심]</span> 두 집단의 분산 비율이 ${tResult.homoscedasticity.ratio}배로 4배를 초과합니다. 아래 테이블에서 <strong>'등분산 가정되지 않음(Welch의 t-검정)'</strong> 행의 결과를 인용하십시오.`;

  const eqSig = tResult.equalVariance.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";
  const uneqSig = tResult.unequalVariance.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";
  
  table.innerHTML = `
    <tr><th colspan="3">1. 집단별 기초통계량</th></tr>
    <tr><td><strong>집단 A (${getValLabel(groupVar, gA)})</strong></td><td colspan="2">${tResult.groupAInfo.mean.toFixed(3)} ± ${tResult.groupAInfo.stdDev.toFixed(3)} (n=${tResult.groupAInfo.n})</td></tr>
    <tr><td><strong>집단 B (${getValLabel(groupVar, gB)})</strong></td><td colspan="2">${tResult.groupBInfo.mean.toFixed(3)} ± ${tResult.groupBInfo.stdDev.toFixed(3)} (n=${tResult.groupBInfo.n})</td></tr>
    <tr><td><strong>효과크기 (Cohen's d)</strong></td><td colspan="2"><strong>${tResult.cohensD.toFixed(3)}</strong> (0.2: 작음, 0.5: 중간, 0.8: 큼)</td></tr>
    <tr><td colspan="3" style="background-color:var(--bg-card); font-size:12px; padding:10px 14px; border-radius: var(--radius-sm); border:1px solid var(--border-glass);">${suggestionText}</td></tr>
    
    <tr><th colspan="3" style="padding-top:20px;">2. 독립표본 t-검정 결과 상세 (SPSS 양식)</th></tr>
    <tr>
      <td colspan="3" style="padding:0; border:none;">
        <div class="table-scroll-container" style="margin:0;">
          <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
            <thead>
              <tr style="background-color:rgba(114, 46, 209, 0.05);">
                <th rowspan="2" style="border:1px solid var(--border-glass); padding:8px;">가정 구분</th>
                <th colspan="3" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">t-검정 (평균의 동일성 검정)</th>
                <th rowspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균 차이</th>
                <th colspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">차이의 95% 신뢰구간</th>
              </tr>
              <tr style="background-color:rgba(114, 46, 209, 0.05);">
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">t</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">df (자유도)</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">p-value (양측)</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">하한</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">상한</th>
              </tr>
            </thead>
            <tbody>
              <tr style="${passed ? 'background-color:rgba(56, 158, 13, 0.08); font-weight:600;' : ''}">
                <td style="border:1px solid var(--border-glass); padding:8px;"><strong>등분산 가정됨</strong></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.tValue.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.df.toFixed(2)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${tResult.equalVariance.pValue < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${tResult.equalVariance.pValue.toFixed(4)}</strong><br><span style="font-size:10px;font-weight:normal;">(${eqSig})</span></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.diff.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.ciLower.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.ciUpper.toFixed(3)}</td>
              </tr>
              <tr style="${!passed ? 'background-color:rgba(207, 19, 34, 0.08); font-weight:600;' : ''}">
                <td style="border:1px solid var(--border-glass); padding:8px;"><strong>등분산 가정되지 않음</strong></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.tValue.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.df.toFixed(2)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${tResult.unequalVariance.pValue < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${tResult.unequalVariance.pValue.toFixed(4)}</strong><br><span style="font-size:10px;font-weight:normal;">(${uneqSig})</span></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.diff.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.ciLower.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.ciUpper.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;

  const activeResult = passed ? tResult.equalVariance : tResult.unequalVariance;
  const isSig = activeResult.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  let effectLabel = "매우 작음";
  if (tResult.cohensD >= 0.8) effectLabel = "큰 효과 크기(의미 있는 실제적 차이)";
  else if (tResult.cohensD >= 0.5) effectLabel = "중간 효과 크기";
  else if (tResult.cohensD >= 0.2) effectLabel = "작은 효과 크기";

  interpretation.innerHTML = `
    <p><strong>'${groupVar}'</strong>에 속한 두 집단(${getValLabel(groupVar, gA)} vs ${getValLabel(groupVar, gB)}) 간에 <strong>'${varName}'</strong>의 평균에 유의미한 차이가 있는지 독립표본 t-검정을 실시하였습니다.</p>
    <p>분산 동질성 확인 결과, 집단 간 분산 비율 격차에 의거하여 통계적으로 <strong>'${passed ? "등분산 가정됨" : "등분산 가정되지 않음(Welch의 t-검정)"}'</strong> 행의 결과를 인용 채택합니다.</p>
    <p>분석 결과, 두 집단의 평균값 차이는 <strong>${tResult.diff.toFixed(2)}</strong>이며, 이 차이는 통계적으로 <strong>${isSig ? "유의미합니다" : "유의미하지 않습니다"}</strong> (t = ${activeResult.tValue.toFixed(2)}, df = ${activeResult.df.toFixed(2)}, p = ${activeResult.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 우연히 이러한 차이가 관측될 확률이 5% 미만이므로, 두 집단 간에는 실제 평균 점수 차이가 존재한다고 결론 내릴 수 있습니다.` : `즉, 우연한 요인으로 발생할 수 있는 수준의 미미한 차이이므로, 두 집단 간에는 실제 평균적인 차이가 없다고 해석합니다.`}</p>
    <p>추가로 분석된 두 집단 차이의 실질적인 크기(효과크기, Cohen's d)는 <strong>${tResult.cohensD.toFixed(2)}</strong>로, <strong>${effectLabel}</strong>에 해당합니다.</p>
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--warning-light)";
  alertBox.style.color = "var(--warning)";
  alertBox.style.borderColor = "var(--warning)";
  alertTxt.textContent = "주의: t-검정 결과 집단 차이가 유의미하더라도 이것이 '집단 분류'가 평균 차이의 온전한 원인이라는 인과관계를 의미하지는 않습니다. 외부의 다른 통제되지 않은 요인이 작동했을 수 있습니다.";
}

// 3) 대응표본 t-검정 실행
function runPairedTTestAnalysis() {
  const var1 = document.getElementById("infer-select-var1").value;
  const var2 = document.getElementById("infer-select-var2").value;

  const dataPre = [];
  const dataPost = [];
  
  AppState.data.forEach(row => {
    if (isMissingValue(var1, row[var1]) || isMissingValue(var2, row[var2])) {
      return;
    }
    const vPre = parseFloat(row[var1]);
    const vPost = parseFloat(row[var2]);
    if (!isNaN(vPre) && !isNaN(vPost)) {
      dataPre.push(vPre);
      dataPost.push(vPost);
    }
  });

  if (dataPre.length < 2) {
    alert("분석에 필요한 유효한 사전-사후 데이터 쌍이 부족합니다 (최소 2쌍 필요).");
    return;
  }

  const diffs = dataPost.map((v, i) => v - dataPre[i]);
  const normDiff = StatsHelper.checkNormality(diffs);
  normDiff.reason = "사전-사후 차이값의 정규성: " + normDiff.reason;
  renderAssumptionDashboard([normDiff]);

  const tResult = StatsHelper.pairedTTest(dataPre, dataPost);
  if (tResult.error) {
    alert(tResult.error);
    return;
  }

  const table = document.getElementById("infer-result-table");
  const sig = tResult.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    <tr><td><strong>검정 방식</strong></td><td>대응표본 t-검정</td><td>동일 대상의 전/후 비교</td></tr>
    <tr><td><strong>분석 데이터 쌍 (N)</strong></td><td>${tResult.n}쌍</td><td>사전/사후 비교 대상 총 매칭 수</td></tr>
    <tr><td><strong>평균 차이 (사후 - 사전)</strong></td><td>${tResult.meanDiff.toFixed(3)}</td><td>전후 평균적인 점수 변동 크기</td></tr>
    <tr><td><strong>차이의 표준오차 (SE)</strong></td><td>${tResult.seDiff.toFixed(4)}</td><td>차이 평균의 추정오차 범위</td></tr>
    <tr><td><strong>t-통계량 (t)</strong></td><td>${tResult.tValue.toFixed(3)}</td><td>변동폭이 자연변동 오차의 몇 배 수준인가</td></tr>
    <tr><td><strong>자유도 (df)</strong></td><td>${tResult.df}</td><td>총 데이터쌍 수 - 1</td></tr>
    <tr class="highlight-row"><td><strong>유의확률 (p-value)</strong></td><td><strong>${tResult.pValue.toFixed(4)}</strong> (${sig})</td><td>변화가 없는데 우연히 이런 변화가 도출될 확률</td></tr>
    <tr><td><strong>효과크기 (Cohen's dz)</strong></td><td><strong>${tResult.cohensD.toFixed(3)}</strong></td><td>사전-사후 변동의 실질적 크기</td></tr>
    <tr><td><strong>차이 95% 신뢰구간</strong></td><td>[${tResult.ciLower.toFixed(3)} ~ ${tResult.ciUpper.toFixed(3)}]</td><td>실제 모집단에서의 변동 범위 추정</td></tr>
  `;

  const isSig = tResult.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  interpretation.innerHTML = `
    <p>동일한 대상을 비교하여 <strong>'${var1}'</strong>(사전)과 <strong>'${var2}'</strong>(사후) 사이에 통계적으로 의미 있는 변화가 나타났는지 대응표본 t-검정을 실시하였습니다.</p>
    <p>검정 결과, 사전 대비 사후의 평균 변화량은 <strong>${tResult.meanDiff.toFixed(2)}</strong>이며, 이 변화는 통계적으로 <strong>${isSig ? "유의미합니다" : "유의미하지 않습니다"}</strong> (t = ${tResult.tValue.toFixed(2)}, p = ${tResult.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 우연한 점수 요동으로 인해서 이런 수준의 전후 차이가 발생했을 가능성이 극히 낮으므로, 실시한 조치/시간 흐름에 따른 변동 효과가 실재한다고 해석할 수 있습니다.` : `즉, 자연스러운 점수 기복 내에 속하므로 사전과 사후 사이에 실질적인 효과가 나타났다고 판단하기 어렵습니다.`}</p>
    <p>변화의 실질적 크기를 의미하는 효과크기(Cohen's dz)는 <strong>${tResult.cohensD.toFixed(2)}</strong>로 측정되었습니다.</p>
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--warning-light)";
  alertBox.style.color = "var(--warning)";
  alertBox.style.borderColor = "var(--warning)";
  alertTxt.textContent = "주의: 전후 차이가 유의하더라도, 다른 외생 변수(예: 성장 효과, 우연히 쉬워진 시험 등)의 통제가 이루어지지 않았다면 변화의 진짜 원인이 오직 해당 조치 때문라고 단정할 수 없습니다.";
}

// 4) 일원분산분석 ANOVA 실행
function runAnovaAnalysis() {
  const varName = document.getElementById("infer-select-var").value;
  const groupVar = document.getElementById("infer-select-group").value;

  const groupDataMap = {};
  AppState.data.forEach(row => {
    if (isMissingValue(varName, row[varName]) || isMissingValue(groupVar, row[groupVar])) {
      return;
    }
    const v = parseFloat(row[varName]);
    const grp = String(row[groupVar]).trim();
    if (!isNaN(v) && grp !== "") {
      if (!groupDataMap[grp]) groupDataMap[grp] = [];
      groupDataMap[grp].push(v);
    }
  });

  const grpNames = Object.keys(groupDataMap);
  if (grpNames.length < 3) {
    alert("ANOVA를 수행하려면 집단 범주가 3개 이상이어야 합니다. 2개 비교는 t-검정을 사용해 주세요.");
    return;
  }

  const norms = grpNames.map(name => {
    const chk = StatsHelper.checkNormality(groupDataMap[name]);
    chk.reason = `'${getValLabel(groupVar, name)}' 집단 정규성: ` + chk.reason;
    return chk;
  });

  const groupsList = grpNames.map(name => groupDataMap[name]);
  const homos = StatsHelper.checkHomoscedasticity(groupsList);
  norms.push(homos);
  renderAssumptionDashboard(norms);

  const anova = StatsHelper.oneWayAnova(groupDataMap);
  if (anova.error) {
    alert(anova.error);
    return;
  }

  const table = document.getElementById("infer-result-table");
  const sig = anova.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  let grpMeansHtml = "";
  anova.groups.forEach(g => {
    grpMeansHtml += `<tr><td>'${getValLabel(groupVar, g.name)}' 평균 (Std)</td><td>${g.mean.toFixed(2)} (${g.stdDev.toFixed(2)})</td><td>n = ${g.n}</td></tr>`;
  });

  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    ${grpMeansHtml}
    <tr><td><strong>집단 간 제곱합 (SS_between)</strong></td><td>${anova.ssBetween.toFixed(2)} (자유도 = ${anova.dfBetween})</td><td>집단 간 평균 격차에 따른 변동</td></tr>
    <tr><td><strong>집단 내 제곱합 (SS_within)</strong></td><td>${anova.ssWithin.toFixed(2)} (자유도 = ${anova.dfWithin})</td><td>집단 내부 학생 간 개인차 변동</td></tr>
    <tr><td><strong>F-통계량 (F)</strong></td><td>${anova.fValue.toFixed(3)}</td><td>(집단 간 변동 평균) / (집단 내 변동 평균)</td></tr>
    <tr class="highlight-row"><td><strong>유의확률 (p-value)</strong></td><td><strong>${anova.pValue.toFixed(4)}</strong> (${sig})</td><td>집단 간 차이가 전혀 없는데 우연히 이런 편차가 생길 확률</td></tr>
    <tr><td><strong>효과크기 (에타제곱 η²)</strong></td><td><strong>${anova.etaSquared.toFixed(3)}</strong></td><td>집단 구분이 총 변동의 몇 %를 설명하는가 (0.01: 작음, 0.06: 중간, 0.14: 큼)</td></tr>
  `;

  const posthocCard = document.getElementById("anova-posthoc-card");
  posthocCard.classList.remove("hidden");
  
  const posthocTable = document.getElementById("anova-posthoc-table");
  let posthocHtml = `<tr><th>집단 비교 쌍</th><th>평균 차이</th><th>Tukey q-값</th><th>유의확률 (보정 p)</th><th>유의 여부 (α=0.05)</th></tr>`;
  
  anova.postHoc.forEach(ph => {
    const isPhSig = ph.pValue < 0.05;
    const parts = ph.comparison.split(" vs ");
    let displayComparison = ph.comparison;
    if (parts.length === 2) {
      displayComparison = `${getValLabel(groupVar, parts[0])} vs ${getValLabel(groupVar, parts[1])}`;
    }
    posthocHtml += `
      <tr class="${isPhSig ? 'highlight-row' : ''}">
        <td><strong>${displayComparison}</strong></td>
        <td>${ph.diff.toFixed(3)}</td>
        <td>${ph.qValue.toFixed(3)}</td>
        <td>${ph.pValue.toFixed(4)}</td>
        <td><strong>${isPhSig ? '차이 유의함' : '유의하지 않음'}</strong></td>
      </tr>
    `;
  });
  posthocTable.innerHTML = posthocHtml;

  const isSig = anova.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  let effectLabel = "작은 수준";
  if (anova.etaSquared >= 0.14) effectLabel = "매우 큰 수준 (집단 간 성향 차이가 매우 강함)";
  else if (anova.etaSquared >= 0.06) effectLabel = "중간 수준";

  let sigGroups = anova.postHoc.filter(p => p.pValue < 0.05).map(p => {
    const parts = p.comparison.split(" vs ");
    if (parts.length === 2) {
      return `'${getValLabel(groupVar, parts[0])} vs ${getValLabel(groupVar, parts[1])}'`;
    }
    return `'${p.comparison}'`;
  });

  interpretation.innerHTML = `
    <p>집단 변수 <strong>'${groupVar}'</strong>에 의해 나누어진 세 개 이상의 집단 간에 <strong>'${varName}'</strong>의 평균값 차이가 있는지 일원분산분석(One-way ANOVA)을 수행했습니다.</p>
    <p>분석 결과, 집단 간 평균값들의 격차는 통계적으로 <strong>${isSig ? "유의미합니다" : "유의미하지 않습니다"}</strong> (F = ${anova.fValue.toFixed(2)}, p = ${anova.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 집단 간 평균 차이가 단순히 우연히 나타났을 확률이 극히 희박하므로, 세 집단 중 적어도 어느 집단 간에는 유의미한 평균 차이가 존재합니다.` : `즉, 집단 간에 존재하는 차이는 단순 우연 편차 수준으로 볼 수 있어, 모집단에서 평균 차이가 실재한다고 볼 수 없습니다.`}</p>
    <p>요인의 실질적인 설명력 크기인 에타제곱(η²)은 <strong>${anova.etaSquared.toFixed(3)}</strong>로, 집단 분류가 전체 변동의 <strong>${(anova.etaSquared * 100).toFixed(1)}%</strong>를 설명하는 <strong>${effectLabel}</strong>에 해당합니다.</p>
    ${isSig && sigGroups.length > 0 ? `<p><strong>[사후검정 결과]</strong> 다중비교 보정을 통해 쌍별 비교를 수행한 결과, <strong>${sigGroups.join(", ")}</strong> 쌍 간에 통계적으로 유의미한 점수 차이가 확인되었습니다.</p>` : ""}
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--warning-light)";
  alertBox.style.color = "var(--warning)";
  alertBox.style.borderColor = "var(--warning)";
  alertTxt.textContent = "주의: 분산분석(ANOVA)은 집단 간 평균의 차이를 식별하지만, 집단 구분이 독립적인 제3의 통제되지 않은 환경 요소들과 복합적으로 얽혀있을 수 있으므로 단정적인 인과 해석은 지양해야 합니다.";
}

// 5) 카이제곱 적합도 검정 실행
function runChiSquareFitAnalysis() {
  const varName = document.getElementById("infer-select-var").value;
  const data = AppState.data.map(r => String(r[varName]).trim()).filter(v => !isMissingValue(varName, v));

  const freq = StatsHelper.calculateFrequency(data);
  const observed = freq.list.map(l => l.count);
  const labels = freq.list.map(l => l.value);

  const lowCells = observed.filter(o => o < 5).length;
  const lowCellPct = (lowCells / observed.length) * 100;
  const passed = lowCellPct <= 20;
  const cellCheck = {
    passed,
    reason: passed
      ? `모든 범주의 관측치(N=${freq.total})가 충분하여 카이제곱 근사가 적절합니다.`
      : `기대/관측 빈도가 5 미만인 범주 비율이 ${lowCellPct.toFixed(1)}%로 20%를 초과합니다. 신뢰도가 낮아질 수 있습니다.`,
    severity: passed ? "success" : "warning"
  };
  renderAssumptionDashboard([cellCheck]);

  const chisq = StatsHelper.chiSquareTest(observed, null, "goodness");
  if (chisq.error) {
    alert(chisq.error);
    return;
  }

  const table = document.getElementById("infer-result-table");
  const sig = chisq.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  let rowsHtml = "";
  labels.forEach((lbl, idx) => {
    rowsHtml += `<tr><td>'${lbl}' 관측빈도 (기대빈도)</td><td>${observed[idx]}명 (${chisq.expected[idx].toFixed(1)}명)</td><td>오차 = ${(observed[idx] - chisq.expected[idx]).toFixed(1)}</td></tr>`;
  });

  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    ${rowsHtml}
    <tr><td><strong>카이제곱 통계량 (χ²)</strong></td><td>${chisq.chi2Value.toFixed(3)}</td><td>실제 관측치와 기대치 분포의 차이 지표</td></tr>
    <tr><td><strong>자유도 (df)</strong></td><td>${chisq.df}</td><td>범주 수 - 1</td></tr>
    <tr class="highlight-row"><td><strong>유의확률 (p-value)</strong></td><td><strong>${chisq.pValue.toFixed(4)}</strong> (${sig})</td><td>차이가 전혀 없는데 우연히 이런 왜곡 빈도가 관측될 확률</td></tr>
  `;

  const isSig = chisq.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  interpretation.innerHTML = `
    <p>범주형 변수 <strong>'${varName}'</strong>의 각 범주 빈도가 균등한 기대를 따르는지 적합도 검정을 수행했습니다.</p>
    <p>검정 결과, 범주별 편차 분포는 통계적으로 <strong>${isSig ? "유의미한 차이가 존재합니다" : "유의미한 차이가 나지 않습니다"}</strong> (χ² = ${chisq.chi2Value.toFixed(2)}, p = ${chisq.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 각 범주가 균등한 비율로 선택되지 않고, 특정 항목으로 통계적으로 유의하게 치우친 편향 현상이 나타났음을 뜻합니다.` : `즉, 각 범주가 균등하게 고른 빈도로 분포되어 있어 고른 균등 기대를 충족하고 있습니다.`}</p>
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--info-light)";
  alertBox.style.color = "var(--info)";
  alertBox.style.borderColor = "var(--info)";
  alertTxt.textContent = "주의: 카이제곱 적합도 검정은 가설상의 확률(이론적 분포)과 수집 데이터 빈도를 비교하며, N이 너무 작으면 신뢰를 담보하기 어렵습니다.";
}

// 6) 카이제곱 독립성 검정 실행
function runChiSquareIndAnalysis() {
  const var1 = document.getElementById("infer-select-var1").value;
  const var2 = document.getElementById("infer-select-var2").value;

  const pairData = AppState.data.filter(r => !isMissingValue(var1, r[var1]) && !isMissingValue(var2, r[var2]));
  const rowVals = pairData.map(r => String(r[var1]).trim());
  const colVals = pairData.map(r => String(r[var2]).trim());

  const cross = StatsHelper.calculateCrossTab(rowVals, colVals);
  
  const matrix = [];
  cross.rows.forEach(r => {
    const rowList = [];
    cross.cols.forEach(c => {
      rowList.push(cross.table[r][c]);
    });
    matrix.push(rowList);
  });

  const chisq = StatsHelper.chiSquareTest(matrix, null, "independence");
  if (chisq.error) {
    alert(chisq.error);
    return;
  }

  const cellCheck = {
    passed: chisq.warning === null,
    reason: chisq.warning ? chisq.warning : "모든 셀의 기대 빈도가 충분히 커 카이제곱 검정을 수행하기 적합합니다.",
    severity: chisq.warning ? "warning" : "success"
  };
  renderAssumptionDashboard([cellCheck]);

  const table = document.getElementById("infer-result-table");
  const sig = chisq.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    <tr><td><strong>검정 방식</strong></td><td>카이제곱 독립성 검정 (교차분석)</td><td>두 변수의 연관 유의성 평가</td></tr>
    <tr><td><strong>유효 표본 수 (N)</strong></td><td>${cross.n}명</td><td>총 분석 참여 행수</td></tr>
    <tr><td><strong>카이제곱 통계량 (χ²)</strong></td><td>${chisq.chi2Value.toFixed(3)}</td><td>실제 교차 빈도와 독립 가정 빈도 간의 괴리 크기</td></tr>
    <tr><td><strong>자유도 (df)</strong></td><td>${chisq.df}</td><td>(행 수 - 1) * (열 수 - 1)</td></tr>
    <tr class="highlight-row"><td><strong>유의확률 (p-value)</strong></td><td><strong>${chisq.pValue.toFixed(4)}</strong> (${sig})</td><td>두 변수가 무관한데 우연히 이런 쏠림표가 나올 확률</td></tr>
    <tr><td><strong>효과크기 (Cramér's V)</strong></td><td><strong>${chisq.cramersV.toFixed(3)}</strong></td><td>두 범주 변수의 연관성의 강도 (0.1: 약함, 0.3: 보통, 0.5: 강함)</td></tr>
  `;

  const isSig = chisq.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  let effectLabel = "매우 연관성이 낮음";
  if (chisq.cramersV >= 0.5) effectLabel = "아주 강한 연관성 (연대 경향이 매우 뚜렷함)";
  else if (chisq.cramersV >= 0.3) effectLabel = "보통 강도의 연관성";
  else if (chisq.cramersV >= 0.1) effectLabel = "약한 연관성";

  interpretation.innerHTML = `
    <p>범주형 변수 <strong>'${var1}'</strong>와 <strong>'${var2}'</strong> 사이에 유의미한 연관성(독립 여부)이 존재하는지 교차 카이제곱 독립성 검정을 수행했습니다.</p>
    <p>분석 결과, 두 변수의 연관 상태는 통계적으로 <strong>${isSig ? "유의미하게 관련이 있습니다" : "유의미하게 관련이 없습니다"}</strong> (χ² = ${chisq.chi2Value.toFixed(2)}, p = ${chisq.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, '${var1}'의 항목 구분에 따라 '${var2}'의 응답 분배가 완전히 무작위가 아니라, 특정 조합에 쏠리는 상관관계(연동현상)가 입증되었습니다.` : `즉, 두 변수 응답 분배는 통계적으로 볼 때 서로 아무런 영향을 미치지 않는 독립적인 형태를 취하고 있습니다.`}</p>
    <p>상관적 긴밀도를 보인 효과크기(Cramér's V)는 <strong>${chisq.cramersV.toFixed(2)}</strong>로, <strong>${effectLabel}</strong>에 속합니다.</p>
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--warning-light)";
  alertBox.style.color = "var(--warning)";
  alertBox.style.borderColor = "var(--warning)";
  alertTxt.textContent = "주의: 카이제곱 연관성 유의는 두 요인이 연계되어 움직인다는 관계(상관)를 말하며, 이것이 한쪽이 다른 한쪽을 바꾸는 '원인과 결과(인과)'라는 직접적 논거가 되지 않습니다.";
}

// 7) 피어슨 상관분석 실행
function runCorrelationAnalysis() {
  const var1 = document.getElementById("infer-select-var1").value;
  const var2 = document.getElementById("infer-select-var2").value;

  const data1 = [];
  const data2 = [];
  AppState.data.forEach(row => {
    if (isMissingValue(var1, row[var1]) || isMissingValue(var2, row[var2])) {
      return;
    }
    const v1 = parseFloat(row[var1]);
    const v2 = parseFloat(row[var2]);
    if (!isNaN(v1) && !isNaN(v2)) {
      data1.push(v1);
      data2.push(v2);
    }
  });

  if (data1.length < 3) {
    alert("상관 분석을 수행하려면 최소 3개 이상의 유효한 관측치 쌍이 필요합니다.");
    return;
  }

  const norm1 = StatsHelper.checkNormality(data1);
  const norm2 = StatsHelper.checkNormality(data2);
  norm1.reason = `'${var1}' 정규성: ` + norm1.reason;
  norm2.reason = `'${var2}' 정규성: ` + norm2.reason;
  renderAssumptionDashboard([norm1, norm2]);

  const corr = StatsHelper.correlationAnalysis(data1, data2);
  if (corr.error) {
    alert(corr.error);
    return;
  }

  const table = document.getElementById("infer-result-table");
  const sig = corr.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";
  const r = corr.correlationCoefficient;

  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    <tr><td><strong>검정 방식</strong></td><td>피어슨 상관분석 (Pearson Correlation)</td><td>두 수치 변수 간의 직선 비례 관계 수준</td></tr>
    <tr><td><strong>매칭 표본 크기 (N)</strong></td><td>${corr.n}쌍</td><td>결측을 제외한 공통 데이터 매칭 수</td></tr>
    <tr class="highlight-row"><td><strong>상관계수 (r)</strong></td><td><strong>${r.toFixed(4)}</strong></td><td>-1 ~ +1 사이의 값 (부호는 방향, 절대값은 강도)</td></tr>
    <tr><td><strong>t-통계량 (t)</strong></td><td>${corr.tValue.toFixed(3)}</td><td>상관계수 유의 수준 산출용 t통계값</td></tr>
    <tr><td><strong>자유도 (df)</strong></td><td>${corr.df}</td><td>총 데이터쌍 - 2</td></tr>
    <tr class="highlight-row"><td><strong>유의확률 (p-value)</strong></td><td><strong>${corr.pValue.toFixed(4)}</strong> (${sig})</td><td>모집단 상관이 진짜 0인데 우연히 r만큼 치우칠 확률</td></tr>
    <tr><td><strong>계수 95% 신뢰구간</strong></td><td>[${corr.ciLower ? corr.ciLower.toFixed(3) : '-'} ~ ${corr.ciUpper ? corr.ciUpper.toFixed(3) : '-'}]</td><td>상관계수가 모집단에서 가질 범위 추정</td></tr>
  `;

  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");
  
  const ctx = document.getElementById("infer-chart");
  if (AppState.chartInstance) AppState.chartInstance.destroy();

  const points = data1.map((xVal, idx) => ({
    x: xVal,
    y: data2[idx]
  }));

  const isDark = AppState.theme === "dark";
  const textColor = isDark ? "#c8cdd4" : "#2d3748";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";

  AppState.chartInstance = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "관측치",
        data: points,
        backgroundColor: "rgba(114, 46, 209, 0.7)",
        borderColor: "var(--primary)",
        borderWidth: 1,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: `${var1} vs ${var2} 산점도`, color: textColor }
      },
      scales: {
        x: { title: { display: true, text: var1, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
        y: { title: { display: true, text: var2, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }
      }
    }
  });

  document.getElementById("btn-download-infer-chart").onclick = () => {
    const url = ctx.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Scatter_${var1}_${var2}.png`;
    a.click();
  };

  const isSig = corr.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  let strengthLabel = "관계 없음";
  const absR = Math.abs(r);
  if (absR >= 0.7) strengthLabel = "매우 강한";
  else if (absR >= 0.4) strengthLabel = "비교적 뚜렷한";
  else if (absR >= 0.2) strengthLabel = "약한";
  
  const directionLabel = r > 0 ? "양의 선형 상관관계(한쪽이 커지면 다른 쪽도 커짐)" : "음의 선형 상관관계(한쪽이 커지면 다른 쪽은 작아짐)";

  interpretation.innerHTML = `
    <p>연속형 수치 변수인 <strong>'${var1}'</strong>와 <strong>'${var2}'</strong> 사이에 일차함수적인 선형 관계가 있는지 피어슨 상관분석을 실시했습니다.</p>
    <p>분석 결과, 상관계수 r은 <strong>${r.toFixed(3)}</strong>이며, 이 관계는 통계적으로 <strong>${isSig ? "유의미합니다" : "유의미하지 않습니다"}</strong> (t = ${corr.tValue.toFixed(2)}, p = ${corr.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 두 변수 사이에는 실제 <strong>${strengthLabel} ${directionLabel}</strong>가 성립합니다.` : `즉, 통계적으로 관측된 관계 수준이 무시할 수 있는 우연 범위 내이므로, 두 변수는 아무 선형 관계를 가지고 있지 않습니다.`}</p>
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--danger-light)";
  alertBox.style.color = "var(--danger)";
  alertBox.style.borderColor = "var(--danger)";
  alertTxt.textContent = "CRITICAL WARNING (인과 비약 방지): 상관관계(Correlation)는 두 요인이 연동해 움직이는 징후를 나타낼 뿐이며, 결코 인과관계(Causation)를 설명하지 못합니다. 즉, '공부 시간이 많아서 성적이 잘나온다'처럼 스마트폰이 수면을 줄인 원인이라고 단정하면 안 되며, 다른 요인(예: 조력 수준 등)이 매개했을 수 있습니다.";
}

// 8) 단순선형회귀분석 실행
function runRegressionAnalysis() {
  const var1 = document.getElementById("infer-select-var1").value;
  const var2 = document.getElementById("infer-select-var2").value;

  const data1 = [];
  const data2 = [];
  AppState.data.forEach(row => {
    if (isMissingValue(var1, row[var1]) || isMissingValue(var2, row[var2])) {
      return;
    }
    const v1 = parseFloat(row[var1]);
    const v2 = parseFloat(row[var2]);
    if (!isNaN(v1) && !isNaN(v2)) {
      data1.push(v1);
      data2.push(v2);
    }
  });

  if (data1.length < 3) {
    alert("회귀분석을 위해 최소 3개 이상의 유효한 쌍이 필요합니다.");
    return;
  }

  const norm1 = StatsHelper.checkNormality(data1);
  const norm2 = StatsHelper.checkNormality(data2);
  norm1.reason = `독립변수 정규성: ` + norm1.reason;
  norm2.reason = `종속변수 정규성: ` + norm2.reason;
  renderAssumptionDashboard([norm1, norm2]);

  const reg = StatsHelper.linearRegression(data1, data2);
  if (reg.error) {
    alert(reg.error);
    return;
  }

  const table = document.getElementById("infer-result-table");
  const sigF = reg.pValueF < 0.05 ? "유의함" : "유의하지 않음";
  const sigSlope = reg.pValueSlope < 0.05 ? "유의함" : "유의하지 않음";

  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    <tr><td><strong>추정된 회귀 방정식</strong></td><td><strong>Y = ${reg.slope.toFixed(3)} * X + ${reg.intercept.toFixed(3)}</strong></td><td>예측 모형식 (X: ${var1}, Y: ${var2})</td></tr>
    <tr><td><strong>결정계수 (R²)</strong></td><td><strong>${reg.rSquared.toFixed(4)}</strong></td><td>이 모델이 Y의 변동을 몇 % 설명하는가 (설명력 크기)</td></tr>
    <tr><td><strong>조정된 결정계수</strong></td><td>${reg.adjustedRSquared.toFixed(4)}</td><td>표본 수와 변수 수를 반영하여 조정한 모델 설명력</td></tr>
    <tr><td><strong>회귀계수 기울기 (β1)</strong></td><td>${reg.slope.toFixed(3)} (t = ${reg.tValue.toFixed(2)}, p = ${reg.pValueSlope.toFixed(4)})</td><td>X가 1 단위 늘어날 때 Y가 변화할 예측치 (${sigSlope})</td></tr>
    <tr><td><strong>회귀계수 절편 (β0)</strong></td><td>${reg.intercept.toFixed(3)}</td><td>X가 0일 때의 Y 예측 기초값</td></tr>
    <tr><td><strong>모델 적합도 F-통계량 (F)</strong></td><td>${reg.fValue.toFixed(3)} (자유도 = ${reg.dfReg}, ${reg.dfRes})</td><td>회귀 방정식 모형이 통계적으로 유의미한가 여부</td></tr>
    <tr class="highlight-row"><td><strong>회귀모형 유의확률 (p-value)</strong></td><td><strong>${reg.pValueF.toFixed(4)}</strong> (${sigF})</td><td>Y 변동 예측이 통계적으로 완전히 유효한지 증명</td></tr>
  `;

  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");
  
  const ctx = document.getElementById("infer-chart");
  if (AppState.chartInstance) AppState.chartInstance.destroy();

  const points = AppState.data.map(row => ({
    x: parseFloat(row[var1]),
    y: parseFloat(row[var2])
  })).filter(pt => !isNaN(pt.x) && !isNaN(pt.y));

  const xVals = points.map(p => p.x);
  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);

  const linePoints = [
    { x: minX, y: reg.slope * minX + reg.intercept },
    { x: maxX, y: reg.slope * maxX + reg.intercept }
  ];

  const isDark = AppState.theme === "dark";
  const textColor = isDark ? "#c8cdd4" : "#2d3748";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";

  AppState.chartInstance = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "관측치",
          data: points,
          backgroundColor: "rgba(114, 46, 209, 0.7)",
          borderColor: "var(--primary)",
          borderWidth: 1,
          pointRadius: 5
        },
        {
          label: "회귀 추정선",
          data: linePoints,
          type: "line",
          borderColor: "var(--danger)",
          borderWidth: 2.5,
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: textColor } },
        title: { display: true, text: `${var2}를 예측하기 위한 회귀 방정식 그래프`, color: textColor }
      },
      scales: {
        x: { title: { display: true, text: var1, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
        y: { title: { display: true, text: var2, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }
      }
    }
  });

  const isSig = reg.pValueF < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  interpretation.innerHTML = `
    <p>원인(독립변수) <strong>'${var1}'</strong>이(가) 결과(종속변수) <strong>'${var2}'</strong>을(를) 통계적으로 유의미하게 예측하는지 단순선형회귀분석을 적용했습니다.</p>
    <p>분석 결과 도출된 회귀모형은 통계적으로 <strong>${isSig ? "유의미하게 타당합니다" : "유의미한 타당성을 얻지 못했습니다"}</strong> (F = ${reg.fValue.toFixed(2)}, p = ${reg.pValueF.toFixed(3)}).</p>
    <p>이 모형의 설명력(결정계수 R²)은 <strong>${reg.rSquared.toFixed(3)}</strong>이며, 이는 독립변수 '${var1}'이 종속변수 '${var2}' 전체 변동의 약 <strong>${(reg.rSquared * 100).toFixed(1)}%</strong>를 설명(예측)해내고 있음을 의미합니다.</p>
    <p>회귀 기울기 값은 <strong>${reg.slope.toFixed(3)}</strong>로 나타나, '${var1}'가 1단위 증가할 때마다 '${var2}'가 약 <strong>${reg.slope.toFixed(2)}</strong>만큼 ${reg.slope > 0 ? '증가' : '감소'}하는 선형 관계가 나타날 것으로 추정됩니다.</p>
  `;

  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--danger-light)";
  alertBox.style.color = "var(--danger)";
  alertBox.style.borderColor = "var(--danger)";
  alertTxt.textContent = "CRITICAL WARNING (인과 비약 방지): 회귀 분석은 예측 방정식 형태로 인과를 흉내 내지만, 실제로는 통계적 '선형 패턴'을 수치화한 것에 불과합니다. 변수 간의 논리적 메커니즘과 이론적 기반이 없거나 교란 변수를 차단하지 못했다면 결코 완벽한 원인-결과(인과)로 단정할 수 없으며 오직 상관성에 준해 보고해야 합니다.";
}

// 가정 점검 대시보드 렌더러
function renderAssumptionDashboard(checks) {
  const container = document.getElementById("assumption-list-container");
  container.innerHTML = "";
  
  checks.forEach(chk => {
    const item = document.createElement("div");
    let statusClass = "success";
    let iconClass = "fa-circle-check";
    
    if (chk.severity === "danger" || !chk.passed) {
      statusClass = "danger";
      iconClass = "fa-circle-xmark";
    } else if (chk.severity === "warning" || (chk.skewness !== undefined && !chk.passed)) {
      statusClass = "warning";
      iconClass = "fa-triangle-exclamation";
    }

    item.className = `assumption-item ${statusClass}`;
    item.innerHTML = `
      <i class="fa-solid ${iconClass} assumption-icon"></i>
      <div class="assumption-content">
        <h4>${chk.passed ? "충족됨" : "주의 / 조정 필요"}</h4>
        <p>${chk.reason}</p>
      </div>
    `;
    container.appendChild(item);
  });
}

// --- 4. 확률분포 계산기 화면 ---
function initProbCalculator() {
  const distSelect = document.getElementById("prob-dist-type");
  const rangeSelect = document.getElementById("select-prob-range");

  distSelect.addEventListener("change", () => {
    const normalParams = document.getElementById("prob-normal-params");
    const binomialParams = document.getElementById("prob-binomial-params");

    if (distSelect.value === "normal") {
      normalParams.classList.remove("hidden");
      binomialParams.classList.add("hidden");
    } else {
      normalParams.classList.add("hidden");
      binomialParams.classList.remove("hidden");
    }
  });

  rangeSelect.addEventListener("change", () => {
    const groupB = document.getElementById("group-prob-b");
    if (rangeSelect.value === "between") {
      groupB.classList.remove("hidden");
    } else {
      groupB.classList.add("hidden");
    }
  });

  document.getElementById("btn-run-prob").onclick = runProbabilityCalculation;
}

function runProbabilityCalculation() {
  const dist = document.getElementById("prob-dist-type").value;
  const range = document.getElementById("select-prob-range").value;
  const a = parseFloat(document.getElementById("input-prob-a").value);
  const b = parseFloat(document.getElementById("input-prob-b").value);

  let pVal = 0;
  let formulaStr = "";
  let infoStr = "";

  const isDark = AppState.theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#c8cdd4" : "#2d3748";

  const plotLabels = [];
  const plotData = [];
  const fillColors = [];

  if (dist === "normal") {
    const mean = parseFloat(document.getElementById("input-norm-mean").value);
    const std = parseFloat(document.getElementById("input-norm-std").value);
    if (std <= 0) {
      alert("표준편차는 0보다 커야 합니다.");
      return;
    }

    const cdf = (x) => jStat.normal.cdf(x, mean, std);
    const pdf = (x) => jStat.normal.pdf(x, mean, std);

    if (range === "less") {
      pVal = cdf(a);
      formulaStr = `P(X ≤ ${a.toFixed(2)}) = `;
    } else if (range === "greater") {
      pVal = 1 - cdf(a);
      formulaStr = `P(X ≥ ${a.toFixed(2)}) = `;
    } else {
      pVal = cdf(b) - cdf(a);
      formulaStr = `P(${a.toFixed(2)} ≤ X ≤ ${b.toFixed(2)}) = `;
    }

    infoStr = `정규분포: 평균 μ = ${mean}, 분산 σ² = ${(std*std).toFixed(2)}`;

    const start = mean - 4 * std;
    const end = mean + 4 * std;
    const step = (end - start) / 100;

    for (let i = 0; i <= 100; i++) {
      const x = start + i * step;
      plotLabels.push(x.toFixed(2));
      const y = pdf(x);
      plotData.push(y);

      let isFilled = false;
      if (range === "less" && x <= a) isFilled = true;
      else if (range === "greater" && x >= a) isFilled = true;
      else if (range === "between" && x >= a && x <= b) isFilled = true;

      fillColors.push(isFilled ? "rgba(114, 46, 209, 0.4)" : "rgba(114, 46, 209, 0.05)");
    }

  } else {
    const n = parseInt(document.getElementById("input-bin-n").value);
    const p = parseFloat(document.getElementById("input-bin-p").value);

    if (n < 1 || isNaN(n)) {
      alert("시행 횟수 n은 1 이상의 정수여야 합니다.");
      return;
    }
    if (p < 0 || p > 1 || isNaN(p)) {
      alert("성공 확률 p는 0과 1 사이여야 합니다.");
      return;
    }

    const pmf = (k) => {
      if (k < 0 || k > n) return 0;
      return jStat.binomial.pdf(k, n, p);
    };

    let cumProb = 0;
    for (let k = 0; k <= n; k++) {
      const prob = pmf(k);
      plotLabels.push(k.toString());
      plotData.push(prob);

      let isFilled = false;
      if (range === "less" && k <= a) { isFilled = true; cumProb += prob; }
      else if (range === "greater" && k >= a) { isFilled = true; cumProb += prob; }
      else if (range === "between" && k >= a && k <= b) { isFilled = true; cumProb += prob; }

      fillColors.push(isFilled ? "var(--primary)" : "rgba(114, 46, 209, 0.2)");
    }
    pVal = cumProb;

    if (range === "less") {
      formulaStr = `P(X ≤ ${Math.floor(a)}) = `;
    } else if (range === "greater") {
      formulaStr = `P(X ≥ ${Math.ceil(a)}) = `;
    } else {
      formulaStr = `P(${Math.ceil(a)} ≤ X ≤ ${Math.floor(b)}) = `;
    }

    const mean = n * p;
    const variance = n * p * (1 - p);
    infoStr = `이항분포 B(${n}, ${p}): 평균 E(X) = ${mean.toFixed(2)}, 분산 V(X) = ${variance.toFixed(2)}`;
  }

  document.getElementById("display-prob-expr").textContent = formulaStr;
  document.getElementById("display-prob-val").textContent = pVal.toFixed(4);
  document.getElementById("display-prob-pct").textContent = `(${(pVal * 100).toFixed(2)}%)`;
  document.getElementById("dist-summary-info").innerHTML = `<strong>${infoStr}</strong>`;

  const ctx = document.getElementById("prob-chart");
  if (AppState.chartInstance) AppState.chartInstance.destroy();

  if (dist === "normal") {
    AppState.chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: plotLabels,
        datasets: [{
          label: "확률밀도함수 (PDF)",
          data: plotData,
          borderColor: "var(--primary)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: (ctx) => {
            return fillColors;
          },
          segment: {
            backgroundColor: (ctx) => fillColors[ctx.p0.parsed.x] || "transparent"
          }
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "정규분포 확률 계산 시각화", color: textColor }
        },
        scales: {
          x: { ticks: { color: textColor, maxTicksLimit: 15 }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
        }
      }
    });
  } else {
    AppState.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: plotLabels,
        datasets: [{
          label: "확률질량함수 (PMF)",
          data: plotData,
          backgroundColor: fillColors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: `이항분포 도수분포 시각화`, color: textColor }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
        }
      }
    });
  }

  document.getElementById("btn-download-prob-chart").onclick = () => {
    const url = ctx.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Probability_Distribution.png`;
    a.click();
  };
}

// --- 5. 분석 추천 도우미 (질문 단계식 마법사) ---
function initWizard() {
  let currentStep = 1;
  const progressBar = document.getElementById("wizard-progress-bar");
  const nextBtn = document.getElementById("btn-wizard-next");
  const prevBtn = document.getElementById("btn-wizard-prev");
  const goBtn = document.getElementById("btn-wizard-go");

  const step1 = document.getElementById("wizard-step-1");
  const step2 = document.getElementById("wizard-step-2");
  const step3 = document.getElementById("wizard-step-3");
  const step4 = document.getElementById("wizard-step-4");

  let recommendedMethod = "ind-t"; // 추천 타겟 변수

  nextBtn.addEventListener("click", () => {
    const purpose = document.querySelector('input[name="opt-purpose"]:checked').value;

    if (currentStep === 1) {
      if (purpose === "compare") {
        currentStep = 2; // 집단 수 물어보기로 이동
        step1.classList.remove("active");
        step2.classList.add("active");
      } else if (purpose === "relation") {
        currentStep = 3; // 변수 형태 물어보기로 이동
        step1.classList.remove("active");
        step3.classList.add("active");
      } else {
        // 비율 확인의 경우 -> 카이제곱 적합도로 고정 추천
        currentStep = 4;
        recommendedMethod = "chisq-fit";
        step1.classList.remove("active");
        step4.classList.add("active");
        renderRecommendation();
      }
      prevBtn.classList.remove("hidden");
    } else if (currentStep === 2) {
      // 집단 평균 비교 분기
      const groups = document.querySelector('input[name="opt-groups"]:checked').value;
      currentStep = 4;
      step2.classList.remove("active");
      step4.classList.add("active");

      if (groups === "2") recommendedMethod = "ind-t";
      else if (groups === "3plus") recommendedMethod = "anova";
      else recommendedMethod = "paired-t";
      renderRecommendation();
    } else if (currentStep === 3) {
      // 상관/회귀 비교 분기
      const varType = document.querySelector('input[name="opt-var-type"]:checked').value;
      currentStep = 4;
      step3.classList.remove("active");
      step4.classList.add("active");

      if (varType === "continuous") recommendedMethod = "correlation"; // 피어슨 상관분석
      else recommendedMethod = "chisq-ind"; // 카이제곱 독립성
      renderRecommendation();
    }

    updateWizardProgress();
  });

  prevBtn.addEventListener("click", () => {
    if (currentStep === 2 || currentStep === 3) {
      step2.classList.remove("active");
      step3.classList.remove("active");
      step1.classList.add("active");
      currentStep = 1;
      prevBtn.classList.add("hidden");
    } else if (currentStep === 4) {
      const purpose = document.querySelector('input[name="opt-purpose"]:checked').value;
      step4.classList.remove("active");
      if (purpose === "compare") {
        step2.classList.add("active");
        currentStep = 2;
      } else if (purpose === "relation") {
        step3.classList.add("active");
        currentStep = 3;
      } else {
        step1.classList.add("active");
        currentStep = 1;
        prevBtn.classList.add("hidden");
      }
    }
    updateWizardProgress();
  });

  function updateWizardProgress() {
    const pct = currentStep === 1 ? 25 : currentStep === 2 || currentStep === 3 ? 60 : 100;
    progressBar.style.width = `${pct}%`;

    if (currentStep === 4) {
      nextBtn.classList.add("hidden");
      goBtn.classList.remove("hidden");
    } else {
      nextBtn.classList.remove("hidden");
      goBtn.classList.add("hidden");
    }
  }

  function renderRecommendation() {
    const nameEl = document.getElementById("rec-analysis-name");
    const descEl = document.getElementById("rec-analysis-desc");
    const assumptionsEl = document.getElementById("rec-analysis-assumptions");

    if (recommendedMethod === "ind-t") {
      nameEl.textContent = "독립표본 t-검정 (Independent Samples t-test)";
      descEl.textContent = "성별에 따른 시험 점수 차이처럼, 서로 겹치지 않는 두 집단의 평균값 차이가 우연인지 실제 의미 있는 격차인지 규명합니다.";
      assumptionsEl.innerHTML = `
        <li>정규성 가정: 각 집단의 데이터가 정규분포를 따릅니다.</li>
        <li>등분산성 가정: 두 집단의 흩어진 폭(분산)이 유사합니다. (다를 시 Welch의 보정 적용)</li>
        <li>비모수 대안: 표본이 적거나 정규성이 훼손될 시 'Mann-Whitney U 검정'을 고려합니다.</li>
      `;
    } else if (recommendedMethod === "paired-t") {
      nameEl.textContent = "대응표본 t-검정 (Paired Samples t-test)";
      descEl.textContent = "체중 감량 교육 전과 후의 몸무게처럼, 동일한 대상에 대한 사전/사후 두 값의 변동 차이가 통계적으로 실재하는지 증명합니다.";
      assumptionsEl.innerHTML = `
        <li>정규성 가정: 사전-사후의 '차이값' 분포가 정규성을 만족해야 합니다.</li>
        <li>비모수 대안: 정규성 위배 시 'Wilcoxon 부호순위 검정'을 대안으로 씁니다.</li>
      `;
    } else if (recommendedMethod === "anova") {
      nameEl.textContent = "일원분산분석 (One-way ANOVA)";
      descEl.textContent = "학년(1학년 vs 2학년 vs 3학년)에 따른 수면 평균처럼, 3개 이상 다중 집단의 평균들이 유의하게 다른지 한 번에 비교합니다.";
      assumptionsEl.innerHTML = `
        <li>다중검정 방지: t-검정을 3번 반복하는 오류를 피하게 해줍니다.</li>
        <li>사후검정(Post-hoc): 차이가 난다면 어떤 집단들끼리 격차가 생겼는지 Tukey HSD 검정 등을 연계 수행합니다.</li>
        <li>비모수 대안: Kruskal-Wallis H 검정이 있습니다.</li>
      `;
    } else if (recommendedMethod === "correlation") {
      nameEl.textContent = "피어슨 상관분석 (Pearson Correlation)";
      descEl.textContent = "하루 공부 시간과 기말고사 성적처럼, 두 연속형 변수가 얼마나 일직선 방향으로 비례하여 밀접하게 연관되어 있는지 평가합니다.";
      assumptionsEl.innerHTML = `
        <li>선형성 가정: 두 변수 관계가 곡선이 아닌 직선 비례 성향이어야 합니다.</li>
        <li>인과 오용 경고: 상관이 아무리 높아도 한 요인이 다른 쪽의 직접적 원인이라고 단정하면 안 됩니다.</li>
      `;
    } else if (recommendedMethod === "chisq-fit") {
      nameEl.textContent = "카이제곱 적합도 검정 (Chi-Square Goodness of Fit)";
      descEl.textContent = "주사위를 던져 나온 범주 빈도가 정육면체의 균등한 수학적 기대분포에 적절히 부합하는지 봅니다.";
      assumptionsEl.innerHTML = `
        <li>기대빈도 조건: 기대빈도가 5 미만인 범주 비율이 20%를 넘지 않아야 근사 계산이 올바릅니다.</li>
      `;
    } else if (recommendedMethod === "chisq-ind") {
      nameEl.textContent = "카이제곱 독립성 검정 (Chi-Square Independence Test)";
      descEl.textContent = "성별(남/여)에 따른 선호 급식(양식/일식) 비율처럼, 두 범주형 변수의 결합 빈도 편차가 완전히 무관(독립)한지 혹은 연동하는지 살핍니다.";
      assumptionsEl.innerHTML = `
        <li>비교 데이터: 두 변수의 교차 분할표를 사용하여 계산합니다.</li>
        <li>기대빈도 조건: 5 미만인 셀이 20%를 초과할 시 피셔의 정확검정이나 데이터 병합을 권합니다.</li>
      `;
    }
  }

  // 추천된 분석으로 강제 탭 이동 및 로드
  goBtn.addEventListener("click", () => {
    // 추론통계 탭 활성화
    const inferTab = document.querySelector('[data-tab="tab-infer"]');
    inferTab.click();

    // 해당 분석 드롭다운을 추천 기법으로 강제 매칭
    document.getElementById("infer-method").value = recommendedMethod;
    updateInferMethodOptions();
    
    // 원래 단계로 리셋
    step4.classList.remove("active");
    step1.classList.add("active");
    prevBtn.classList.add("hidden");
    goBtn.classList.add("hidden");
    nextBtn.classList.remove("hidden");
    currentStep = 1;
    progressBar.style.width = "25%";
  });
}

// --- 공통 유틸리티: 표 복사 기능 ---
const copyBtns = document.querySelectorAll(".btn-copy-table");
copyBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-target");
    const table = document.getElementById(targetId);
    if (!table) return;

    // 클립보드에 HTML 테이블 복사
    let range = document.createRange();
    range.selectNode(table);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    
    try {
      const successful = document.execCommand("copy");
      if (successful) {
        alert("테이블이 클립보드에 복사되었습니다. 한글/워드/엑셀 문서에 붙여넣기(Ctrl+V) 하세요!");
      }
    } catch (err) {
      alert("복사에 실패했습니다. 마우스로 긁어서 복사해주세요.");
    }
    window.getSelection().removeAllRanges();
  });
});
