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

// --- 추론통계 오차막대(Error Bar) 시각화 헬퍼 함수 (Canvas 기반) ---
function drawErrorBarChart(canvasId, titleText, groupsInfo, testValueInfo = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  if (AppState.chartInstance) {
    AppState.chartInstance.destroy();
    AppState.chartInstance = null;
  }
  
  canvas.classList.remove("hidden");
  const ctx = canvas.getContext("2d");
  const isDark = AppState.theme === "dark";
  const textColor = isDark ? "#c8cdd4" : "#2d3748";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  
  canvas.width = 500;
  canvas.height = 300;
  
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  ctx.fillStyle = textColor;
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(titleText, w / 2, 25);
  
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 60;
  const paddingBottom = 60;
  const plotWidth = w - paddingLeft - paddingRight;
  const plotHeight = h - paddingTop - paddingBottom;
  
  let allVals = [];
  groupsInfo.forEach(g => {
    allVals.push(g.mean, g.lower, g.upper);
  });
  if (testValueInfo) {
    allVals.push(testValueInfo.value);
  }
  
  let minVal = Math.min(...allVals);
  let maxVal = Math.max(...allVals);
  
  const valRange = maxVal - minVal || 1.0;
  const margin = valRange * 0.2;
  
  minVal -= margin;
  maxVal += margin;
  
  const getY = (val) => {
    return paddingTop + plotHeight * (1 - (val - minVal) / (maxVal - minVal));
  };
  
  const numGroups = groupsInfo.length;
  const getX = (idx) => {
    const segment = plotWidth / (numGroups + 1);
    return paddingLeft + segment * (idx + 1);
  };
  
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = textColor;
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  
  const numTicks = 5;
  for (let i = 0; i <= numTicks; i++) {
    const tickVal = minVal + (maxVal - minVal) * (i / numTicks);
    const tickY = getY(tickVal);
    
    ctx.beginPath();
    ctx.moveTo(paddingLeft, tickY);
    ctx.lineTo(w - paddingRight, tickY);
    ctx.stroke();
    
    ctx.fillText(tickVal.toFixed(2), paddingLeft - 8, tickY + 3);
  }
  
  if (testValueInfo) {
    const testY = getY(testValueInfo.value);
    ctx.strokeStyle = "rgba(255, 77, 79, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(paddingLeft, testY);
    ctx.lineTo(w - paddingRight, testY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = "rgba(255, 77, 79, 1)";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${testValueInfo.label}: ${testValueInfo.value}`, paddingLeft + 5, testY - 6);
  }
  
  groupsInfo.forEach((g, idx) => {
    const x = getX(idx);
    const yMean = getY(g.mean);
    const yLower = getY(g.lower);
    const yUpper = getY(g.upper);
    
    ctx.strokeStyle = isDark ? "#85a5ff" : "#2f54eb";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(x, yLower);
    ctx.lineTo(x, yUpper);
    
    const capWidth = 8;
    ctx.moveTo(x - capWidth, yLower);
    ctx.lineTo(x + capWidth, yLower);
    ctx.moveTo(x - capWidth, yUpper);
    ctx.lineTo(x + capWidth, yUpper);
    ctx.stroke();
    
    ctx.fillStyle = "rgba(114, 46, 209, 1)";
    ctx.beginPath();
    ctx.arc(x, yMean, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = textColor;
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`평균: ${g.mean.toFixed(2)}`, x + 8, yMean - 2);
    ctx.fillStyle = "var(--text-muted)";
    ctx.font = "8px sans-serif";
    ctx.fillText(`[${g.lower.toFixed(2)} ~ ${g.upper.toFixed(2)}]`, x + 8, yMean + 8);
    
    ctx.fillStyle = textColor;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(g.name, x, h - paddingBottom + 18);
  });
  
  document.getElementById("btn-download-infer-chart").onclick = () => {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `ErrorBar_${titleText.replace(/\s+/g, "_")}.png`;
    a.click();
  };
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
  inferState: {
    method: "ci",
    variables: {},
    checkedOptions: {}
  },
  theme: "light",   // 테마: light / dark
  currentPage: 1,   // 현재 페이지 번호
  pageSize: 50      // 한 페이지당 노출할 행 수
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
  
  // 다운로드 트리거
  XLSX.writeFile(wb, "DD_Stat_Template.xlsx");
}

// --- 현재 데이터 내보내기 (다운로드) 함수 ---
function downloadCurrentData() {
  if (typeof XLSX === 'undefined') {
    alert("SheetJS 라이브러리가 로드되지 않아 데이터를 내보낼 수 없습니다.");
    return;
  }
  if (AppState.data.length === 0) {
    alert("내보낼 데이터가 없습니다. 먼저 데이터를 업로드하거나 입력해 주십시오.");
    return;
  }

  // 1. 헤더행 구성
  const headers = AppState.headers;
  const ws_data = [headers];

  // 2. 데이터행들 구성
  AppState.data.forEach(row => {
    const rowList = [];
    headers.forEach(h => {
      rowList.push(row[h]);
    });
    ws_data.push(rowList);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, "내보낸_데이터");

  // 파일 다운로드 트리거
  XLSX.writeFile(wb, "DD_Stat_Data_Export.xlsx");
}

// --- 연구 프로젝트 저장 (JSON) ---
function exportProjectJSON() {
  if (AppState.data.length === 0) {
    alert("저장할 프로젝트 데이터가 없습니다. 먼저 데이터를 업로드하거나 작성해 주십시오.");
    return;
  }

  const projectObj = {
    app: "DD_Stat",
    version: "1.0",
    headers: AppState.headers,
    colTypes: AppState.colTypes,
    valueLabels: AppState.valueLabels,
    missingRules: AppState.missingRules || {},
    data: AppState.data
  };

  try {
    const jsonString = JSON.stringify(projectObj, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "DD_Stat_Project_Backup.json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("프로젝트 JSON 생성 중 오류가 발생했습니다: " + err.message);
  }
}

// 분석 결과 종합 보고서 내보내기 (HTML 포맷)
function downloadAnalysisReport() {
  const descPanel = document.getElementById("desc-result-panel");
  const inferPanel = document.getElementById("infer-result-panel");

  const hasDesc = descPanel && descPanel.innerHTML.trim() !== "";
  const hasInfer = inferPanel && inferPanel.innerHTML.trim() !== "" && !inferPanel.classList.contains("hidden");

  if (!hasDesc && !hasInfer) {
    alert("화면에 출력된 통계 분석 결과가 없습니다. 분석을 먼저 수행해 주세요.");
    return;
  }

  // 1) 기술통계 결과 복제 및 Canvas 변환
  let descHtml = "";
  if (hasDesc) {
    const clone = descPanel.cloneNode(true);
    const origCanvases = descPanel.querySelectorAll("canvas");
    const cloneCanvases = clone.querySelectorAll("canvas");
    
    for (let i = 0; i < origCanvases.length; i++) {
      const origCanvas = origCanvases[i];
      const cloneCanvas = cloneCanvases[i];
      try {
        const dataUrl = origCanvas.toDataURL("image/png");
        const img = document.createElement("img");
        img.src = dataUrl;
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        img.style.display = "block";
        img.style.margin = "15px auto";
        img.style.borderRadius = "4px";
        img.style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)";
        
        cloneCanvas.parentNode.replaceChild(img, cloneCanvas);
      } catch (e) {
        console.error("Canvas export failed: ", e);
      }
    }
    const hiddenStem = clone.querySelector("#stem-leaf-display.hidden");
    if (hiddenStem) hiddenStem.remove();

    descHtml = clone.innerHTML;
  }

  // 2) 추론통계 결과 복제 및 Canvas 변환
  let inferHtml = "";
  if (hasInfer) {
    const clone = inferPanel.cloneNode(true);
    const origCanvases = inferPanel.querySelectorAll("canvas");
    const cloneCanvases = clone.querySelectorAll("canvas");

    for (let i = 0; i < origCanvases.length; i++) {
      const origCanvas = origCanvases[i];
      const cloneCanvas = cloneCanvases[i];
      try {
        const dataUrl = origCanvas.toDataURL("image/png");
        const img = document.createElement("img");
        img.src = dataUrl;
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        img.style.display = "block";
        img.style.margin = "15px auto";
        img.style.borderRadius = "4px";
        img.style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)";
        
        cloneCanvas.parentNode.replaceChild(img, cloneCanvas);
      } catch (e) {
        console.error("Canvas export failed: ", e);
      }
    }
    inferHtml = clone.innerHTML;
  }

  // 3) HTML 템플릿 결합
  const dateStr = new Date().toLocaleString();
  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DD-Stat 통계 분석 종합 보고서</title>
  <style>
    body {
      font-family: 'Noto Sans KR', 'Inter', -apple-system, sans-serif;
      padding: 2rem;
      color: #2d3748;
      background-color: #f7fafc;
      line-height: 1.6;
    }
    .report-container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 3rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    h1 {
      text-align: center;
      color: #722ed1;
      margin-bottom: 0.5rem;
      font-size: 2.2rem;
      border-bottom: 2px solid #722ed1;
      padding-bottom: 1rem;
    }
    h2 {
      color: #1677ff;
      margin-top: 3rem;
      border-left: 5px solid #1677ff;
      padding-left: 0.8rem;
      font-size: 1.5rem;
      background: #e6f7ff;
      padding-top: 6px;
      padding-bottom: 6px;
      border-radius: 0 4px 4px 0;
    }
    h3 {
      color: #2d3748;
      margin-top: 2rem;
      font-size: 1.25rem;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 0.4rem;
    }
    h4 {
      font-size: 1.1rem;
      color: #4a5568;
    }
    .data-table-result {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.85rem;
    }
    .data-table-result th, .data-table-result td {
      padding: 0.6rem 0.8rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    .data-table-result th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #4a5568;
    }
    .data-table-result th:first-child, .data-table-result td:first-child {
      min-width: 140px;
      word-break: keep-all;
    }
    .text-center {
      text-align: center;
    }
    .text-danger {
      color: #cf1322;
      font-weight: 600;
    }
    .text-success {
      color: #389e0d;
      font-weight: 600;
    }
    .highlight-row td {
      background-color: #f9f0ff;
      font-weight: 600;
    }
    .chart-wrapper {
      text-align: center;
      margin: 2rem 0;
      background: #fafafa;
      padding: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .interpretation-text {
      font-size: 0.95rem;
      line-height: 1.8;
      background: #faf5ff;
      padding: 1.2rem;
      border-radius: 6px;
      margin-top: 1rem;
      border-left: 4px solid #722ed1;
    }
    .interpretation-text p {
      margin-bottom: 0.8rem;
    }
    .meta-info {
      font-size: 0.85rem;
      color: #718096;
      text-align: right;
      margin-bottom: 2rem;
      border-bottom: 1px solid #edf2f7;
      padding-bottom: 8px;
    }
    button, .btn {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <h1>📊 DD-Stat 통계 분석 종합 보고서</h1>
    <div class="meta-info">출력 일시: ${dateStr} | 동덕여자고등학교 수학과 통계 분석 프로그램</div>
    
    ${descHtml ? `<h2>📊 1. 기술통계 및 시각화 결과</h2>${descHtml}` : ""}
    ${inferHtml ? `<h2>🧪 2. 추론통계 가설 검정 결과</h2>${inferHtml}` : ""}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  a.href = url;
  a.download = `DD-Stat_분석보고서_${yyyymmdd}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  initPaginationEvents();

  // 템플릿 다운로드 버튼 바인딩
  const downloadBtn = document.getElementById("btn-download-template");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadExcelTemplate);
  }

  // 현재 데이터 내보내기 버튼 바인딩
  const exportBtn = document.getElementById("btn-download-data");
  if (exportBtn) {
    exportBtn.addEventListener("click", downloadCurrentData);
  }

  // 프로젝트 JSON 백업 내보내기 버튼 바인딩
  const exportProjBtn = document.getElementById("btn-export-project");
  if (exportProjBtn) {
    exportProjBtn.addEventListener("click", exportProjectJSON);
  }

  // 분석 결과 종합 보고서 저장 버튼 바인딩
  const exportReportBtn = document.getElementById("btn-export-report");
  if (exportReportBtn) {
    exportReportBtn.addEventListener("click", downloadAnalysisReport);
  }
});

// --- 테마 설정 (다크/라이트 모드) ---
function initTheme() {
  const btnToggle = document.getElementById("btn-theme-toggle");
  
  // 시스템 기본값 또는 기존 설정 반영 (로컬 file:/// 환경에서의 SecurityError 방지)
  let savedTheme = "light";
  try {
    savedTheme = localStorage.getItem("stats-theme") || "light";
  } catch (e) {
    console.warn("localStorage access denied in local file protocol. Defaulting to light theme.");
  }
  
  document.documentElement.setAttribute("data-theme", savedTheme);
  AppState.theme = savedTheme;
  updateThemeUI();

  btnToggle.addEventListener("click", () => {
    AppState.theme = AppState.theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", AppState.theme);
    try {
      localStorage.setItem("stats-theme", AppState.theme);
    } catch (e) {
      console.warn("localStorage write access denied in local file protocol.");
    }
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
  // 현재 활성화된 탭에 맞춰 그래프 다시 그리기
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

      // 헤더 제목/설명 변경
      updateHeaderInfo(tabId);

      // 분석 선택/변수 드롭다운 최신화
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
  } else if (ext === "json") {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const projectObj = JSON.parse(e.target.result);
        if (projectObj.app !== "DD_Stat" || !projectObj.data || !projectObj.headers) {
          alert("유효한 DD Stat 프로젝트 백업 파일이 아닙니다.");
          return;
        }

        // 상태 복원
        AppState.headers = projectObj.headers;
        AppState.colTypes = projectObj.colTypes || {};
        AppState.valueLabels = projectObj.valueLabels || {};
        AppState.missingRules = projectObj.missingRules || {};
        AppState.data = projectObj.data;

        AppState.selectedRows.clear();
        AppState.currentPage = 1;

        updateDataWorkspace();
        resetAnalysisVariables();
        showWorkspace(true);
        alert("DD Stat 프로젝트 데이터 및 변수 설정이 완벽하게 복원되었습니다!");
      } catch (err) {
        alert("JSON 프로젝트 파일 로드 중 오류가 발생했습니다: " + err.message);
      }
    };
    reader.readAsText(file);
  } else {
    alert("지원하지 않는 파일 형식입니다. CSV, Excel 또는 JSON(프로젝트) 파일을 선택해주세요.");
  }
}

function processRawData(parsedRows, fields) {
  // __EMPTY 헤더 정제
  let cleanFields = fields.filter(f => f && !String(f).startsWith("__EMPTY"));

  AppState.valueLabels = {}; // 값 레이블 초기화
  AppState.missingRules = {}; // 결측값 규칙 초기화
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
    // 실제 데이터가 존재하는 행만 추가 (전체 셀이 비어있는 빈 행 무시)
    if (hasData) {
      tempRows.push(cleanRow);
    }
  });
  AppState.data = tempRows;

  // 열 유형 초기 자동 판정 (모두 숫자인 경우 continuous, 문자열이 섞였으면 categorical)
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
      AppState.colTypes[f] = "continuous"; // 연속형
    } else {
      AppState.colTypes[f] = "categorical"; // 범주형
    }
  });

  AppState.selectedRows.clear();
  AppState.currentPage = 1;
  updateDataWorkspace();
  resetAnalysisVariables();
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
  // 1) 학업 성취도 & 수면 시간 (Sleep_Hours, Academic_Score)
  document.getElementById("btn-sample-study").addEventListener("click", () => {
    const sleep = [7.5, 6.0, 5.5, 8.0, 4.5, 7.0, 6.5, 5.0, 8.5, 6.0, 7.0, 5.5, 6.5, 7.5, 5.0, 6.0, 8.0, 4.0, 7.0, 6.5, 9.0, 5.8, 6.8, 7.2, 5.2, 6.2, 8.2, 4.8, 7.8, 6.4];
    const score = [85, 72, 65, 90, 50, 80, 78, 60, 92, 70, 82, 68, 75, 88, 62, 74, 86, 45, 81, 76, 95, 71, 80, 84, 61, 73, 89, 58, 87, 72];
    
    const rows = sleep.map((s, idx) => ({
      "수면_시간(시간)": s,
      "학업_성적(점수)": score[idx]
    }));
    processRawData(rows, ["수면_시간(시간)", "학업_성적(점수)"]);
  });

  // 2) 식습관 선호도 (Gender, Preferred_Food)
  document.getElementById("btn-sample-diet").addEventListener("click", () => {
    const genders = ["남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여", "남", "여"];
    const foods = ["한식", "일식", "양식", "한식", "양식", "일식", "한식", "일식", "양식", "한식", "한식", "한식", "양식", "일식", "양식", "한식", "한식", "일식", "양식", "일식", "한식", "한식", "양식", "일식", "양식", "일식", "한식", "한식", "양식", "일식"];
    
    const rows = genders.map((g, idx) => ({
      "성별": g,
      "선호_음식": foods[idx]
    }));
    processRawData(rows, ["성별", "선호_음식"]);
  });

  // 3) 수학 점수 차이 (Group_Method, Math_Score)
  document.getElementById("btn-sample-score").addEventListener("click", () => {
    const groups = ["강의식", "강의식", "강의식", "강의식", "강의식", "토론식", "토론식", "토론식", "토론식", "토론식", "자기주도", "자기주도", "자기주도", "자기주도", "자기주도"];
    const math = [75, 80, 78, 85, 72, 85, 90, 88, 92, 86, 60, 65, 58, 62, 65];
    
    const rows = groups.map((g, idx) => ({
      "학습_방법": g,
      "수학_성적": math[idx]
    }));
    processRawData(rows, ["학습_방법", "수학_성적"]);
  });

  // 데이터 초기화 버튼
  document.getElementById("btn-reset-data").addEventListener("click", () => {
    if (confirm("정말로 모든 데이터를 초기화하시겠습니까?")) {
      AppState.data = [];
      AppState.headers = [];
      AppState.colTypes = {};
      AppState.selectedRows.clear();
      showWorkspace(false);
      
      // 요약 상태 갱신
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

  // 기초 정보 계산
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

  // 1. 변수 속성 지정 카드 채우기
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
      // 데이터를 알맞은 타입으로 컨버전 시도
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

    // 값 레이블 설정 입력 영역 추가
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

    // 결측값 지정 입력 영역 추가
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

    // 열 삭제 버튼 추가
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
}

function deleteColumn(colName) {
  if (AppState.headers.length <= 1) {
    alert("최소 1개 이상의 열이 존재해야 합니다.");
    return;
  }
  if (!confirm(`'${colName}' 열을 정말 삭제하시겠습니까? 데이터와 속성이 모두 삭제됩니다.`)) {
    return;
  }
  
  // 1. headers에서 삭제
  AppState.headers = AppState.headers.filter(h => h !== colName);
  
  // 2. data 행 객체에서 삭제
  AppState.data.forEach(row => {
    delete row[colName];
  });
  
  // 3. colTypes, valueLabels, missingRules에서 삭제
  delete AppState.colTypes[colName];
  delete AppState.valueLabels[colName];
  if (AppState.missingRules) {
    delete AppState.missingRules[colName];
  }
  
  // 4. 워크스페이스 갱신
  updateDataWorkspace();
  
  // 5. 분석 변수 선택 폼 갱신 및 초기화
  resetAnalysisVariables(colName);
}

function resetAnalysisVariables(colName) {
  // 1. colName이 명시된 경우 분석용 select들의 선택값 초기화 (기존 로직 유지)
  if (colName) {
    const selects = ["desc-select-var1", "desc-select-var2", "infer-select-var", "infer-select-group", "infer-select-var1", "infer-select-var2", "select-recode-col"];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value === colName) {
        el.value = "";
      }
    });
  }

  // 2. 실제 데이터 테이블 렌더링
  const headerRow = document.getElementById("table-header-row");
  const bodyRows = document.getElementById("table-body-rows");

  // 헤더 생성
  headerRow.innerHTML = `<th style="width: 40px;"><input type="checkbox" id="check-all-rows"></th>`;
  AppState.headers.forEach(h => {
    headerRow.innerHTML += `<th>${h}</th>`;
  });

  // 페이지 슬라이싱 범위 계산
  const totalRows = AppState.data.length;
  const start = (AppState.currentPage - 1) * AppState.pageSize;
  const end = Math.min(start + AppState.pageSize, totalRows);
  const pageData = AppState.data.slice(start, end);

  // 체크박스 마스터 이벤트 (현재 페이지의 노출된 행들만 선택/해제)
  const checkAll = document.getElementById("check-all-rows");
  
  // 마스터 체크박스의 초기 상태 결정 (현재 페이지가 모두 선택되어 있는가)
  let allCheckedOnPage = pageData.length > 0;
  for (let i = 0; i < pageData.length; i++) {
    const globalIdx = start + i;
    if (!AppState.selectedRows.has(globalIdx)) {
      allCheckedOnPage = false;
      break;
    }
  }
  checkAll.checked = allCheckedOnPage;

  checkAll.onchange = (e) => {
    const isChecked = e.target.checked;
    const itemChecks = bodyRows.querySelectorAll(".row-select-check");
    itemChecks.forEach(chk => {
      chk.checked = isChecked;
      const localIdx = parseInt(chk.dataset.rowIndex);
      const globalIdx = start + localIdx;
      if (isChecked) AppState.selectedRows.add(globalIdx);
      else AppState.selectedRows.delete(globalIdx);
    });
  };

  // 바디 행들 생성
  bodyRows.innerHTML = "";
  pageData.forEach((row, rIdx) => {
    const globalIdx = start + rIdx;
    const tr = document.createElement("tr");
    tr.id = `data-tr-${globalIdx}`;
    
    const tdCheck = document.createElement("td");
    tdCheck.innerHTML = `<input type="checkbox" class="row-select-check" data-row-index="${rIdx}" ${AppState.selectedRows.has(globalIdx) ? "checked" : ""}>`;
    tdCheck.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        AppState.selectedRows.add(globalIdx);
      } else {
        AppState.selectedRows.delete(globalIdx);
      }
      
      // 마스터 체크박스 동기화
      let allCheckedNow = true;
      for (let i = 0; i < pageData.length; i++) {
        if (!AppState.selectedRows.has(start + i)) {
          allCheckedNow = false;
          break;
        }
      }
      checkAll.checked = allCheckedNow;
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
          AppState.data[globalIdx][h] = "";
        } else {
          if (AppState.colTypes[h] === "continuous" || AppState.colTypes[h] === "likert") {
            const num = parseFloat(val);
            AppState.data[globalIdx][h] = isNaN(num) ? val : num;
          } else {
            AppState.data[globalIdx][h] = val;
          }
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    bodyRows.appendChild(tr);
  });

  // 페이지네이션 컨트롤러 노출 및 업데이트
  renderPagination();
}

function initTableControls() {
  // 행 추가
  document.getElementById("btn-add-row").addEventListener("click", () => {
    const newRow = {};
    AppState.headers.forEach(h => {
      newRow[h] = "";
    });
    AppState.data.push(newRow);
    
    // 새 행 추가 시 마지막 페이지로 자동 이동
    AppState.currentPage = Math.ceil(AppState.data.length / AppState.pageSize);
    updateDataWorkspace();
    resetAnalysisVariables();
  });

  // 열 추가
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
      resetAnalysisVariables();
    }
  });

  // 선택 삭제
  document.getElementById("btn-delete-selected").addEventListener("click", () => {
    if (AppState.selectedRows.size === 0) {
      alert("삭제할 행을 체크해 주세요.");
      return;
    }

    if (confirm(`선택한 ${AppState.selectedRows.size}개의 행을 삭제하시겠습니까?`)) {
      // 인덱스가 뒤바뀌지 않게 역순으로 제거
      const sortedIdxs = Array.from(AppState.selectedRows).sort((a, b) => b - a);
      sortedIdxs.forEach(idx => {
        AppState.data.splice(idx, 1);
      });
      AppState.selectedRows.clear();
      
      // 페이지 범위 보정
      const totalPages = Math.ceil(AppState.data.length / AppState.pageSize);
      AppState.currentPage = Math.min(AppState.currentPage, Math.max(1, totalPages));
      
      updateDataWorkspace();
      resetAnalysisVariables();
    }
  });
}

// --- 결측값, 역코딩, 이상치 탐색 도구 ---
function initPreprocessTools() {
  // 1) 결측치 적용
  const btnApplyMissing = document.getElementById("btn-apply-missing");
  if (btnApplyMissing) {
    btnApplyMissing.addEventListener("click", () => {
      const method = document.getElementById("select-missing-handler").value;
      if (AppState.data.length === 0) return;

      if (method === "exclude") {
        AppState.data = AppState.data.filter(row => {
          return AppState.headers.every(h => !isMissingValue(h, row[h]));
        });
      } else if (method === "mean") {
        AppState.headers.forEach(h => {
          if (AppState.colTypes[h] === "continuous") {
            const vals = AppState.data
              .map(row => parseFloat(row[h]))
              .filter(v => !isNaN(v) && !isMissingValue(h, v));
            
            if (vals.length > 0) {
              const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
              AppState.data.forEach(row => {
                if (isMissingValue(h, row[h])) {
                  row[h] = parseFloat(avg.toFixed(3));
                }
              });
            }
          }
        });
      } else if (method === "zero") {
        AppState.data.forEach(row => {
          AppState.headers.forEach(h => {
            if (isMissingValue(h, row[h])) {
              row[h] = AppState.colTypes[h] === "continuous" ? 0 : "0";
            }
          });
        });
      }

      const totalPages = Math.ceil(AppState.data.length / AppState.pageSize);
      AppState.currentPage = Math.min(AppState.currentPage, Math.max(1, totalPages));
      updateDataWorkspace();
      resetAnalysisVariables();
      alert("결측치 전처리가 완료되었습니다.");
    });
  }

  // 역코딩 선택 목록 로드 헬퍼
  const selectRecodeCol = document.getElementById("select-recode-col");
  if (selectRecodeCol) {
    selectRecodeCol.addEventListener("focus", (e) => {
      e.target.innerHTML = `<option value="">변수 선택</option>` + AppState.headers
        .filter(h => AppState.colTypes[h] === "continuous" || AppState.colTypes[h] === "likert")
        .map(h => `<option value="${h}">${h}</option>`).join("");
    });
  }

  // 2) 역코딩 적용
  const btnApplyRecode = document.getElementById("btn-apply-recode");
  if (btnApplyRecode) {
    btnApplyRecode.addEventListener("click", () => {
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
      resetAnalysisVariables();
      alert(`변수 '${colName}'의 척도(${scale}점 기준) 역코딩이 ${count}개 데이터에 적용되었습니다.`);
    });
  }

  // 3) 이상치 탐색
  const outlierModal = document.getElementById("outlier-modal");
  const closeOutlier = document.getElementById("btn-close-outlier");
  const confirmOutlier = document.getElementById("btn-confirm-outlier");
  const btnDetectOutliers = document.getElementById("btn-detect-outliers");

  if (btnDetectOutliers) {
    btnDetectOutliers.addEventListener("click", () => {
      if (AppState.data.length === 0) return;

      // 테이블의 모든 이상치 마킹 초기화
      AppState.headers.forEach(h => {
        AppState.data.forEach((r, idx) => {
          const tr = document.getElementById(`data-tr-${idx}`);
          if (tr) tr.classList.remove("danger");
        });
      });

      const outlierReport = [];
      AppState.headers.forEach(h => {
        if (AppState.colTypes[h] === "continuous") {
          const desc = StatsHelper.calculateDescriptive(AppState.data.map(r => r[h]));
          if (desc && desc.outliers.length > 0) {
            // 테이블 행 마킹 및 모달 기록
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
      if (listDiv) {
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
      }

      if (outlierModal) {
        outlierModal.classList.remove("hidden");
      }
    });
  }

  if (closeOutlier && outlierModal) {
    closeOutlier.addEventListener("click", () => outlierModal.classList.add("hidden"));
  }
  if (confirmOutlier && outlierModal) {
    confirmOutlier.addEventListener("click", () => {
      outlierModal.classList.add("hidden");
      // 하이라이팅 초기화
      AppState.data.forEach((r, idx) => {
        const tr = document.getElementById(`data-tr-${idx}`);
        if (tr) tr.style.backgroundColor = "";
      });
    });
  }
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

  // 변수 선택 이벤트 바인딩
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

  // 1. 통계 요약표 그리기
  const descTable = document.getElementById("desc-table");
  
  if (!var2) {
    // 단일 변수 기술통계
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
      // 범주형 기술통계
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
    
    // 해석 완성하기
    renderDescInterpretation(var1, null);
    
  } else {
    const type2 = AppState.colTypes[var2];
    const is1Num2Cat = (type1 === "continuous" && (type2 === "categorical" || type2 === "likert"));
    const is1Cat2Num = ((type1 === "categorical" || type1 === "likert") && type2 === "continuous");

    if (is1Num2Cat || is1Cat2Num) {
      // 1) 수치형 x 범주형 교차비교 (집단별 기술통계량 평균 비교)
      const depVar = is1Num2Cat ? var1 : var2;
      const indVar = is1Num2Cat ? var2 : var1;

      const groups = {};
      AppState.data.forEach(row => {
        if (isMissingValue(depVar, row[depVar]) || isMissingValue(indVar, row[indVar])) return;
        const gVal = String(row[indVar]).trim();
        const numVal = parseFloat(row[depVar]);
        if (!isNaN(numVal)) {
          if (!groups[gVal]) groups[gVal] = [];
          groups[gVal].push(numVal);
        }
      });

      let html = `
        <tr>
          <th>집단 분류 (${indVar})</th>
          <th>사례 수 (N)</th>
          <th>평균 (Mean)</th>
          <th>표준편차 (Std Dev)</th>
          <th>평균의 표준오차 (SE)</th>
          <th>최소값</th>
          <th>최대값</th>
        </tr>
      `;

      let overallList = [];
      Object.keys(groups).sort().forEach(gName => {
        const arr = groups[gName];
        const desc = StatsHelper.calculateDescriptive(arr);
        if (desc) {
          const se = desc.stdDev / Math.sqrt(desc.n);
          const valLabel = getValLabel(indVar, gName);
          html += `
            <tr>
              <td><strong>${valLabel}</strong></td>
              <td>${desc.n}명</td>
              <td>${desc.mean.toFixed(3)}</td>
              <td>${desc.stdDev.toFixed(3)}</td>
              <td>${se.toFixed(4)}</td>
              <td>${desc.min}</td>
              <td>${desc.max}</td>
            </tr>
          `;
          overallList = overallList.concat(arr);
        }
      });

      const overall = StatsHelper.calculateDescriptive(overallList);
      if (overall) {
        const overallSe = overall.stdDev / Math.sqrt(overall.n);
        html += `
          <tr class="highlight-row">
            <td><strong>전체 합계</strong></td>
            <td>${overall.n}명</td>
            <td>${overall.mean.toFixed(3)}</td>
            <td>${overall.stdDev.toFixed(3)}</td>
            <td>${overallSe.toFixed(4)}</td>
            <td>${overall.min}</td>
            <td>${overall.max}</td>
          </tr>
        `;
      }

      descTable.innerHTML = html;
      if (chartType === "auto") chartType = "bar"; // 평균비교 바 차트로 강제유도
      renderDescMeanComparisonInterpretation(depVar, indVar, groups);

    } else if (type1 === "continuous" && type2 === "continuous") {
      // 2) 둘 다 수치형: 각 변수 기본 기술통계 나열
      const stats1 = StatsHelper.calculateDescriptive(data1);
      const stats2 = StatsHelper.calculateDescriptive(data2);

      descTable.innerHTML = `
        <tr><th>기술 통계량</th><th>${var1} 변수값</th><th>${var2} 변수값</th></tr>
        <tr><td><strong>표본 크기 (N)</strong></td><td>${stats1 ? stats1.n : 0}명</td><td>${stats2 ? stats2.n : 0}명</td></tr>
        <tr><td><strong>평균 (Mean)</strong></td><td>${stats1 ? stats1.mean.toFixed(3) : 0}</td><td>${stats2 ? stats2.mean.toFixed(3) : 0}</td></tr>
        <tr><td><strong>표준편차 (Std Dev)</strong></td><td>${stats1 ? stats1.stdDev.toFixed(3) : 0}</td><td>${stats2 ? stats2.stdDev.toFixed(3) : 0}</td></tr>
        <tr><td><strong>최소값 / 최대값</strong></td><td>${stats1 ? stats1.min + " / " + stats1.max : 0}</td><td>${stats2 ? stats2.min + " / " + stats2.max : 0}</td></tr>
      `;

      if (chartType === "auto") chartType = "scatter";
      renderDescBivariateContinuousInterpretation(var1, var2);

    } else {
      // 3) 둘 다 범주형: 기존 빈도 교차표 (Cross Tab)
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
      
      // 하단 합계행
      html += `<tr class="highlight-row"><td><strong>합계</strong></td>`;
      cross.cols.forEach(c => {
        html += `<td><strong>${cross.colTotals[c]}명</strong></td>`;
      });
      html += `<td><strong>${cross.n}명</strong></td></tr>`;
      descTable.innerHTML = html;
      
      if (chartType === "auto") chartType = "grouped-bar";
      renderDescInterpretation(var1, var2);
    }
  }

  // 2. 그래프 그리기
  drawDescriptiveChart(var1, var2, chartType);
}

function drawDescriptiveChart(var1, var2, chartType) {
  const ctx = document.getElementById("desc-chart");
  const stemLeaf = document.getElementById("stem-leaf-display");
  
  // 이전 차트 인스턴스 소멸
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

  // 차트 테마 컬러
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

  // 수치형 x 범주형 집단별 평균비교 차트 렌더링 분기
  if (var2) {
    const type1 = AppState.colTypes[var1];
    const type2 = AppState.colTypes[var2];
    const is1Num2Cat = (type1 === "continuous" && (type2 === "categorical" || type2 === "likert"));
    const is1Cat2Num = ((type1 === "categorical" || type1 === "likert") && type2 === "continuous");

    if (is1Num2Cat || is1Cat2Num) {
      const depVar = is1Num2Cat ? var1 : var2;
      const indVar = is1Num2Cat ? var2 : var1;

      const groups = {};
      AppState.data.forEach(row => {
        if (isMissingValue(depVar, row[depVar]) || isMissingValue(indVar, row[indVar])) return;
        const gVal = String(row[indVar]).trim();
        const numVal = parseFloat(row[depVar]);
        if (!isNaN(numVal)) {
          if (!groups[gVal]) groups[gVal] = [];
          groups[gVal].push(numVal);
        }
      });

      const groupNames = Object.keys(groups).sort();
      const groupMeans = groupNames.map(gName => {
        const arr = groups[gName];
        return arr.reduce((a, b) => a + b, 0) / arr.length;
      });
      const groupLabels = groupNames.map(gName => getValLabel(indVar, gName));

      const useChartType = (chartType === "bar" || chartType === "line") ? chartType : "bar";

      AppState.chartInstance = new Chart(ctx, {
        type: useChartType,
        data: {
          labels: groupLabels,
          datasets: [{
            label: `${depVar} 평균`,
            data: groupMeans,
            backgroundColor: palette.slice(0, groupLabels.length),
            borderColor: "var(--primary)",
            borderWidth: useChartType === "line" ? 2.5 : 0,
            fill: useChartType === "line" ? false : true,
            tension: 0.15
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: `${indVar} 집단별 ${depVar} 평균 비교`, color: textColor }
          },
          scales: {
            x: { title: { display: true, text: indVar, color: textColor }, grid: { display: false }, ticks: { color: textColor } },
            y: { title: { display: true, text: `평균 (${depVar})`, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
          }
        }
      });
      return;
    }
  }

  if (chartType === "histogram") {
    // 히스토그램 연산 (Sturges Rule로 bin 수 결정)
    const stats = StatsHelper.calculateDescriptive(data1);
    if (!stats) return;

    const numBins = Math.ceil(Math.log2(stats.n) + 1);
    const binWidth = stats.range / numBins;
    // 정규곡선 꼬리가 바닥(y=0)에 부드럽게 닿도록 앞뒤로 1개씩 가상 빈(padding)을 추가합니다.
    const extendedNumBins = numBins + 2;
    const bins = Array(extendedNumBins).fill(0);
    const binLabels = [];

    // 가상 시작 빈
    const paddingStart = stats.min - binWidth;
    const paddingEnd = stats.min;
    binLabels.push(`${paddingStart.toFixed(1)}~${paddingEnd.toFixed(1)}`);

    // 실제 데이터 빈들
    for (let i = 0; i < numBins; i++) {
      const start = stats.min + i * binWidth;
      const end = start + binWidth;
      binLabels.push(`${start.toFixed(1)}~${end.toFixed(1)}`);
    }

    // 가상 끝 빈
    const paddingLastStart = stats.max;
    const paddingLastEnd = stats.max + binWidth;
    binLabels.push(`${paddingLastStart.toFixed(1)}~${paddingLastEnd.toFixed(1)}`);

    // 실제 데이터 매핑 (가상 시작 빈 추가에 따라 idx + 1)
    data1.forEach(v => {
      let idx = Math.floor((v - stats.min) / binWidth) + 1;
      if (idx >= extendedNumBins - 1) idx = extendedNumBins - 2;
      if (idx >= 1) bins[idx]++;
    });

    // 정규곡선 계산 (전체 extendedNumBins에 대해 조밀한 PDF 값 산출)
    const normalCurveData = [];
    const mean = stats.mean;
    const stdDev = stats.stdDev;
    for (let i = 0; i < extendedNumBins; i++) {
      const mid = (stats.min - binWidth) + (i + 0.5) * binWidth;
      let pdfVal = 0;
      if (stdDev > 0) {
        pdfVal = jStat.normal.pdf(mid, mean, stdDev);
      }
      normalCurveData.push(pdfVal * stats.n * binWidth);
    }

    AppState.chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: binLabels,
        datasets: [
          {
            label: `${var1} 빈도`,
            data: bins,
            backgroundColor: primaryColor,
            borderColor: "var(--primary)",
            borderWidth: 1,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            order: 2
          },
          {
            label: "정규곡선 (Normal Curve)",
            data: normalCurveData,
            type: "line",
            borderColor: "rgba(255, 77, 79, 0.8)",
            borderWidth: 2,
            pointRadius: 0, // SPSS 표준 스타일 준수: 곡선의 점 표시 제거
            fill: false,
            tension: 0.4,
            order: 1,
            clip: false // 차트 좌측 경계선 부근에서 곡선이 잘리지 않도록 비활성화
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, labels: { color: textColor } },
          title: { display: true, text: `${var1}의 도수분포 히스토그램 (정규곡선 포함)`, color: textColor }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
        }
      }
    });

  } else if (chartType === "boxplot") {
    // Chart.js에서 boxplot은 Canvas 드로잉으로 우회 (신뢰성 100%)
    ctx.classList.add("hidden");
    stemLeaf.classList.remove("hidden");
    
    const stats = StatsHelper.calculateDescriptive(data1);
    if (!stats) return;

    // Canvas 생성해서 stemLeaf 박스 안에 박스플롯 직접 렌더링
    stemLeaf.innerHTML = `<div style="text-align:center;font-weight:600;margin-bottom:8px;">${var1}의 상자그림 (Box Plot)</div><canvas id="custom-box-canvas" width="450" height="180"></canvas>`;
    const cvs = document.getElementById("custom-box-canvas");
    const c = cvs.getContext("2d");

    // 축 매핑 연산
    const padding = 40;
    const w = cvs.width - padding * 2;
    const h = cvs.height;
    
    const scale = (val) => padding + ((val - stats.min) / (stats.range || 1)) * w;

    c.clearRect(0,0,cvs.width,cvs.height);

    // 축 그리기
    c.strokeStyle = isDark ? "#555" : "#ccc";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(padding, h - 40);
    c.lineTo(cvs.width - padding, h - 40);
    c.stroke();

    // 눈금 눈금
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

    // 수염(Whisker) 그리기
    c.beginPath();
    c.moveTo(minX, boxY + boxH/2);
    c.lineTo(q1X, boxY + boxH/2);
    c.moveTo(q3X, boxY + boxH/2);
    c.lineTo(maxX, boxY + boxH/2);
    // 양 끝 가로선
    c.moveTo(minX, boxY + 15);
    c.lineTo(minX, boxY + boxH - 15);
    c.moveTo(maxX, boxY + 15);
    c.lineTo(maxX, boxY + boxH - 15);
    c.stroke();

    // 상자 그리기
    c.fillStyle = isDark ? "rgba(114, 46, 209, 0.4)" : "rgba(114, 46, 209, 0.15)";
    c.fillRect(q1X, boxY, q3X - q1X, boxH);
    c.strokeStyle = "var(--primary)";
    c.lineWidth = 2;
    c.strokeRect(q1X, boxY, q3X - q1X, boxH);

    // 중앙값 선 그리기
    c.strokeStyle = "var(--danger)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(medX, boxY);
    c.lineTo(medX, boxY + boxH);
    c.stroke();

    // 이상치 점 그리기
    stats.outliers.forEach(outVal => {
      const outX = scale(outVal);
      c.fillStyle = "var(--danger)";
      c.beginPath();
      c.arc(outX, boxY + boxH/2, 5, 0, Math.PI * 2);
      c.fill();
    });

  } else if (chartType === "freq-polygon") {
    // 도수분포다각형 (Frequency Polygon)
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

    // 정석 도수분포다각형을 위해 양 끝에 빈도 0인 구간 추가
    const polygonLabels = [];
    const polygonData = [];
    
    // 왼쪽 끝 도수 0
    const startLeft = stats.min - binWidth;
    const endLeft = stats.min;
    polygonLabels.push(`${startLeft.toFixed(1)}~${endLeft.toFixed(1)}`);
    polygonData.push(0);
    
    // 원래 구간들
    for (let i = 0; i < numBins; i++) {
      const start = stats.min + i * binWidth;
      const end = start + binWidth;
      polygonLabels.push(`${start.toFixed(1)}~${end.toFixed(1)}`);
      polygonData.push(bins[i]);
    }
    
    // 오른쪽 끝 도수 0
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
    // 그룹형 / 누적 막대 그래프 (이변량 범주형 데이터 비교)
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
    // 빈도 꺾은선 그래프
    const freqs = StatsHelper.calculateFrequency(data1);
    const labels = freqs.list.map(l => getValLabel(var1, l.value));
    const values = freqs.list.map(l => l.count);

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
    // 빈도 막대 그래프
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
    // 비율 파이 차트
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
    // 산점도 (두 수치형 변수 필요)
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
    // 줄기-잎 그림 (Stem-and-Leaf Plot)
    ctx.classList.add("hidden");
    stemLeaf.classList.remove("hidden");

    // 줄기-잎 알고리즘
    // 연속형 수치를 소수점 첫째자리까지 버림하고, 십의자리(줄기)와 일의자리(잎)로 구분
    const numericVals = data1.map(v => parseFloat(v)).filter(v => !isNaN(v)).sort((a,b)=>a-b);
    const stemLeafMap = {};
    
    numericVals.forEach(v => {
      // 10으로 나눈 목(줄기)과 나머지(잎)
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

  // 다운로드 이미지 바인딩
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

function renderDescMeanComparisonInterpretation(depVar, indVar, groups) {
  const box = document.getElementById("desc-korean-interpretation");
  
  const groupNames = Object.keys(groups).sort();
  const summaryParts = groupNames.map(gName => {
    const arr = groups[gName];
    const avg = arr.reduce((a,b)=>a+b, 0) / arr.length;
    return `<strong>'${getValLabel(indVar, gName)}'</strong> 집단(평균 ${avg.toFixed(2)})`;
  });

  box.innerHTML = `
    <p>집단 변수 <strong>'${indVar}'</strong>의 하위 범주에 따른 분석 변수 <strong>'${depVar}'</strong>의 평균값을 교차 비교한 집단별 기술통계 결과입니다.</p>
    <p>기술통계 분석 결과: ${summaryParts.join(", ")} 등으로 나타났습니다.</p>
    <p>이러한 집단 간 평균값 격차가 오차 범위 내의 우연한 차이인지, 혹은 모집단에서도 실재하는 유의미한 차이인지 검정하려면 **3단계 추론통계 분석의 '독립표본 t-검정(집단 2개)'** 또는 **'일원분산분석(ANOVA, 집단 3개 이상)'**을 실행해 보십시오.</p>
  `;
}

function renderDescBivariateContinuousInterpretation(var1, var2) {
  const box = document.getElementById("desc-korean-interpretation");
  box.innerHTML = `
    <p>두 연속형(수치) 변수인 <strong>'${var1}'</strong>와 <strong>'${var2}'</strong>를 연계하여 나란히 기술통계를 분석한 결과입니다.</p>
    <p>각각의 표본 평균 및 표준편차 등의 변동 특성을 비교해 볼 수 있으며, 우측의 산점도 그래프를 통해 두 요인이 직선 비례하거나 반비례하는 선형적 관계 패턴을 직관적으로 가늠해볼 수 있습니다.</p>
    <p>두 수치형 요인의 관계 강도와 방향을 수학적으로 입증하려면 **3단계 추론통계 분석의 '피어슨 상관분석'** 또는 **'단순선형회귀분석'**을 통해 가설을 검정해보십시오.</p>
  `;
}

// 추론통계 입력 폼 상태 저장 함수
function saveInferState() {
  const methodSelect = document.getElementById("infer-method");
  if (!methodSelect) return;

  AppState.inferState.method = methodSelect.value;

  const txtHypothesis = document.getElementById("txt-hypothesis");
  if (txtHypothesis) {
    AppState.hypothesis = txtHypothesis.value;
  }

  const container = document.getElementById("infer-variables-container");
  if (container) {
    // 모든 select 값 저장
    const selects = container.querySelectorAll("select");
    selects.forEach(sel => {
      AppState.inferState.variables[sel.id] = sel.value;
    });

    // 모든 input(number 등) 값 저장
    const inputs = container.querySelectorAll("input[type='number']");
    inputs.forEach(inp => {
      AppState.inferState.variables[inp.id] = inp.value;
    });

    // 모든 checkbox 값 저장
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(chk => {
      if (chk.name === "infer-multireg-x") {
        if (!AppState.inferState.checkedOptions[chk.name]) {
          AppState.inferState.checkedOptions[chk.name] = [];
        }
        if (chk.checked) {
          if (!AppState.inferState.checkedOptions[chk.name].includes(chk.value)) {
            AppState.inferState.checkedOptions[chk.name].push(chk.value);
          }
        } else {
          AppState.inferState.checkedOptions[chk.name] = AppState.inferState.checkedOptions[chk.name].filter(v => v !== chk.value);
        }
      } else {
        AppState.inferState.checkedOptions[chk.id] = chk.checked;
      }
    });
  }
}

// 추론통계 입력 폼 상태 복원 함수
function restoreInferState() {
  const methodSelect = document.getElementById("infer-method");
  if (methodSelect && AppState.inferState.method) {
    methodSelect.value = AppState.inferState.method;
  }

  const txtHypothesis = document.getElementById("txt-hypothesis");
  if (txtHypothesis && AppState.hypothesis !== undefined) {
    txtHypothesis.value = AppState.hypothesis;
  }

  const container = document.getElementById("infer-variables-container");
  if (container) {
    // select 복원
    const selects = container.querySelectorAll("select");
    selects.forEach(sel => {
      const savedVal = AppState.inferState.variables[sel.id];
      if (savedVal !== undefined) {
        const optionExists = Array.from(sel.options).some(opt => opt.value === savedVal);
        if (optionExists) {
          sel.value = savedVal;
        }
      }
    });

    // input(number 등) 복원
    const inputs = container.querySelectorAll("input[type='number']");
    inputs.forEach(inp => {
      const savedVal = AppState.inferState.variables[inp.id];
      if (savedVal !== undefined) {
        inp.value = savedVal;
      }
    });

    // checkbox 복원
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(chk => {
      if (chk.name === "infer-multireg-x") {
        const savedVals = AppState.inferState.checkedOptions[chk.name];
        if (savedVals && savedVals.includes(chk.value)) {
          chk.checked = true;
        }
      } else {
        const savedVal = AppState.inferState.checkedOptions[chk.id];
        if (savedVal !== undefined) {
          chk.checked = savedVal;
        }
      }
    });
  }
}

// --- 추론통계 분석 화면 ---
function initInferLayout() {
  const methodSelect = document.getElementById("infer-method");
  
  if (methodSelect) {
    methodSelect.addEventListener("change", () => {
      AppState.inferState.variables = {};
      AppState.inferState.checkedOptions = {};
      saveInferState();
      updateInferMethodOptions();
    });
  }
  
  const runBtn = document.getElementById("btn-run-infer");
  if (runBtn) {
    runBtn.onclick = runInferentialAnalysis;
  }

  const txtHypothesis = document.getElementById("txt-hypothesis");
  if (txtHypothesis) {
    txtHypothesis.addEventListener("input", saveInferState);
  }

  const container = document.getElementById("infer-variables-container");
  if (container) {
    container.addEventListener("change", saveInferState);
    container.addEventListener("input", saveInferState);
  }
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
      
    case "one-sample-t":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var">분석할 수치형 변수:</label>
          <select id="infer-select-var" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-test-value">검정 기준값 (Test Value):</label>
          <input type="number" id="infer-test-value" class="form-control mt-1" value="0" step="any">
          <p class="input-tip mt-1">예: 표본 평균과 비교할 기준 모평균 수치(예: 전국 평균 등)를 작성해주세요.</p>
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
        <div class="form-group mt-3">
          <label><input type="checkbox" id="infer-chk-equalvar" checked> 등분산성 가정 적용</label>
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
      
    case "multireg":
      let xCheckboxes = "";
      AppState.headers.forEach(h => {
        if (AppState.colTypes[h] === "continuous" || AppState.colTypes[h] === "likert") {
          xCheckboxes += `
            <div style="margin-bottom: 6px;">
              <label style="font-weight:normal; cursor:pointer; display:flex; align-items:center; gap:6px;">
                <input type="checkbox" name="infer-multireg-x" value="${h}"> <span>${h}</span>
              </label>
            </div>
          `;
        }
      });
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var2">결과가 되는 종속변수 (Y, 수치형):</label>
          <select id="infer-select-var2" class="form-control mt-1">${numOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label style="font-weight:600;">원인이 되는 독립변수 선택 (X, 수치형, 복수 선택):</label>
          <div class="checkbox-list-container" style="max-height: 150px; overflow-y: auto; padding: 10px; border: 1px solid var(--border-glass); border-radius: var(--radius-sm); margin-top: 6px; background-color: var(--bg-card);">
            ${xCheckboxes || "<p style='font-size:11px;color:var(--text-muted);'>선택 가능한 수치형 변수가 없습니다.</p>"}
          </div>
          <p class="input-tip mt-1">예측에 영향을 미치는 독립변수를 2개 이상 선택할 수 있습니다.</p>
        </div>
      `;
      break;
      
    case "chisq-ind":
      container.innerHTML = `
        <div class="form-group">
          <label for="infer-select-var1">교차할 첫 번째 범주 변수 (행):</label>
          <select id="infer-select-var1" class="form-control mt-1">${catOptionsHTML}</select>
        </div>
        <div class="form-group mt-3">
          <label for="infer-select-var2">교차할 두 번째 범주 변수 (열):</label>
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

  // 저장된 이전의 폼 값과 가설 복원
  restoreInferState();
}
}

function runInferentialAnalysis() {
  const method = document.getElementById("infer-method").value;
  const hypothesis = document.getElementById("txt-hypothesis").value.trim();

  // 가설 오용 방지 검증
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

  // 가설 제목 패널 갱신
  document.getElementById("display-hypothesis").textContent = `"${hypothesis}"`;

  // 기본 차트/사후검정 초기화 숨김
  document.getElementById("anova-posthoc-card").classList.add("hidden");
  document.getElementById("infer-chart-card").classList.add("hidden");

  // 분석 실행 호출 분기
  switch(method) {
    case "ci":
      runCIAnalysis();
      break;
    case "one-sample-t":
      runOneSampleTTestAnalysis();
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
    case "chisq-ind":
      runChiSquareIndAnalysis();
      break;
    case "correlation":
      runCorrelationAnalysis();
      break;
    case "regression":
      runRegressionAnalysis();
      break;
    case "multireg":
      runMultipleRegressionAnalysis();
      break;
  }
}

// 2) 일표본 t-검정 실행
function runOneSampleTTestAnalysis() {
  const varName = document.getElementById("infer-select-var").value;
  const testValue = parseFloat(document.getElementById("infer-test-value").value);
  
  if (isNaN(testValue)) {
    alert("검정 기준값을 올바른 숫자로 입력해주세요.");
    return;
  }

  const data = AppState.data.map(r => r[varName]).filter(v => !isMissingValue(varName, v));
  const numericData = data.map(v => parseFloat(v)).filter(v => !isNaN(v));

  if (numericData.length < 2) {
    alert("일표본 t-검정을 수행하려면 최소 2개 이상의 유효한 데이터가 필요합니다.");
    return;
  }

  // 1. 가정 점검 (정규성)
  const normCheck = StatsHelper.checkNormality(numericData);
  renderAssumptionDashboard([normCheck]);

  // 2. 연산
  const result = StatsHelper.oneSampleTTest(numericData, testValue);
  if (result.error) {
    alert(result.error);
    return;
  }

  // 3. 표 렌더링
  const table = document.getElementById("infer-result-table");
  const sig = result.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  table.innerHTML = `
    <tr><th colspan="5">1. 일표본 통계량 (기술통계)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.03);">
              <th style="border:1px solid var(--border-glass); padding:8px;">변수명</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">N</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균 (Mean)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준편차 (Std Dev)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균의 표준오차 (SE)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${varName}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${result.n}명</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${result.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${result.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${result.se.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <tr><td colspan="5" style="padding-top:10px; border:none;"></td></tr>
    <tr><th colspan="5" style="padding-top:20px;">2. 일표본 검정 결과 상세 (SPSS 표준 양식)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th rowspan="2" style="border:1px solid var(--border-glass); padding:8px; text-align:center; vertical-align:middle;">변수명</th>
              <th colspan="4" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">검정값 = ${testValue}</th>
            </tr>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">t</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">자유도 (df)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">유의확률 (양측)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균 차이</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${varName}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold;">${result.tValue.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${result.df}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${result.pValue < 0.05 ? 'var(--primary)' : 'inherit'}; font-weight:bold;">${result.pValue.toFixed(4)}<br><span style="font-size:9px;font-weight:normal;">(${sig})</span></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${result.diff.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
    
    <tr><td colspan="5" style="padding-top:10px; border:none;"></td></tr>
    <tr><td><strong>차이의 95% 신뢰구간</strong></td><td colspan="4">[ ${result.ciLower.toFixed(3)} ~ ${result.ciUpper.toFixed(3)} ]</td></tr>
    <tr><td><strong>효과크기 (Cohen's d)</strong></td><td colspan="4"><strong>${result.cohensD.toFixed(3)}</strong> (0.2: 작음, 0.5: 중간, 0.8: 큼)</td></tr>
  `;

  // 4. 한국어 해석
  const isSig = result.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  let effectLabel = "매우 작음";
  if (result.cohensD >= 0.8) effectLabel = "큰 효과 크기(실제적으로 강한 차이)";
  else if (result.cohensD >= 0.5) effectLabel = "중간 효과 크기";
  else if (result.cohensD >= 0.2) effectLabel = "작은 효과 크기";

  interpretation.innerHTML = `
    <p>수집된 표본 변수 <strong>'${varName}'</strong>의 평균(M = ${result.mean.toFixed(2)})이 기준치 <strong>${testValue}</strong>(와)과 통계적으로 유의미한 격차가 있는지 일표본 t-검정(One-sample t-test)을 실시했습니다.</p>
    <p>분석 결과, 표본 평균과 기준값의 차이는 <strong>${result.diff.toFixed(2)}</strong>로 나타났으며, 이 차이는 통계적으로 <strong>${isSig ? "유의미합니다" : "유의미하지 않습니다"}</strong> (t = ${result.tValue.toFixed(2)}, df = ${result.df}, p = ${result.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 우연에 의해 이러한 차이가 관측되었을 확률이 5% 미만이므로, 표본 집단의 실제 평균은 기준값 ${testValue}와는 차이가 난다고 해석할 수 있습니다.` : `즉, 관측된 차이는 우연적 편차 범위 내이며, 표본 집단의 모평균이 기준치 ${testValue}와 다르다고 주장할 만한 근거가 충분하지 않습니다.`}</p>
    <p>차이의 실질적 크기를 나타내는 효과크기(Cohen's d)는 <strong>${result.cohensD.toFixed(2)}</strong>(${effectLabel}) 수준입니다.</p>
  `;

  // 5. 시각화 (Error Bar)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");

  // 오차막대를 위한 하한/상한 계산
  const tCrit = jStat.studentt.inv(0.975, result.df);
  const ciLowerVal = result.mean - tCrit * result.se;
  const ciUpperVal = result.mean + tCrit * result.se;

  drawErrorBarChart(
    "infer-chart",
    `표본 평균 vs 기준치 (${testValue}) 비교 오차막대`,
    [{ name: `${varName} (표본)`, mean: result.mean, lower: ciLowerVal, upper: ciUpperVal }],
    { value: testValue, label: "검정 기준치" }
  );

  // 6. 경고판
  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--info-light)";
  alertBox.style.color = "var(--info)";
  alertBox.style.borderColor = "var(--info)";
  alertTxt.textContent = "안내: 일표본 t-검정은 표본이 모집단을 대표할 수 있는 임의성(무작위 표집)을 가질 때만 결과 해석의 일반화 타당성을 보증받을 수 있습니다.";
}

// 1) 신뢰구간 분석 실행
function runCIAnalysis() {
  const varName = document.getElementById("infer-select-var").value;
  const level = parseFloat(document.getElementById("infer-select-level").value);
  const data = AppState.data.map(r => r[varName]).filter(v => v !== "");

  // 1. 가정 점검
  const normCheck = StatsHelper.checkNormality(data);
  renderAssumptionDashboard([normCheck]);

  // 2. 연산
  const ci = StatsHelper.estimateConfidenceInterval(data, level);
  if (!ci) return;

  const stats = StatsHelper.calculateDescriptive(data);

  // 3. 표 렌더링
  const table = document.getElementById("infer-result-table");
  table.innerHTML = `
    <tr><th>통계 지표</th><th>결과값</th><th>설명</th></tr>
    <tr><td><strong>표본 크기 (N)</strong></td><td>${ci.n}명</td><td>유효 데이터 총 개수</td></tr>
    <tr><td><strong>표본 평균</strong></td><td>${ci.mean.toFixed(3)}</td><td>집단의 평균 측정치</td></tr>
    <tr><td><strong>표준편차 (S)</strong></td><td>${ci.stdDev.toFixed(3)}</td><td>흩어진 정도</td></tr>
    <tr><td><strong>표준오차 (SE)</strong></td><td>${ci.se.toFixed(4)}</td><td>표본평균이 모평균에서 얼마나 벗어나는지 추정오차</td></tr>
    <tr><td><strong>최소값 / 최대값</strong></td><td>${stats.min} / ${stats.max}</td><td>수집된 데이터의 범위</td></tr>
    <tr><td><strong>분포 종류</strong></td><td>${ci.distribution}</td><td>신뢰구간 도출용 임계값 분포</td></tr>
    <tr><td><strong>신뢰 한계선 (오차한계)</strong></td><td>±${ci.marginOfError.toFixed(4)}</td><td>평균에서 앞뒤로 멀어질 신뢰 구간 한계폭</td></tr>
    <tr class="highlight-row"><td><strong>${level*100}% 신뢰구간</strong></td><td>[${ci.lower.toFixed(3)} ~ ${ci.upper.toFixed(3)}]</td><td>모평균이 이 구간 내에 있을 확률이 ${level*100}%임</td></tr>
  `;

  // 4. 한국어 해석
  const interpretation = document.getElementById("infer-korean-interpretation");
  interpretation.innerHTML = `
    <p>분석 대상 변수 <strong>'${varName}'</strong>의 모평균을 추정한 결과, 수집한 표본 ${ci.n}명을 기준으로 <strong>${level*100}% 신뢰구간은 [${ci.lower.toFixed(2)} ~ ${ci.upper.toFixed(2)}]</strong>입니다.</p>
    <p>이는 만약 동일한 조사를 무한히 반복했을 때, 도출된 구간들 중 <strong>${level*100}%</strong>가 실제 모집단의 평균을 포함하고 있음을 뜻합니다.</p>
  `;

  // 5. 시각화 (Error Bar)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");
  drawErrorBarChart(
    "infer-chart",
    `${varName}의 ${level*100}% 신뢰구간 추정 오차막대`,
    [{ name: `${varName} (표본)`, mean: ci.mean, lower: ci.lower, upper: ci.upper }]
  );

  // 6. 경고판
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
      return; // 결측값 행 제외
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
  
  // 3개 집단 이상인 경우 t-검정 오용 경고 및 ANOVA 유도 (핵심 오용 방지 장치)
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
      return; // 결측값 행 제외
    }
    const v = parseFloat(row[varName]);
    const grp = String(row[groupVar]).trim();
    if (!isNaN(v)) {
      if (grp === gA) dataA.push(v);
      if (grp === gB) dataB.push(v);
    }
  });

  // 1. 가정 점검
  const normA = StatsHelper.checkNormality(dataA);
  const normB = StatsHelper.checkNormality(dataB);
  const homos = StatsHelper.checkHomoscedasticity([dataA, dataB]);

  // 커스텀 리포트
  normA.reason = `'${getValLabel(groupVar, gA)}' 집단의 정규성: ` + normA.reason;
  normB.reason = `'${getValLabel(groupVar, gB)}' 집단의 정규성: ` + normB.reason;
  renderAssumptionDashboard([normA, normB, homos]);

  // 2. 검정 연산
  const tResult = StatsHelper.independentTTest(dataA, dataB);
  if (tResult.error) {
    alert(tResult.error);
    return;
  }

  // 3. 결과 요약표
  const table = document.getElementById("infer-result-table");
  
  // 등분산 판정에 따른 가이드 텍스트 (르빈 검정 기반)
  const passed = tResult.homoscedasticity.passed;
  const leveneF = tResult.homoscedasticity.fValue;
  const leveneP = tResult.homoscedasticity.pValue;

  const suggestionText = passed
    ? `<span style="color:var(--success);font-weight:bold;"><i class="fa-solid fa-circle-check"></i> [등분산성 충족 - 등분산 가정됨 채택]</span> 르빈의 등분산 검정 유의확률 p = ${leveneP.toFixed(4)} (≥ 0.05)로 분산의 차이가 유의하지 않습니다. 아래 테이블에서 <strong>'등분산 가정됨'</strong> 행의 t-검정 결과를 보고하십시오.`
    : `<span style="color:var(--danger);font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> [등분산성 위배 의심 - 등분산 가정안됨 채택]</span> 르빈의 등분산 검정 유의확률 p = ${leveneP.toFixed(4)} (< 0.05)로 분산의 유의한 차이가 발견되었습니다. 아래 테이블에서 <strong>'등분산 가정되지 않음(Welch t-검정)'</strong> 행의 결과를 보고하십시오.`;

  const eqSig = tResult.equalVariance.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";
  const uneqSig = tResult.unequalVariance.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";
  
  table.innerHTML = `
    <tr><th colspan="6">1. 집단통계량 (기술통계)</th></tr>
    <tr>
      <td colspan="6" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.03);">
              <th style="border:1px solid var(--border-glass); padding:8px;">집단 구분 (${groupVar})</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">N</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균 (Mean)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준편차 (Std Dev)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균의 표준오차 (SE)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${getValLabel(groupVar, gA)}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.groupAInfo.n}명</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.groupAInfo.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.groupAInfo.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${(tResult.groupAInfo.stdDev / Math.sqrt(tResult.groupAInfo.n)).toFixed(4)}</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${getValLabel(groupVar, gB)}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.groupBInfo.n}명</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.groupBInfo.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.groupBInfo.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${(tResult.groupBInfo.stdDev / Math.sqrt(tResult.groupBInfo.n)).toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <tr><td colspan="6" style="padding-top:10px; border:none;"></td></tr>
    <tr><td colspan="6" style="background-color:var(--bg-card); font-size:12px; padding:10px 14px; border-radius: var(--radius-sm); border:1px solid var(--border-glass);">${suggestionText}</td></tr>
    
    <tr><th colspan="6" style="padding-top:20px;">2. 독립표본 t-검정 결과 상세 (SPSS 표준 양식)</th></tr>
    <tr>
      <td colspan="6" style="padding:0; border:none;">
        <div class="table-scroll-container" style="margin:0;">
          <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
            <thead>
              <tr style="background-color:rgba(114, 46, 209, 0.05);">
                <th rowspan="2" style="border:1px solid var(--border-glass); padding:8px; text-align:center; vertical-align:middle;">가정 구분</th>
                <th colspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">르빈의 등분산 검정</th>
                <th colspan="3" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균의 동일성 t-검정</th>
                <th rowspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">평균 차이</th>
                <th colspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">차이의 95% 신뢰구간</th>
              </tr>
              <tr style="background-color:rgba(114, 46, 209, 0.05);">
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">F</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">유의확률 (Sig.)</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">t</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">df (자유도)</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">유의확률 (양측)</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">하한</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">상한</th>
              </tr>
            </thead>
            <tbody>
              <tr style="${passed ? 'background-color:rgba(56, 158, 13, 0.08); font-weight:600;' : ''}">
                <td style="border:1px solid var(--border-glass); padding:8px;"><strong>등분산 가정됨</strong></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;" rowspan="2"><strong>${leveneF.toFixed(3)}</strong></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;" rowspan="2"><strong style="color:${!passed ? 'var(--danger)' : 'inherit'};">${leveneP.toFixed(4)}</strong></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.tValue.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.df.toFixed(2)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${tResult.equalVariance.pValue < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${tResult.equalVariance.pValue.toFixed(4)}</strong><br><span style="font-size:9px;font-weight:normal;">(${eqSig})</span></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.diff.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.ciLower.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.equalVariance.ciUpper.toFixed(3)}</td>
              </tr>
              <tr style="${!passed ? 'background-color:rgba(207, 19, 34, 0.08); font-weight:600;' : ''}">
                <td style="border:1px solid var(--border-glass); padding:8px;"><strong>등분산 가정되지 않음</strong></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.tValue.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.df.toFixed(2)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${tResult.unequalVariance.pValue < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${tResult.unequalVariance.pValue.toFixed(4)}</strong><br><span style="font-size:9px;font-weight:normal;">(${uneqSig})</span></td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.diff.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.ciLower.toFixed(3)}</td>
                <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.unequalVariance.ciUpper.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
    
    <tr><td colspan="6" style="padding-top:10px; border:none;"></td></tr>
    <tr><td><strong>효과크기 (Cohen's d)</strong></td><td colspan="5"><strong>${tResult.cohensD.toFixed(3)}</strong> (0.2: 작음, 0.5: 중간, 0.8: 큼)</td></tr>
  `;

  // 4. 한국어 해석
  const activeResult = passed ? tResult.equalVariance : tResult.unequalVariance;
  const isSig = activeResult.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  let effectLabel = "매우 작음";
  if (tResult.cohensD >= 0.8) effectLabel = "큰 효과 크기(의미 있는 실제적 차이)";
  else if (tResult.cohensD >= 0.5) effectLabel = "중간 효과 크기";
  else if (tResult.cohensD >= 0.2) effectLabel = "작은 효과 크기";

  interpretation.innerHTML = `
    <p><strong>'${groupVar}'</strong>에 속한 두 집단(${getValLabel(groupVar, gA)} vs ${getValLabel(groupVar, gB)}) 간에 <strong>'${varName}'</strong>의 평균에 유의미한 차이가 있는지 독립표본 t-검정을 실시하였습니다.</p>
    <p>르빈의 등분산 검정 결과(F = ${leveneF.toFixed(3)}, p = ${leveneP.toFixed(4)})에 의거하여, 통계적으로 <strong>'${passed ? "등분산 가정됨" : "등분산 가정되지 않음(Welch의 t-검정)"}'</strong> 행의 결과를 인용 채택합니다.</p>
    <p>분석 결과, 두 집단의 평균값 차이는 <strong>${tResult.diff.toFixed(2)}</strong>이며, 이 차이는 통계적으로 <strong>${isSig ? "유의미합니다" : "유의미하지 않습니다"}</strong> (t = ${activeResult.tValue.toFixed(2)}, df = ${activeResult.df.toFixed(2)}, p = ${activeResult.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 우연히 이러한 차이가 관측될 확률이 5% 미만이므로, 두 집단 간에는 실제 평균 점수 차이가 존재한다고 결론 내릴 수 있습니다.` : `즉, 우연한 요인으로 발생할 수 있는 수준의 미미한 차이이므로, 두 집단 간에는 실제 평균적인 차이가 없다고 해석합니다.`}</p>
    <p>추가로 분석된 두 집단 차이의 실질적인 크기(효과크기, Cohen's d)는 <strong>${tResult.cohensD.toFixed(2)}</strong>로, <strong>${effectLabel}</strong>에 해당합니다.</p>
  `;

  // 5. 시각화 (Error Bar)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");

  const seA = tResult.groupAInfo.stdDev / Math.sqrt(tResult.groupAInfo.n);
  const seB = tResult.groupBInfo.stdDev / Math.sqrt(tResult.groupBInfo.n);
  const tCritA = jStat.studentt.inv(0.975, tResult.groupAInfo.n - 1);
  const tCritB = jStat.studentt.inv(0.975, tResult.groupBInfo.n - 1);

  drawErrorBarChart(
    "infer-chart",
    `집단별 95% 신뢰구간 비교 오차막대 (${varName})`,
    [
      { name: getValLabel(groupVar, gA), mean: tResult.groupAInfo.mean, lower: tResult.groupAInfo.mean - tCritA * seA, upper: tResult.groupAInfo.mean + tCritA * seA },
      { name: getValLabel(groupVar, gB), mean: tResult.groupBInfo.mean, lower: tResult.groupBInfo.mean - tCritB * seB, upper: tResult.groupBInfo.mean + tCritB * seB }
    ]
  );

  // 6. 경고판
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
      return; // 결측값 행 제외
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

  // 1. 가정 점검
  const diffs = dataPost.map((v, i) => v - dataPre[i]);
  const normDiff = StatsHelper.checkNormality(diffs);
  normDiff.reason = "사전-사후 차이값의 정규성: " + normDiff.reason;
  renderAssumptionDashboard([normDiff]);

  // 2. 검정 연산
  const tResult = StatsHelper.pairedTTest(dataPre, dataPost);
  if (tResult.error) {
    alert(tResult.error);
    return;
  }

  // 3. 결과 요약표
  const table = document.getElementById("infer-result-table");
  const sig = tResult.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  const statsPre = StatsHelper.calculateDescriptive(dataPre);
  const statsPost = StatsHelper.calculateDescriptive(dataPost);

  table.innerHTML = `
    <tr><th colspan="5">1. 대응표본 통계량 (기술통계)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.03);">
              <th style="border:1px solid var(--border-glass); padding:8px;">대응 변수</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균 (Mean)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">사례 수 (N)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준편차 (Std Dev)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균의 표준오차 (SE)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">대응 1: <strong>${var1}</strong> (사전)</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${statsPre.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${statsPre.n}명</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${statsPre.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${(statsPre.stdDev / Math.sqrt(statsPre.n)).toFixed(4)}</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">대응 2: <strong>${var2}</strong> (사후)</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${statsPost.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${statsPost.n}명</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${statsPost.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">Whole${(statsPost.stdDev / Math.sqrt(statsPost.n)).toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <tr><td colspan="5" style="padding-top:10px; border:none;"></td></tr>
    <tr><th colspan="5" style="padding-top:20px;">2. 대응표본 상관관계 (Paired Samples Correlations)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.03);">
              <th style="border:1px solid var(--border-glass); padding:8px;">구분</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">사례 수 (N)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">상관계수 (Correlation)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">유의확률 (Sig. 양측)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">대응 1: <strong>${var1}</strong> & <strong>${var2}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tResult.n}명</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold;">${tResult.correlation.r.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${tResult.correlation.pValue < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${tResult.correlation.pValue.toFixed(4)}</strong></td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <tr><td colspan="5" style="padding-top:10px; border:none;"></td></tr>
    <tr><th colspan="5" style="padding-top:20px;">3. 대응표본 t-검정 결과 상세 (SPSS 표준 양식)</th></tr>
    <tr><td><strong>평균 차이 (사후 - 사전)</strong></td><td colspan="4">${tResult.meanDiff.toFixed(3)}</td></tr>
    <tr><td><strong>차이의 표준오차 (SE)</strong></td><td colspan="4">${tResult.seDiff.toFixed(4)}</td></tr>
    <tr><td><strong>t-통계량 (t)</strong></td><td colspan="4">${tResult.tValue.toFixed(3)} (자유도 df = ${tResult.df})</td></tr>
    <tr class="highlight-row"><td><strong>유의확률 (p-value, 양측)</strong></td><td colspan="4"><strong>${tResult.pValue.toFixed(4)}</strong> (${sig})</td></tr>
    <tr><td><strong>효과크기 (Cohen's dz)</strong></td><td colspan="4"><strong>${tResult.cohensD.toFixed(3)}</strong></td></tr>
    <tr><td><strong>차이의 95% 신뢰구간</strong></td><td colspan="4">[${tResult.ciLower.toFixed(3)} ~ ${tResult.ciUpper.toFixed(3)}]</td></tr>
  `;

  // 5. 시각화 (Error Bar)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");

  const sePre = statsPre.stdDev / Math.sqrt(statsPre.n);
  const sePost = statsPost.stdDev / Math.sqrt(statsPost.n);
  const tCritPre = jStat.studentt.inv(0.975, statsPre.n - 1);
  const tCritPost = jStat.studentt.inv(0.975, statsPost.n - 1);

  drawErrorBarChart(
    "infer-chart",
    `사전-사후 95% 신뢰구간 비교 오차막대`,
    [
      { name: `${var1} (사전)`, mean: statsPre.mean, lower: statsPre.mean - tCritPre * sePre, upper: statsPre.mean + tCritPre * sePre },
      { name: `${var2} (사후)`, mean: statsPost.mean, lower: statsPost.mean - tCritPost * sePost, upper: statsPost.mean + tCritPost * sePost }
    ]
  );

  // 6. 경고판
  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--warning-light)";
  alertBox.style.color = "var(--warning)";
  alertBox.style.borderColor = "var(--warning)";
  alertTxt.textContent = "주의: 전후 차이가 유의하더라도, 다른 외생 변수(예: 성장 효과, 우연히 쉬워진 시험 등)의 통제가 이루어지지 않았다면 변화의 진짜 원인이 오직 해당 조치 때문이라고 단정할 수 없습니다.";
}

// 4) 일원분산분석 ANOVA 실행
function runAnovaAnalysis() {
  const varName = document.getElementById("infer-select-var").value;
  const groupVar = document.getElementById("infer-select-group").value;

  // 집단 분류
  const groupDataMap = {};
  AppState.data.forEach(row => {
    if (isMissingValue(varName, row[varName]) || isMissingValue(groupVar, row[groupVar])) {
      return; // 결측값 행 제외
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

  // 1. 가정 점검
  const norms = grpNames.map(name => {
    const chk = StatsHelper.checkNormality(groupDataMap[name]);
    chk.reason = `'${getValLabel(groupVar, name)}' 집단 정규성: ` + chk.reason;
    return chk;
  });

  const groupsList = grpNames.map(name => groupDataMap[name]);
  const homos = StatsHelper.checkHomoscedasticity(groupsList);
  norms.push(homos);
  renderAssumptionDashboard(norms);

  // 2. ANOVA 연산
  const anova = StatsHelper.oneWayAnova(groupDataMap);
  if (anova.error) {
    alert(anova.error);
    return;
  }

  // 3. 결과 요약표
  const table = document.getElementById("infer-result-table");
  const sig = anova.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  let descRowsHtml = "";
  let overallList = [];

  anova.groups.forEach(g => {
    const rawData = groupDataMap[g.name];
    const desc = StatsHelper.calculateDescriptive(rawData);
    const se = desc.stdDev / Math.sqrt(desc.n);
    const ciLower = desc.mean - 1.96 * se;
    const ciUpper = desc.mean + 1.96 * se;
    overallList = overallList.concat(rawData);

    descRowsHtml += `
      <tr>
        <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${getValLabel(groupVar, g.name)}</strong></td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${desc.n}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${desc.mean.toFixed(3)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${desc.stdDev.toFixed(3)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${se.toFixed(4)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">[${ciLower.toFixed(3)} ~ ${ciUpper.toFixed(3)}]</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${desc.min}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${desc.max}</td>
      </tr>
    `;
  });

  const overallDesc = StatsHelper.calculateDescriptive(overallList);
  if (overallDesc) {
    const overallSe = overallDesc.stdDev / Math.sqrt(overallDesc.n);
    const overallCiLower = overallDesc.mean - 1.96 * overallSe;
    const overallCiUpper = overallDesc.mean + 1.96 * overallSe;
    descRowsHtml += `
      <tr class="highlight-row">
        <td style="border:1px solid var(--border-glass); padding:8px;"><strong>전체 합계</strong></td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${overallDesc.n}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${overallDesc.mean.toFixed(3)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${overallDesc.stdDev.toFixed(3)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${overallSe.toFixed(4)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">[${overallCiLower.toFixed(3)} ~ ${overallCiUpper.toFixed(3)}]</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${overallDesc.min}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${overallDesc.max}</td>
      </tr>
    `;
  }

  const msBetween = anova.ssBetween / anova.dfBetween;
  const msWithin = anova.ssWithin / anova.dfWithin;
  const ssTotal = anova.ssBetween + anova.ssWithin;
  const dfTotal = anova.dfBetween + anova.dfWithin;

  table.innerHTML = `
    <tr><th colspan="8">1. 기술통계 (집단별 정보)</th></tr>
    <tr>
      <td colspan="8" style="padding:0; border:none;">
        <div class="table-scroll-container" style="margin:0;">
          <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
            <thead>
              <tr style="background-color:rgba(114, 46, 209, 0.03);">
                <th style="border:1px solid var(--border-glass); padding:8px;">집단 구분 (${groupVar})</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">N</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준편차</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준오차</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균의 95% 신뢰구간</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">최소값</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">최대값</th>
              </tr>
            </thead>
            <tbody>
              ${descRowsHtml}
            </tbody>
          </table>
        </div>
      </td>
    </tr>

    <tr><td colspan="8" style="padding-top:15px; border:none;"></td></tr>
    <tr><th colspan="8" style="padding-top:20px;">2. 분산분석표 (ANOVA Table - SPSS 표준 양식)</th></tr>
    <tr>
      <td colspan="8" style="padding:0; border:none;">
        <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border:1px solid var(--border-glass); padding:8px;">구분</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">제곱합 (SS)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">자유도 (df)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균제곱 (MS)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">F</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">유의확률 (Sig.)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>집단 간 (Between Groups)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${anova.ssBetween.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${anova.dfBetween}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${msBetween.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;" rowspan="2" style="vertical-align:middle;"><strong>${anova.fValue.toFixed(3)}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;" rowspan="2" style="vertical-align:middle; color:${anova.pValue < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${anova.pValue.toFixed(4)}</strong><br><span style="font-size:9px;font-weight:normal;">(${sig})</span></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>집단 내 (Within Groups)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${anova.ssWithin.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${anova.dfWithin}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${msWithin.toFixed(3)}</td>
            </tr>
            <tr class="highlight-row">
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>합계 (Total)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${ssTotal.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${dfTotal}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>

    <tr><td colspan="8" style="padding-top:10px; border:none;"></td></tr>
    <tr><td><strong>효과크기 (η²)</strong></td><td colspan="7"><strong>${anova.etaSquared.toFixed(3)}</strong> (0.01: 작음, 0.06: 중간, 0.14: 큼)</td></tr>
  `;

  // 4. 사후검정 테이블 노출 (Duncan, Scheffé, Tukey-Kramer)
  const posthocCard = document.getElementById("anova-posthoc-card");
  posthocCard.classList.remove("hidden");
  
  const posthocTable = document.getElementById("anova-posthoc-table");
  
  // 1) Duncan 사후검정 표
  let duncanHtml = `
    <div style="margin-bottom:28px; border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 18px; background-color: rgba(114, 46, 209, 0.02); box-shadow: var(--shadow-sm);">
      <h4 style="margin-top:0; margin-bottom:12px; color:var(--primary); font-size:13px; font-weight:700; display:flex; align-items:center; gap:8px;"><span style="background-color:var(--primary); color:white; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600;">기법 1</span> Duncan의 다중 범위 검정 (MRT)</h4>
      <div class="table-scroll-container" style="margin:0; border:none; background:transparent; max-height:none;">
        <table class="data-table-result" style="width:100%; font-size:11px; border-collapse:collapse;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border-bottom:2px solid var(--primary); padding:8px 10px;">집단 비교 쌍 (I vs J)</th>
              <th style="border-bottom:2px solid var(--primary); padding:8px 10px; text-align:center;">평균 차이 (I-J)</th>
              <th style="border-bottom:2px solid var(--primary); padding:8px 10px; text-align:center;">임계 범위 (LSR)</th>
              <th style="border-bottom:2px solid var(--primary); padding:8px 10px; text-align:center;">유의 여부 (α=0.05)</th>
            </tr>
          </thead>
          <tbody>
  `;
  anova.postHoc.duncan.forEach(ph => {
    const isSig = ph.isSignificant;
    const parts = ph.comparison.split(" vs ");
    const displayComparison = parts.length === 2 
      ? `${getValLabel(groupVar, parts[0])} vs ${getValLabel(groupVar, parts[1])}`
      : ph.comparison;
    duncanHtml += `
      <tr class="${isSig ? 'highlight-row' : ''}">
        <td style="padding:8px 10px;"><strong>${displayComparison}</strong></td>
        <td style="padding:8px 10px; text-align:center;">${ph.diff.toFixed(3)}</td>
        <td style="padding:8px 10px; text-align:center;">${ph.criticalRange.toFixed(3)}</td>
        <td style="padding:8px 10px; text-align:center;"><strong style="color:${isSig ? 'var(--primary)' : 'inherit'};">${isSig ? '차이 유의함' : '유의하지 않음'}</strong></td>
      </tr>
    `;
  });
  duncanHtml += `</tbody></table></div></div>`;

  // 2) Scheffé 사후검정 표
  let scheffeHtml = `
    <div style="margin-bottom:28px; border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 18px; background-color: rgba(22, 119, 255, 0.02); box-shadow: var(--shadow-sm);">
      <h4 style="margin-top:0; margin-bottom:12px; color:var(--info); font-size:13px; font-weight:700; display:flex; align-items:center; gap:8px;"><span style="background-color:var(--info); color:white; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600;">기법 2</span> Scheffé의 다중 비교 검정</h4>
      <div class="table-scroll-container" style="margin:0; border:none; background:transparent; max-height:none;">
        <table class="data-table-result" style="width:100%; font-size:11px; border-collapse:collapse;">
          <thead>
            <tr style="background-color:rgba(22, 119, 255, 0.05);">
              <th style="border-bottom:2px solid var(--info); padding:8px 10px;">집단 비교 쌍 (I vs J)</th>
              <th style="border-bottom:2px solid var(--info); padding:8px 10px; text-align:center;">평균 차이 (I-J)</th>
              <th style="border-bottom:2px solid var(--info); padding:8px 10px; text-align:center;">임계 차이 (CD)</th>
              <th style="border-bottom:2px solid var(--info); padding:8px 10px; text-align:center;">유의확률 (p-value)</th>
              <th style="border-bottom:2px solid var(--info); padding:8px 10px; text-align:center;">유의 여부 (α=0.05)</th>
            </tr>
          </thead>
          <tbody>
  `;
  anova.postHoc.scheffe.forEach(ph => {
    const isSig = ph.isSignificant;
    const parts = ph.comparison.split(" vs ");
    const displayComparison = parts.length === 2 
      ? `${getValLabel(groupVar, parts[0])} vs ${getValLabel(groupVar, parts[1])}`
      : ph.comparison;
    scheffeHtml += `
      <tr class="${isSig ? 'highlight-row' : ''}">
        <td style="padding:8px 10px;"><strong>${displayComparison}</strong></td>
        <td style="padding:8px 10px; text-align:center;">${ph.diff.toFixed(3)}</td>
        <td style="padding:8px 10px; text-align:center;">${ph.criticalRange.toFixed(3)}</td>
        <td style="padding:8px 10px; text-align:center;">${ph.pValue.toFixed(4)}</td>
        <td style="padding:8px 10px; text-align:center;"><strong style="color:${isSig ? 'var(--primary)' : 'inherit'};">${isSig ? '차이 유의함' : '유의하지 않음'}</strong></td>
      </tr>
    `;
  });
  scheffeHtml += `</tbody></table></div></div>`;

  // 3) Tukey-Kramer 사후검정 표
  let tukeyHtml = `
    <div style="border: 1px solid var(--border-glass); border-radius: var(--radius-sm); padding: 18px; background-color: rgba(56, 158, 13, 0.02); box-shadow: var(--shadow-sm);">
      <h4 style="margin-top:0; margin-bottom:12px; color:var(--success); font-size:13px; font-weight:700; display:flex; align-items:center; gap:8px;"><span style="background-color:var(--success); color:white; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600;">기법 3</span> Tukey-Kramer (HSD) 다중 비교 검정</h4>
      <div class="table-scroll-container" style="margin:0; border:none; background:transparent; max-height:none;">
        <table class="data-table-result" style="width:100%; font-size:11px; border-collapse:collapse;">
          <thead>
            <tr style="background-color:rgba(56, 158, 13, 0.05);">
              <th style="border-bottom:2px solid var(--success); padding:8px 10px;">집단 비교 쌍 (I vs J)</th>
              <th style="border-bottom:2px solid var(--success); padding:8px 10px; text-align:center;">평균 차이 (I-J)</th>
              <th style="border-bottom:2px solid var(--success); padding:8px 10px; text-align:center;">임계 범위 (HSD)</th>
              <th style="border-bottom:2px solid var(--success); padding:8px 10px; text-align:center;">유의확률 (보정 p)</th>
              <th style="border-bottom:2px solid var(--success); padding:8px 10px; text-align:center;">유의 여부 (α=0.05)</th>
            </tr>
          </thead>
          <tbody>
  `;
  anova.postHoc.tukey.forEach(ph => {
    const isSig = ph.isSignificant;
    const parts = ph.comparison.split(" vs ");
    const displayComparison = parts.length === 2 
      ? `${getValLabel(groupVar, parts[0])} vs ${getValLabel(groupVar, parts[1])}`
      : ph.comparison;
    tukeyHtml += `
      <tr class="${isSig ? 'highlight-row' : ''}">
        <td style="padding:8px 10px;"><strong>${displayComparison}</strong></td>
        <td style="padding:8px 10px; text-align:center;">${ph.diff.toFixed(3)}</td>
        <td style="padding:8px 10px; text-align:center;">${ph.criticalRange.toFixed(3)}</td>
        <td style="padding:8px 10px; text-align:center;">${ph.pValue.toFixed(4)}</td>
        <td style="padding:8px 10px; text-align:center;"><strong style="color:${isSig ? 'var(--primary)' : 'inherit'};">${isSig ? '차이 유의함' : '유의하지 않음'}</strong></td>
      </tr>
    `;
  });
  tukeyHtml += `</tbody></table></div></div>`;

  posthocTable.innerHTML = duncanHtml + scheffeHtml + tukeyHtml;

  // 5. 한국어 해석
  const isSig = anova.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  let effectLabel = "작은 수준";
  if (anova.etaSquared >= 0.14) effectLabel = "매우 큰 수준 (집단 간 성향 차이가 매우 강함)";
  else if (anova.etaSquared >= 0.06) effectLabel = "중간 수준";

  let sigGroups = anova.postHoc.tukey.filter(p => p.isSignificant).map(p => {
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

  // 5.5 시각화 (Error Bar)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");

  const groupsInfo = anova.groups.map(g => {
    const rawData = groupDataMap[g.name];
    const desc = StatsHelper.calculateDescriptive(rawData);
    const se = desc.stdDev / Math.sqrt(desc.n);
    const tCrit = jStat.studentt.inv(0.975, desc.n - 1);
    return {
      name: getValLabel(groupVar, g.name),
      mean: desc.mean,
      lower: desc.mean - tCrit * se,
      upper: desc.mean + tCrit * se
    };
  });

  drawErrorBarChart(
    "infer-chart",
    `집단별 95% 신뢰구간 비교 오차막대 (ANOVA)`,
    groupsInfo
  );

  // 6. 경고판
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

  // 1. 가정 점검
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

  // 2. 검정 연산
  const chisq = StatsHelper.chiSquareTest(observed, null, "goodness");
  if (chisq.error) {
    alert(chisq.error);
    return;
  }

  // 3. 결과 요약표
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

  // 4. 한국어 해석
  const isSig = chisq.pValue < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  interpretation.innerHTML = `
    <p>범주형 변수 <strong>'${varName}'</strong>의 각 범주 빈도가 균등한 기대를 따르는지 적합도 검정을 수행했습니다.</p>
    <p>검정 결과, 범주별 편차 분포는 통계적으로 <strong>${isSig ? "유의미한 차이가 존재합니다" : "유의미한 차이가 나지 않습니다"}</strong> (χ² = ${chisq.chi2Value.toFixed(2)}, p = ${chisq.pValue.toFixed(3)}).</p>
    <p>${isSig ? `즉, 각 범주가 균등한 비율로 선택되지 않고, 특정 항목으로 통계적으로 유의하게 치우친 편향 현상이 나타났음을 뜻합니다.` : `즉, 각 범주가 균등하게 고른 빈도로 분포되어 있어 고른 균등 기대를 충족하고 있습니다.`}</p>
  `;

  // 5. 경고판
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
  
  // 2D 매트릭스 생성
  const matrix = [];
  cross.rows.forEach(r => {
    const rowList = [];
    cross.cols.forEach(c => {
      rowList.push(cross.table[r][c]);
    });
    matrix.push(rowList);
  });

  // 1. 검정 연산
  const chisq = StatsHelper.chiSquareTest(matrix, null, "independence");
  if (chisq.error) {
    alert(chisq.error);
    return;
  }

  // 2. 가정 점검
  const cellCheck = {
    passed: chisq.warning === null,
    reason: chisq.warning ? chisq.warning : "모든 셀의 기대 빈도가 충분히 커 카이제곱 검정을 수행하기 적합합니다.",
    severity: chisq.warning ? "warning" : "success"
  };
  renderAssumptionDashboard([cellCheck]);

  // 3. 결과 요약표
  const table = document.getElementById("infer-result-table");
  const sig = chisq.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  let crossHtml = `
    <tr><th colspan="${cross.cols.length + 2}">1. ${var1} × ${var2} 교차표 (관측빈도 및 기대빈도)</th></tr>
    <tr>
      <td colspan="${cross.cols.length + 2}" style="padding:0; border:none;">
        <div class="table-scroll-container" style="margin:0;">
          <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
            <thead>
              <tr style="background-color:rgba(114, 46, 209, 0.03);">
                <th rowspan="2" style="border:1px solid var(--border-glass); padding:8px;">${var1} \\ ${var2}</th>
                <th colspan="${cross.cols.length}" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${var2}</th>
                <th rowspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">합계</th>
              </tr>
              <tr style="background-color:rgba(114, 46, 209, 0.03);">
  `;

  cross.cols.forEach(c => {
    crossHtml += `<th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${getValLabel(var2, c)}</th>`;
  });
  crossHtml += `</tr></thead><tbody>`;

  // 집계 데이터 반올림 처리
  const roundedRowTotals = {};
  const roundedColTotals = {};
  cross.rows.forEach(r => {
    roundedRowTotals[r] = Math.round(cross.rowTotals[r]);
  });
  cross.cols.forEach(c => {
    roundedColTotals[c] = Math.round(cross.colTotals[c]);
  });
  const roundedN = Math.round(cross.n);

  cross.rows.forEach((r, rIdx) => {
    crossHtml += `<tr><td style="border:1px solid var(--border-glass); padding:8px;"><strong>${getValLabel(var1, r)}</strong></td>`;
    cross.cols.forEach((c, cIdx) => {
      const obs = Math.round(cross.table[r][c]);
      const exp = chisq.expected[rIdx][cIdx];
      const rowPct = roundedRowTotals[r] > 0 ? (obs / roundedRowTotals[r]) * 100 : 0;
      
      crossHtml += `<td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">
        ${obs}명<br>
        <span style="color:var(--text-muted); font-size:10px;">(기대: ${exp.toFixed(1)}명)</span><br>
        <span style="color:var(--info); font-size:10px; font-weight:600;">(행: ${rowPct.toFixed(1)}%)</span>
      </td>`;
    });
    crossHtml += `<td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"><strong>${roundedRowTotals[r]}명</strong></td></tr>`;
  });

  crossHtml += `<tr class="highlight-row"><td style="border:1px solid var(--border-glass); padding:8px;"><strong>합계</strong></td>`;
  cross.cols.forEach(c => {
    crossHtml += `<td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"><strong>${roundedColTotals[c]}명</strong></td>`;
  });
  crossHtml += `<td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"><strong>${roundedN}명</strong></td></tr>`;
  crossHtml += `</tbody></table></div></td></tr>`;

  table.innerHTML = `
    ${crossHtml}
    <tr><td colspan="${cross.cols.length + 2}" style="padding-top:15px; border:none;"></td></tr>
    <tr><th colspan="${cross.cols.length + 2}" style="padding-top:20px;">2. 카이제곱 독립성 검정 결과 상세 (SPSS 표준)</th></tr>
    <tr><td><strong>검정 방식</strong></td><td colspan="${cross.cols.length + 1}">피어슨 카이제곱 검정 (Pearson Chi-Square)</td></tr>
    <tr><td><strong>피어슨 카이제곱 통계량 (χ²)</strong></td><td colspan="${cross.cols.length + 1}"><strong>${chisq.chi2Value.toFixed(3)}</strong></td></tr>
    <tr><td><strong>자유도 (df)</strong></td><td colspan="${cross.cols.length + 1}">${chisq.df}</td></tr>
    <tr class="highlight-row"><td><strong>유의확률 (p-value, 양측)</strong></td><td colspan="${cross.cols.length + 1}"><strong>${chisq.pValue.toFixed(4)}</strong> (${sig})</td></tr>
    <tr><td><strong>크라메르 V (Cramér's V) 효과크기</strong></td><td colspan="${cross.cols.length + 1}"><strong>${chisq.cramersV.toFixed(3)}</strong> (0.1: 약함, 0.3: 보통, 0.5: 강함)</td></tr>
    <tr><td><strong>유효 케이스 수 (Valid N)</strong></td><td colspan="${cross.cols.length + 1}"><strong>${roundedN}명</strong></td></tr>
  `;

  // 3.5 차트 시각화 (그룹형 막대 그래프)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");

  const ctx = document.getElementById("infer-chart");
  if (AppState.chartInstance) AppState.chartInstance.destroy();

  const chartPalette = [
    "rgba(114, 46, 209, 0.7)",
    "rgba(22, 119, 255, 0.7)",
    "rgba(56, 158, 13, 0.7)",
    "rgba(212, 107, 8, 0.7)",
    "rgba(207, 19, 34, 0.7)",
    "rgba(19, 194, 194, 0.7)"
  ];

  const datasets = cross.cols.map((colVal, colIdx) => {
    const datasetData = cross.rows.map(rowVal => Math.round(cross.table[rowVal][colVal] || 0));
    return {
      label: getValLabel(var2, colVal),
      data: datasetData,
      backgroundColor: chartPalette[colIdx % chartPalette.length],
      borderWidth: 0
    };
  });

  const xLabels = cross.rows.map(r => getValLabel(var1, r));
  const isDark = AppState.theme === "dark";
  const textColor = isDark ? "#c8cdd4" : "#2d3748";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";

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
        title: { display: true, text: `${var1}별 ${var2} 교차 빈도분포`, color: textColor }
      },
      scales: {
        x: { title: { display: true, text: var1, color: textColor }, grid: { display: false }, ticks: { color: textColor } },
        y: { title: { display: true, text: "관측 빈도 (명)", color: textColor }, grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
      }
    }
  });

  // 다운로드 이미지 바인딩
  document.getElementById("btn-download-infer-chart").onclick = () => {
    const url = ctx.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `ChiSquare_${var1}_${var2}.png`;
    a.click();
  };

  // 4. 한국어 해석
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

  // 5. 경고판
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
      return; // 결측값 행 제외
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

  // 1. 가정 점검
  const norm1 = StatsHelper.checkNormality(data1);
  const norm2 = StatsHelper.checkNormality(data2);
  norm1.reason = `'${var1}' 정규성: ` + norm1.reason;
  norm2.reason = `'${var2}' 정규성: ` + norm2.reason;
  renderAssumptionDashboard([norm1, norm2]);

  // 2. 연산
  const corr = StatsHelper.correlationAnalysis(data1, data2);
  if (corr.error) {
    alert(corr.error);
    return;
  }

  // 3. 결과 요약표
  const table = document.getElementById("infer-result-table");
  const sig = corr.pValue < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";
  const r = corr.correlationCoefficient;

  const stats1 = StatsHelper.calculateDescriptive(data1);
  const stats2 = StatsHelper.calculateDescriptive(data2);

  let descHtml = `
    <tr><th colspan="5">1. 기술통계량</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.03);">
              <th style="border:1px solid var(--border-glass); padding:8px;">변수명</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균 (Mean)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준편차 (Std Dev)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">사례 수 (N)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${var1}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats1.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats1.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats1.n}명</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${var2}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats2.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats2.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats2.n}명</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  let matrixHtml = `
    <tr><th colspan="5" style="padding-top:20px;">2. 상관관계 분석표 (SPSS 표준 매트릭스 양식)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border:1px solid var(--border-glass); padding:8px;">구분</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">구분 지표</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${var1}</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${var2}</th>
            </tr>
          </thead>
          <tbody>
            <!-- var1 행 -->
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;" rowspan="3"><strong>${var1}</strong></td>
              <td style="border:1px solid var(--border-glass); padding:8px;">피어슨 상관계수 (r)</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">1</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold; color:var(--primary);">${r.toFixed(4)}${corr.pValue < 0.01 ? '**' : corr.pValue < 0.05 ? '*' : ''}</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">유의확률 (Sig. 양측)</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${corr.pValue.toFixed(4)}</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">N</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${corr.n}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${corr.n}</td>
            </tr>
            
            <!-- var2 행 -->
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;" rowspan="3"><strong>${var2}</strong></td>
              <td style="border:1px solid var(--border-glass); padding:8px;">피어슨 상관계수 (r)</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold; color:var(--primary);">${r.toFixed(4)}${corr.pValue < 0.01 ? '**' : corr.pValue < 0.05 ? '*' : ''}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">1</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">유의확률 (Sig. 양측)</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${corr.pValue.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">N</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${corr.n}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${corr.n}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  table.innerHTML = `
    ${descHtml}
    ${matrixHtml}
    <tr><td colspan="5" style="padding-top:10px; border:none;"></td></tr>
    <tr><td colspan="5" style="font-size:11px; color:var(--text-muted); border:none;">
      * 유의수준이 0.05 수준에서 유의미함 (양측 검정)<br>
      ** 유의수준이 0.01 수준에서 유의미함 (양측 검정)<br>
      t-통계량 = ${corr.tValue.toFixed(3)} (자유도 df = ${corr.df})
    </td></tr>
  `;

  // 4. 차트 노출
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

  // 다운로드 이미지 바인딩
  document.getElementById("btn-download-infer-chart").onclick = () => {
    const url = ctx.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Scatter_${var1}_${var2}.png`;
    a.click();
  };

  // 5. 한국어 해석
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

  // 6. 경고판
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
      return; // 결측값 행 제외
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

  // 1. 가정 점검
  const norm1 = StatsHelper.checkNormality(data1);
  const norm2 = StatsHelper.checkNormality(data2);
  norm1.reason = `독립변수 정규성: ` + norm1.reason;
  norm2.reason = `종속변수 정규성: ` + norm2.reason;
  renderAssumptionDashboard([norm1, norm2]);

  // 2. 연산
  const reg = StatsHelper.linearRegression(data1, data2);
  if (reg.error) {
    alert(reg.error);
    return;
  }

  // 3. 결과 요약표
  const table = document.getElementById("infer-result-table");
  const sigF = reg.pValueF < 0.05 ? "유의함" : "유의하지 않음";
  const sigSlope = reg.pValueSlope < 0.05 ? "유의함" : "유의하지 않음";

  const stats1 = StatsHelper.calculateDescriptive(data1);
  const stats2 = StatsHelper.calculateDescriptive(data2);

  // 1) 기술통계량 표
  let descHtml = `
    <tr><th colspan="4">1. 기술통계량</th></tr>
    <tr>
      <td colspan="4" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.03);">
              <th style="border:1px solid var(--border-glass); padding:8px;">구분</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균 (Mean)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준편차 (Std Dev)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">사례 수 (N)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">종속변수: <strong>${var2}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats2.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats2.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats2.n}명</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;">독립변수: <strong>${var1}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats1.mean.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats1.stdDev.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${stats1.n}명</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  // 2) 모형 요약 표
  const stdErrorEst = Math.sqrt(reg.ssRes / reg.dfRes);
  const rVal = Math.sqrt(reg.rSquared);
  let summaryHtml = `
    <tr><th colspan="4" style="padding-top:15px;">2. 모형 요약 (Model Summary)</th></tr>
    <tr>
      <td colspan="4" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border:1px solid var(--border-glass); padding:8px;">R</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">R제곱 (R²)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">조정된 R제곱</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">추정값의 표준오차</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px; text-align:center;">${rVal.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; font-weight:bold;">${reg.rSquared.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center;">${reg.adjustedRSquared.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center;">${stdErrorEst.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  // 3) 분산분석 ANOVA 표
  const msReg = reg.ssReg / reg.dfReg;
  const msRes = reg.ssRes / reg.dfRes;
  const dfTot = reg.dfReg + reg.dfRes;
  let anovaHtml = `
    <tr><th colspan="4" style="padding-top:15px;">3. 분산분석 (ANOVA Table)</th></tr>
    <tr>
      <td colspan="4" style="padding:0; border:none;">
        <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border:1px solid var(--border-glass); padding:8px;">구분</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">제곱합 (SS)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">자유도 (df)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균제곱 (MS)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">F</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">유의확률 (Sig.)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>회귀 (Regression)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.ssReg.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.dfReg}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${msReg.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;" rowspan="2" style="vertical-align:middle;"><strong>${reg.fValue.toFixed(3)}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;" rowspan="2" style="vertical-align:middle; color:${reg.pValueF < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${reg.pValueF.toFixed(4)}</strong><br><span style="font-size:9px;font-weight:normal;">(${sigF})</span></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>잔차 (Residual)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.ssRes.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.dfRes}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${msRes.toFixed(3)}</td>
            </tr>
            <tr class="highlight-row">
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>합계 (Total)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.ssTot.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${dfTot}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  // 4) 회귀계수 표
  const standardizedBeta = reg.slope >= 0 ? rVal : -rVal;
  const sumSqX = (stats1.n - 1) * stats1.variance;
  const seIntercept = sumSqX > 0 ? Math.sqrt(msRes * (1 / reg.n + Math.pow(stats1.mean, 2) / sumSqX)) : 0;
  const tValueIntercept = seIntercept > 0 ? reg.intercept / seIntercept : 0;
  const pValueIntercept = 2 * (1 - jStat.studentt.cdf(Math.abs(tValueIntercept), reg.dfRes));

  let coeffHtml = `
    <tr><th colspan="4" style="padding-top:15px;">4. 회귀계수 (Coefficients Table)</th></tr>
    <tr>
      <td colspan="4" style="padding:0; border:none;">
        <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th rowspan="2" style="border:1px solid var(--border-glass); padding:8px; vertical-align:middle;">모형 구분</th>
              <th colspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">비표준화 계수</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">표준화 계수</th>
              <th rowspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">t</th>
              <th rowspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">유의확률 (Sig.)</th>
            </tr>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">B</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준오차 (SE)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">베타 (Beta)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>(상수 - Intercept)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.intercept.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${seIntercept.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${tValueIntercept.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${pValueIntercept.toFixed(4)}</td>
            </tr>
            <tr style="background-color:rgba(114, 46, 209, 0.02);">
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${var1} (기울기)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold;">${reg.slope.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.seSlope.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold;">${standardizedBeta.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold;">${reg.tValue.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${reg.pValueSlope < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${reg.pValueSlope.toFixed(4)}</strong><br><span style="font-size:9px;font-weight:normal;">(${sigSlope})</span></td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  table.innerHTML = `
    ${descHtml}
    ${summaryHtml}
    ${anovaHtml}
    ${coeffHtml}
    <tr><td colspan="4" style="padding-top:10px; border:none;"></td></tr>
    <tr><td colspan="4" style="font-size:12px; font-weight:bold; border:none; color:var(--primary);">
      추정된 회귀 방정식: Y (${var2}) = ${reg.slope.toFixed(3)} * X (${var1}) + ${reg.intercept.toFixed(3)}
    </td></tr>
  `;

  // 4. 시각화 (산점도 + 회귀선)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");
  
  // 차트 그리기
  const ctx = document.getElementById("infer-chart");
  if (AppState.chartInstance) AppState.chartInstance.destroy();

  const points = AppState.data.map(row => ({
    x: parseFloat(row[var1]),
    y: parseFloat(row[var2])
  })).filter(pt => !isNaN(pt.x) && !isNaN(pt.y));

  const xVals = points.map(p => p.x);
  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);

  // 회귀선 포인트
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

  // 5. 한국어 해석
  const isSig = reg.pValueF < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");
  
  interpretation.innerHTML = `
    <p>원인(독립변수) <strong>'${var1}'</strong>이(가) 결과(종속변수) <strong>'${var2}'</strong>을(를) 통계적으로 유의미하게 예측하는지 단순선형회귀분석을 적용했습니다.</p>
    <p>분석 결과 도출된 회귀모형은 통계적으로 <strong>${isSig ? "유의미하게 타당합니다" : "유의미한 타당성을 얻지 못했습니다"}</strong> (F = ${reg.fValue.toFixed(2)}, p = ${reg.pValueF.toFixed(3)}).</p>
    <p>이 모형의 설명력(결정계수 R²)은 <strong>${reg.rSquared.toFixed(3)}</strong>이며, 이는 독립변수 '${var1}'이 종속변수 '${var2}' 전체 변동의 약 <strong>${(reg.rSquared * 100).toFixed(1)}%</strong>를 설명(예측)해내고 있음을 의미합니다.</p>
    <p>회귀 기울기 값은 <strong>${reg.slope.toFixed(3)}</strong>로 나타나, '${var1}'가 1단위 증가할 때마다 '${var2}'가 약 <strong>${reg.slope.toFixed(2)}</strong>만큼 ${reg.slope > 0 ? '증가' : '감소'}하는 선형 관계가 나타날 것으로 추정됩니다.</p>
  `;

  // 6. 경고판
  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--danger-light)";
  alertBox.style.color = "var(--danger)";
  alertBox.style.borderColor = "var(--danger)";
  alertTxt.textContent = "CRITICAL WARNING (인과 비약 방지): 회귀 분석은 예측 방정식 형태로 인과를 흉내 내지만, 실제로는 통계적 '선형 패턴'을 수치화한 것에 불과합니다. 변수 간의 논리적 메커니즘과 이론적 기반이 없거나 교란 변수를 차단하지 못했다면 결코 완벽한 원인-결과(인과)로 단정할 수 없으며 오직 상관성에 준해 보고해야 합니다.";
}

// 9) 다중선형회귀분석 실행
function runMultipleRegressionAnalysis() {
  const varY = document.getElementById("infer-select-var2").value;
  const checkedBoxes = document.querySelectorAll('input[name="infer-multireg-x"]:checked');
  const varXList = Array.from(checkedBoxes).map(cb => cb.value);

  if (varXList.length === 0) {
    alert("원인이 되는 독립변수(X)를 최소 1개 이상 선택해 주십시오.");
    return;
  }

  if (varXList.includes(varY)) {
    alert(`종속변수('${varY}')가 독립변수 선택 목록에 포함되어 있습니다. 변수 지정을 점검해 주십시오.`);
    return;
  }

  const xDataList = [];
  const yData = [];

  AppState.data.forEach(row => {
    let hasMissing = isMissingValue(varY, row[varY]);
    varXList.forEach(x => {
      if (isMissingValue(x, row[x])) hasMissing = true;
    });

    if (!hasMissing) {
      const yVal = parseFloat(row[varY]);
      const xVals = varXList.map(x => parseFloat(row[x]));
      if (!isNaN(yVal) && xVals.every(xv => !isNaN(xv))) {
        xDataList.push(xVals);
        yData.push(yVal);
      }
    }
  });

  const n = yData.length;
  const p = varXList.length;

  if (n < p + 2) {
    alert(`유효한 데이터 표본 수(N=${n})가 독립변수 개수(${p})에 비해 너무 작습니다. 최소 ${p + 2}개 이상의 매칭 데이터 쌍이 필요합니다.`);
    return;
  }

  // 1. 가정 점검
  const assumptionChecks = [];
  varXList.forEach(x => {
    const xCol = xDataList.map(row => row[varXList.indexOf(x)]);
    const norm = StatsHelper.checkNormality(xCol);
    norm.reason = `독립변수 '${x}' 정규성: ` + norm.reason;
    assumptionChecks.push(norm);
  });
  renderAssumptionDashboard(assumptionChecks);

  // 2. 연산
  const reg = StatsHelper.multipleLinearRegression(xDataList, yData, varXList);
  if (reg.error) {
    alert(reg.error);
    return;
  }

  // 3. 결과 요약표
  const table = document.getElementById("infer-result-table");
  const sigF = reg.pValueF < 0.05 ? "유의함 (p < 0.05)" : "유의하지 않음 (p ≥ 0.05)";

  const stdErrorEst = Math.sqrt(reg.msRes);
  const rVal = Math.sqrt(reg.rSquared);
  let summaryHtml = `
    <tr><th colspan="5">1. 모형 요약 (Model Summary)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:12px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.03);">
              <th style="border:1px solid var(--border-glass); padding:8px;">R (상관계수)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">R제곱 (R²)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">조정된 R제곱 (Adj R²)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">추정값의 표준오차 (SE)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px; text-align:center;">${rVal.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; font-weight:bold; color:var(--primary);">${reg.rSquared.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center;">${reg.adjustedRSquared.toFixed(4)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center;">${stdErrorEst.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  let anovaHtml = `
    <tr><td colspan="5" style="padding-top:15px; border:none;"></td></tr>
    <tr><th colspan="5">2. 분산분석표 (ANOVA Table - SPSS 표준 양식)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
          <thead>
            <tr style="background-color:rgba(114, 46, 209, 0.05);">
              <th style="border:1px solid var(--border-glass); padding:8px;">구분</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">제곱합 (SS)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">자유도 (df)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">평균제곱 (MS)</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">F</th>
              <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">유의확률 (Sig.)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>회귀 (Regression)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.ssReg.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.dfReg}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.msReg.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center;" rowspan="2" style="vertical-align:middle;"><strong>${reg.fValue.toFixed(3)}</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center;" rowspan="2" style="vertical-align:middle; color:${reg.pValueF < 0.05 ? 'var(--primary)' : 'inherit'};"><strong>${reg.pValueF.toFixed(4)}</strong><br><span style="font-size:9px;font-weight:normal;">(${sigF})</span></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>잔차 (Residual)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.ssRes.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.dfRes}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.msRes.toFixed(3)}</td>
            </tr>
            <tr class="highlight-row">
              <td style="border:1px solid var(--border-glass); padding:8px;"><strong>합계 (Total)</strong></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.ssTot.toFixed(3)}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${reg.dfTot}</td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
              <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;"></td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  `;

  let coeffRowsHtml = "";
  reg.coefficients.forEach(c => {
    const isSig = c.pValue < 0.05;
    const sigLabel = isSig ? `<strong>${c.pValue.toFixed(4)} *</strong>` : c.pValue.toFixed(4);
    const betaStr = c.beta !== null ? c.beta.toFixed(3) : "";
    coeffRowsHtml += `
      <tr style="${isSig && c.name !== '(상수 - Intercept)' ? 'background-color:rgba(114, 46, 209, 0.02); font-weight:600;' : ''}">
        <td style="border:1px solid var(--border-glass); padding:8px;"><strong>${c.name}</strong></td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${c.b.toFixed(3)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${c.se.toFixed(3)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; font-weight:bold;">${betaStr}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px;">${c.tValue.toFixed(3)}</td>
        <td style="border:1px solid var(--border-glass); text-align:center; padding:8px; color:${isSig ? 'var(--primary)' : 'inherit'};">${sigLabel}</td>
      </tr>
    `;
  });

  let coeffHtml = `
    <tr><td colspan="5" style="padding-top:15px; border:none;"></td></tr>
    <tr><th colspan="5">3. 회귀계수 결과 상세 (Coefficients Table - SPSS 표준)</th></tr>
    <tr>
      <td colspan="5" style="padding:0; border:none;">
        <div class="table-scroll-container" style="margin:0;">
          <table class="data-table" style="font-size:11px; width:100%; border-collapse:collapse; margin:0;">
            <thead>
              <tr style="background-color:rgba(114, 46, 209, 0.05);">
                <th rowspan="2" style="border:1px solid var(--border-glass); padding:8px; vertical-align:middle;">변수 요인</th>
                <th colspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px;">비표준화 계수</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">표준화 계수</th>
                <th rowspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">t</th>
                <th rowspan="2" style="border:1px solid var(--border-glass); text-align:center; padding:8px; vertical-align:middle;">유의확률 (Sig.)</th>
              </tr>
              <tr style="background-color:rgba(114, 46, 209, 0.05);">
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">B</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">표준오차 (SE)</th>
                <th style="border:1px solid var(--border-glass); text-align:center; padding:8px;">Beta</th>
              </tr>
            </thead>
            <tbody>
              ${coeffRowsHtml}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;

  table.innerHTML = summaryHtml + anovaHtml + coeffHtml;

  // 4. 시각화 (실제 Y vs 예측 Y 산점도)
  const chartCard = document.getElementById("infer-chart-card");
  chartCard.classList.remove("hidden");
  
  const ctx = document.getElementById("infer-chart");
  if (AppState.chartInstance) AppState.chartInstance.destroy();

  const predPoints = [];
  for (let i = 0; i < n; i++) {
    let pred = reg.coefficients[0].b; // Intercept
    for (let j = 0; j < p; j++) {
      pred += reg.coefficients[j + 1].b * xDataList[i][j];
    }
    predPoints.push({ x: yData[i], y: pred });
  }

  const allVals = [...yData, ...predPoints.map(pt => pt.y)];
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);

  const diagLine = [
    { x: minVal, y: minVal },
    { x: maxVal, y: maxVal }
  ];

  const isDark = AppState.theme === "dark";
  const textColor = isDark ? "#c8cdd4" : "#2d3748";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";

  AppState.chartInstance = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "관측 표본 (실제값 vs 예측값)",
          data: predPoints,
          backgroundColor: "rgba(114, 46, 209, 0.7)",
          borderColor: "var(--primary)",
          borderWidth: 1,
          pointRadius: 5
        },
        {
          label: "이상적인 예측선 (Y = Ŷ)",
          data: diagLine,
          type: "line",
          borderColor: "rgba(207, 19, 34, 0.6)",
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: textColor } },
        title: { display: true, text: `실제 Y(${varY}) vs 모형 예측값 비교 산점도`, color: textColor }
      },
      scales: {
        x: { title: { display: true, text: `실제값: ${varY}`, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } },
        y: { title: { display: true, text: `예측값`, color: textColor }, grid: { color: gridColor }, ticks: { color: textColor } }
      }
    }
  });

  document.getElementById("btn-download-infer-chart").onclick = () => {
    const url = ctx.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `Multiple_Regression_${varY}.png`;
    a.click();
  };

  // 5. 한국어 해석
  const isModelSig = reg.pValueF < 0.05;
  const interpretation = document.getElementById("infer-korean-interpretation");

  const sigVariables = reg.coefficients.filter(c => c.name !== '(상수 - Intercept)' && c.pValue < 0.05);
  const sigVarNames = sigVariables.map(c => `'${c.name}'`);

  let maxBetaVal = -1;
  let keyFactor = null;
  reg.coefficients.forEach(c => {
    if (c.name !== '(상수 - Intercept)' && c.beta !== null) {
      if (Math.abs(c.beta) > maxBetaVal) {
        maxBetaVal = Math.abs(c.beta);
        keyFactor = c;
      }
    }
  });

  let keyFactorText = "";
  if (keyFactor && keyFactor.pValue < 0.05) {
    keyFactorText = `<p>그중 표준화계수(Beta = <strong>${keyFactor.beta.toFixed(3)}</strong>)에 근거하여 종속변수에 가장 결정적 영향력을 행사하는 핵심 원인 변수는 <strong>'${keyFactor.name}'</strong>인 것으로 규명되었습니다.</p>`;
  }

  interpretation.innerHTML = `
    <p>독립변수군(${varXList.map(x => `'${x}'`).join(", ")})이 종속변수 <strong>'${varY}'</strong>에 유의미한 예측 효과를 미치는지 다중선형회귀분석을 구동하였습니다.</p>
    <p>분석결과, 회귀 모형의 분산분석 유의성 검정 F값은 <strong>${reg.fValue.toFixed(3)}</strong>이며, 모델 유의확률 p값은 <strong>${reg.pValueF.toFixed(4)}</strong>로 나타나 통계적으로 <strong>${isModelSig ? "유의미하게 타당합니다" : "유의미하지 않습니다"}</strong>.</p>
    <p>모형의 전체 결정계수(R-Square)는 <strong>${reg.rSquared.toFixed(3)}</strong>로, 이 회귀식의 원인 변수들이 결과 요인인 '${varY}' 총변동의 약 <strong>${(reg.rSquared*100).toFixed(1)}%</strong>를 유의하게 설명하고 있습니다.</p>
    ${isModelSig && sigVariables.length > 0 
      ? `<p>회귀계수 유의성을 개별 검정한 결과, 독립변수들 중 <strong>${sigVarNames.join(", ")}</strong> 요인(들)이 5% 유의수준 하에서 통계적으로 유의한 예측 기여를 하는 것으로 실증되었습니다.</p>`
      : `<p>개별 독립변수들의 회귀계수(B) 중 5% 유의수준에서 유의미한 독자적 설명력을 가지는 요인은 없는 것으로 나타났습니다.</p>`
    }
    ${keyFactorText}
  `;

  // 6. 경고판
  const alertBox = document.getElementById("interpretation-limit-box");
  const alertTxt = document.getElementById("interpretation-limit-text");
  alertBox.style.backgroundColor = "var(--danger-light)";
  alertBox.style.color = "var(--danger)";
  alertBox.style.borderColor = "var(--danger)";
  alertTxt.textContent = "CRITICAL WARNING (인과 비약 방지): 다중선형회귀분석은 복수 변수의 통계적 연합을 보여줍니다. 그러나 변수들 사이에 다중공선성(변수 간 선형 종속)이 크거나, 표집 편향이 존재한다면 왜곡된 설명력을 가집니다. 이를 인과관계로 비약해석하는 것은 철저히 지양해 주십시오.";
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

  // 차트 렌더링용 배열
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

    // 연속형 곡선 그리기 (평균 주위 ±4σ 영역)
    const start = mean - 4 * std;
    const end = mean + 4 * std;
    const step = (end - start) / 100;

    for (let i = 0; i <= 100; i++) {
      const x = start + i * step;
      plotLabels.push(x.toFixed(2));
      const y = pdf(x);
      plotData.push(y);

      // 확률 영역 하이라이트 여부 체크
      let isFilled = false;
      if (range === "less" && x <= a) isFilled = true;
      else if (range === "greater" && x >= a) isFilled = true;
      else if (range === "between" && x >= a && x <= b) isFilled = true;

      fillColors.push(isFilled ? "rgba(114, 46, 209, 0.4)" : "rgba(114, 46, 209, 0.05)");
    }

  } else {
    // 이항분포
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
      // nCr * p^r * (1-p)^(n-r)
      if (k < 0 || k > n) return 0;
      return jStat.binomial.pdf(k, n, p);
    };

    // 이산형 누적 확률 계산
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

  // 1. 값 표시
  document.getElementById("display-prob-expr").textContent = formulaStr;
  document.getElementById("display-prob-val").textContent = pVal.toFixed(4);
  document.getElementById("display-prob-pct").textContent = `(${(pVal * 100).toFixed(2)}%)`;
  document.getElementById("dist-summary-info").innerHTML = `<strong>${infoStr}</strong>`;

  // 2. 그래프 그리기
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
            // 커스텀 영역 색상을 주기 위해 차트 아래에 가공
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
    // 이항분포 (막대 그래프)
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

  // 다운로드 이미지 바인딩
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

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const purposeInput = document.querySelector('input[name="opt-purpose"]:checked');
      if (!purposeInput) return;
      const purpose = purposeInput.value;

      if (currentStep === 1) {
        if (purpose === "compare") {
          currentStep = 2; // 집단 수 물어보기로 이동
          if (step1) step1.classList.remove("active");
          if (step2) step2.classList.add("active");
        } else if (purpose === "relation") {
          currentStep = 3; // 변수 형태 물어보기로 이동
          if (step1) step1.classList.remove("active");
          if (step3) step3.classList.add("active");
        } else {
          // 비율 확인의 경우 -> 교차분석 (카이제곱 독립성 검정) 추천
          currentStep = 4;
          recommendedMethod = "chisq-ind";
          if (step1) step1.classList.remove("active");
          if (step4) step4.classList.add("active");
          renderRecommendation();
        }
        if (prevBtn) prevBtn.classList.remove("hidden");
      } else if (currentStep === 2) {
        // 집단 평균 비교 분기
        const groupsInput = document.querySelector('input[name="opt-groups"]:checked');
        if (groupsInput) {
          const groups = groupsInput.value;
          currentStep = 4;
          if (step2) step2.classList.remove("active");
          if (step4) step4.classList.add("active");

          if (groups === "1") recommendedMethod = "one-sample-t";
          else if (groups === "2") recommendedMethod = "ind-t";
          else if (groups === "3plus") recommendedMethod = "anova";
          else recommendedMethod = "paired-t";
          renderRecommendation();
        }
      } else if (currentStep === 3) {
        // 상관/회귀 비교 분기
        const varTypeInput = document.querySelector('input[name="opt-var-type"]:checked');
        if (varTypeInput) {
          const varType = varTypeInput.value;
          currentStep = 4;
          if (step3) step3.classList.remove("active");
          if (step4) step4.classList.add("active");

          if (varType === "continuous") recommendedMethod = "correlation"; // 피어슨 상관분석
          else if (varType === "regression-simple") recommendedMethod = "regression"; // 단순선형회귀분석
          else if (varType === "regression-multi") recommendedMethod = "multireg"; // 다중선형회귀분석
          else recommendedMethod = "chisq-ind"; // 교차분석
          renderRecommendation();
        }
      }

      updateWizardProgress();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentStep === 2 || currentStep === 3) {
        if (step2) step2.classList.remove("active");
        if (step3) step3.classList.remove("active");
        if (step1) step1.classList.add("active");
        currentStep = 1;
        prevBtn.classList.add("hidden");
      } else if (currentStep === 4) {
        const purposeInput = document.querySelector('input[name="opt-purpose"]:checked');
        if (purposeInput) {
          const purpose = purposeInput.value;
          if (step4) step4.classList.remove("active");
          if (purpose === "compare") {
            if (step2) step2.classList.add("active");
            currentStep = 2;
          } else if (purpose === "relation") {
            if (step3) step3.classList.add("active");
            currentStep = 3;
          } else {
            if (step1) step1.classList.add("active");
            currentStep = 1;
            prevBtn.classList.add("hidden");
          }
        }
      }
      updateWizardProgress();
    });
  }

  function updateWizardProgress() {
    const pct = currentStep === 1 ? 25 : currentStep === 2 || currentStep === 3 ? 60 : 100;
    if (progressBar) progressBar.style.width = `${pct}%`;

    if (currentStep === 4) {
      if (nextBtn) nextBtn.classList.add("hidden");
      if (goBtn) goBtn.classList.remove("hidden");
    } else {
      if (nextBtn) nextBtn.classList.remove("hidden");
      if (goBtn) goBtn.classList.add("hidden");
    }
  }

  function renderRecommendation() {
    const nameEl = document.getElementById("rec-analysis-name");
    const descEl = document.getElementById("rec-analysis-desc");
    const assumptionsEl = document.getElementById("rec-analysis-assumptions");

    if (recommendedMethod === "one-sample-t") {
      if (nameEl) nameEl.textContent = "일표본 t-검정 (One-Sample t-test)";
      if (descEl) descEl.textContent = "표본 평균과 이미 알려진 모집단의 기준치(예: 전국 평균 키 등)가 통계적으로 유의미하게 다른지 검정합니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>정규성 가정: 분석 대상이 되는 수치형 변수의 데이터 분포가 정규분포를 따라야 합니다.</li>
          <li>대조군 수치: 비교할 명확한 기준값(모평균 추정치)이 필요합니다.</li>
        `;
      }
    } else if (recommendedMethod === "ind-t") {
      if (nameEl) nameEl.textContent = "독립표본 t-검정 (Independent Samples t-test)";
      if (descEl) descEl.textContent = "성별에 따른 시험 점수 차이처럼, 서로 겹치지 않는 두 집단의 평균값 차이가 우연인지 실제 의미 있는 격차인지 규명합니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>정규성 가정: 각 집단의 데이터가 정규분포를 따릅니다.</li>
          <li>등분산성 가정: 두 집단의 흩어진 폭(분산)이 유사합니다. (다를 시 Welch의 보정 적용)</li>
          <li>비모수 대안: 표본이 적거나 정규성이 훼손될 시 'Mann-Whitney U 검정'을 고려합니다.</li>
        `;
      }
    } else if (recommendedMethod === "paired-t") {
      if (nameEl) nameEl.textContent = "대응표본 t-검정 (Paired Samples t-test)";
      if (descEl) descEl.textContent = "체중 감량 교육 전과 후의 몸무게처럼, 동일한 대상에 대한 사전/사후 두 값의 변동 차이가 통계적으로 실재하는지 증명합니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>정규성 가정: 사전-사후의 '차이값' 분포가 정규성을 만족해야 합니다.</li>
          <li>비모수 대안: 정규성 위배 시 'Wilcoxon 부호순위 검정'을 대안으로 씁니다.</li>
        `;
      }
    } else if (recommendedMethod === "anova") {
      if (nameEl) nameEl.textContent = "일원분산분석 (One-way ANOVA)";
      if (descEl) descEl.textContent = "학년(1학년 vs 2학년 vs 3학년)에 따른 수면 평균처럼, 3개 이상 다중 집단의 평균들이 유의하게 다른지 한 번에 비교합니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>다중검정 방지: t-검정을 3번 반복하는 오류를 피하게 해줍니다.</li>
          <li>사후검정(Post-hoc): 차이가 난다면 어떤 집단들끼리 격차가 생겼는지 Tukey HSD 검정 등을 연계 수행합니다.</li>
          <li>비모수 대안: Kruskal-Wallis H 검정이 있습니다.</li>
        `;
      }
    } else if (recommendedMethod === "correlation") {
      if (nameEl) nameEl.textContent = "피어슨 상관분석 (Pearson Correlation)";
      if (descEl) descEl.textContent = "하루 공부 시간과 기말고사 성적처럼, 두 연속형 변수가 얼마나 일직선 방향으로 비례하여 밀접하게 연관되어 있는지 평가합니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>선형성 가정: 두 변수 관계가 곡선이 아닌 직선 비례 성향이어야 합니다.</li>
          <li>인과 오용 경고: 상관이 아무리 높아도 한 요인이 다른 쪽의 직접적 원인이라고 단정하면 안 됩니다.</li>
        `;
      }
    } else if (recommendedMethod === "regression") {
      if (nameEl) nameEl.textContent = "단순선형회귀분석 (Simple Linear Regression)";
      if (descEl) descEl.textContent = "독립변수 1개가 종속변수 1개에 미치는 선형적 영향력과 인과적 수식 방정식을 도출하고 미래 값을 예측합니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>선형성 가정: 독립변수와 종속변수 간 관계가 곡선이 아닌 직선 형태로 변화해야 합니다.</li>
          <li>오차항 조건: 잔차들이 서로 독립이고 고르게 분포해 있어야 가설 검정이 유효합니다.</li>
        `;
      }
    } else if (recommendedMethod === "multireg") {
      if (nameEl) nameEl.textContent = "다중선형회귀분석 (Multiple Linear Regression)";
      if (descEl) descEl.textContent = "수면 시간, 공부 시간 등 여러 독립변수들이 하나의 결과 성적(종속변수)에 미치는 영향력을 인과 분석하고 예측 방정식을 세웁니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>다중공선성 주의: 독립변수들끼리 강력한 상관이 얽혀 통계가 파괴되지 않게 검증해야 합니다 (VIF 분석 등).</li>
          <li>가정 사항: 오차항의 독립성, 정규성, 등분산성을 점검합니다.</li>
        `;
      }
    } else if (recommendedMethod === "chisq-ind") {
      if (nameEl) nameEl.textContent = "교차분석 (카이제곱 독립성 검정)";
      if (descEl) descEl.textContent = "성별(남/여)에 따른 선호 급식(양식/일식) 비율처럼, 두 범주형 변수의 결합 빈도 격차와 요인 간 상관관계를 규명합니다.";
      if (assumptionsEl) {
        assumptionsEl.innerHTML = `
          <li>비교 데이터: 두 변수의 교차 분할표를 사용하여 계산합니다.</li>
          <li>기대빈도 조건: 5 미만인 셀이 20%를 초과할 시 피셔의 정확검정이나 데이터 병합을 권합니다.</li>
        `;
      }
    }
  }

  // 추천된 분석으로 강제 탭 이동 및 로드
  if (goBtn) {
    goBtn.addEventListener("click", () => {
      // 추론통계 탭 활성화
      const inferTab = document.querySelector('[data-tab="tab-infer"]');
      if (inferTab) inferTab.click();

      // 해당 분석 드롭다운을 추천 기법으로 강제 매칭
      const inferMethodSelect = document.getElementById("infer-method");
      if (inferMethodSelect) {
        inferMethodSelect.value = recommendedMethod;
        updateInferMethodOptions();
      }
      
      // 원래 단계로 리셋
      if (step4) step4.classList.remove("active");
      if (step1) step1.classList.add("active");
      if (prevBtn) prevBtn.classList.add("hidden");
      if (goBtn) goBtn.classList.add("hidden");
      if (nextBtn) nextBtn.classList.remove("hidden");
      currentStep = 1;
      if (progressBar) progressBar.style.width = "25%";
    });
  }
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

// --- 페이지네이션 컨트롤러 렌더링 및 이벤트 ---
function renderPagination() {
  const paginationContainer = document.getElementById("table-pagination");
  if (AppState.data.length === 0) {
    paginationContainer.classList.add("hidden");
    return;
  }
  paginationContainer.classList.remove("hidden");

  const totalPages = Math.ceil(AppState.data.length / AppState.pageSize);
  
  // 현재 페이지 범위 초과 방지
  if (AppState.currentPage > totalPages) {
    AppState.currentPage = Math.max(1, totalPages);
  }

  // 페이지 및 행 정보 텍스트 표시
  document.getElementById("page-info").textContent = `${AppState.currentPage} / ${totalPages} 페이지 (총 ${AppState.data.length}행)`;

  // 각 버튼 활성/비활성 처리
  document.getElementById("btn-page-first").disabled = AppState.currentPage === 1;
  document.getElementById("btn-page-prev").disabled = AppState.currentPage === 1;
  document.getElementById("btn-page-next").disabled = AppState.currentPage === totalPages;
  document.getElementById("btn-page-last").disabled = AppState.currentPage === totalPages;
}

function initPaginationEvents() {
  const btnFirst = document.getElementById("btn-page-first");
  const btnPrev = document.getElementById("btn-page-prev");
  const btnNext = document.getElementById("btn-page-next");
  const btnLast = document.getElementById("btn-page-last");
  const selectSize = document.getElementById("select-page-size");

  if (!btnFirst) return; // 마크업 안전 확인

  btnFirst.onclick = () => {
    if (AppState.currentPage > 1) {
      AppState.currentPage = 1;
      resetAnalysisVariables();
    }
  };

  btnPrev.onclick = () => {
    if (AppState.currentPage > 1) {
      AppState.currentPage--;
      resetAnalysisVariables();
    }
  };

  btnNext.onclick = () => {
    const totalPages = Math.ceil(AppState.data.length / AppState.pageSize);
    if (AppState.currentPage < totalPages) {
      AppState.currentPage++;
      resetAnalysisVariables();
    }
  };

  btnLast.onclick = () => {
    const totalPages = Math.ceil(AppState.data.length / AppState.pageSize);
    if (AppState.currentPage < totalPages) {
      AppState.currentPage = totalPages;
      resetAnalysisVariables();
    }
  };

  selectSize.onchange = (e) => {
    AppState.pageSize = parseInt(e.target.value);
    AppState.currentPage = 1;
    resetAnalysisVariables();
  };
}
