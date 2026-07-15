/**
 * 고등학생용 통계 분석 프로그램 - 통계 엔진 (stats-helper.js)
 * 외부 라이브러리 (jStat, simple-statistics)를 래핑하여 정확한 계산 및 가정을 점검합니다.
 */

// 행렬 연산 유틸 (다중선형회귀분석용)
const Matrix = {
  transpose(A) {
    const r = A.length;
    const c = A[0].length;
    const T = [];
    for (let j = 0; j < c; j++) {
      T[j] = [];
      for (let i = 0; i < r; i++) {
        T[j][i] = A[i][j];
      }
    }
    return T;
  },
  multiply(A, B) {
    const rA = A.length;
    const cA = A[0].length;
    const rB = B.length;
    const cB = B[0].length;
    if (cA !== rB) throw new Error("Matrix dimensions mismatch");
    const C = [];
    for (let i = 0; i < rA; i++) {
      C[i] = [];
      for (let j = 0; j < cB; j++) {
        let sum = 0;
        for (let k = 0; k < cA; k++) {
          sum += A[i][k] * B[k][j];
        }
        C[i][j] = sum;
      }
    }
    return C;
  },
  invert(A) {
    const n = A.length;
    const M = [];
    for (let i = 0; i < n; i++) {
      M[i] = [];
      for (let j = 0; j < n; j++) {
        M[i][j] = A[i][j];
      }
      for (let j = 0; j < n; j++) {
        M[i][j + n] = (i === j) ? 1 : 0;
      }
    }
    // Gauss-Jordan elimination
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(M[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxEl) {
          maxEl = Math.abs(M[k][i]);
          maxRow = k;
        }
      }
      if (maxRow !== i) {
        const temp = M[i];
        M[i] = M[maxRow];
        M[maxRow] = temp;
      }
      const pivot = M[i][i];
      if (Math.abs(pivot) < 1e-12) {
        throw new Error("독립변수 간에 강한 선형관계(다중공선성)가 있거나 표본이 부족하여 역행렬을 계산할 수 없습니다.");
      }
      for (let j = i; j < 2 * n; j++) {
        M[i][j] /= pivot;
      }
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = M[k][i];
          for (let j = i; j < 2 * n; j++) {
            M[k][j] -= factor * M[i][j];
          }
        }
      }
    }
    const Inv = [];
    for (let i = 0; i < n; i++) {
      Inv[i] = [];
      for (let j = 0; j < n; j++) {
        Inv[i][j] = M[i][j + n];
      }
    }
    return Inv;
  }
};

const StatsHelper = {
  // --- 1. 기술 통계량 (Descriptive Statistics) ---
  calculateDescriptive(data) {
    if (!data || data.length === 0) return null;

    // 연속형 데이터만 필터링 (숫자로 변환 가능한 값)
    const numericData = data
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));

    if (numericData.length === 0) return null;

    const n = numericData.length;
    // 오름차순 정렬
    const sorted = [...numericData].sort((a, b) => a - b);

    // 합계, 평균
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    // 중앙값
    const median = ss.median(sorted);

    // 최빈값 계산
    const modeMap = {};
    let maxFreq = 0;
    let modes = [];
    sorted.forEach(v => {
      modeMap[v] = (modeMap[v] || 0) + 1;
      if (modeMap[v] > maxFreq) {
        maxFreq = modeMap[v];
      }
    });
    for (const k in modeMap) {
      if (modeMap[k] === maxFreq) {
        modes.push(parseFloat(k));
      }
    }
    const mode = modes.length === n ? "없음" : modes.join(", ");

    // 분산, 표준편차 (표본분산/표본표준편차 - n-1 분모 사용)
    const variance = n > 1 ? ss.sampleVariance(sorted) : 0;
    const stdDev = n > 1 ? ss.sampleStandardDeviation(sorted) : 0;

    // 최소, 최대, 범위
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;

    // 사분위수
    const q1 = ss.quantile(sorted, 0.25);
    const q3 = ss.quantile(sorted, 0.75);
    const iqr = q3 - q1;

    // 왜도(Skewness)와 첨도(Kurtosis) - 정규성 판정용
    // Skewness = [n / ((n-1)(n-2))] * sum((x_i - mean)^3) / stdDev^3
    let skewness = 0;
    let kurtosis = 0;
    if (n > 2 && stdDev > 0) {
      const m3 = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 3), 0) / n;
      const m2 = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
      // Fisher 왜도
      skewness = m3 / Math.pow(m2, 1.5) * Math.sqrt(n * (n - 1)) / (n - 2);

      if (n > 3) {
        const m4 = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 4), 0) / n;
        // Fisher excess kurtosis (정규분포 = 0)
        const sampleKurt = m4 / Math.pow(m2, 2);
        kurtosis = ((n + 1) * (n - 1) * (sampleKurt - 3 * (n - 1) / (n + 1))) / ((n - 2) * (n - 3));
      }
    }

    // 이상치 확인 (상자그림 기준: Q1 - 1.5*IQR 미만 또는 Q3 + 1.5*IQR 초과)
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const outliers = sorted.filter(v => v < lowerBound || v > upperBound);

    return {
      n,
      mean,
      median,
      mode,
      variance,
      stdDev,
      min,
      max,
      range,
      q1,
      q3,
      iqr,
      skewness,
      kurtosis,
      outliers,
      lowerBound,
      upperBound
    };
  },

  // 범주형 빈도분석
  calculateFrequency(data) {
    const total = data.length;
    const freqMap = {};
    data.forEach(v => {
      const key = v === null || v === undefined || v === "" ? "(결측값)" : String(v).trim();
      freqMap[key] = (freqMap[key] || 0) + 1;
    });

    const list = Object.keys(freqMap).map(key => {
      const count = freqMap[key];
      return {
        value: key,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      };
    });

    // 빈도순 정렬
    list.sort((a, b) => b.count - a.count);

    return { total, list };
  },

  // 교차표 생성 (cross-tabulation)
  calculateCrossTab(rowValues, colValues) {
    const rows = [...new Set(rowValues.map(v => String(v).trim()))].sort();
    const cols = [...new Set(colValues.map(v => String(v).trim()))].sort();

    // 2D 테이블 초기화
    const table = {};
    rows.forEach(r => {
      table[r] = {};
      cols.forEach(c => {
        table[r][c] = 0;
      });
    });

    let n = 0;
    for (let i = 0; i < rowValues.length; i++) {
      const r = String(rowValues[i]).trim();
      const c = String(colValues[i]).trim();
      if (table[r] && table[r][c] !== undefined) {
        table[r][c]++;
        n++;
      }
    }

    // 마진(합계) 계산
    const rowTotals = {};
    const colTotals = {};
    rows.forEach(r => {
      rowTotals[r] = cols.reduce((sum, c) => sum + table[r][c], 0);
    });
    cols.forEach(c => {
      colTotals[c] = rows.reduce((sum, r) => sum + table[r][c], 0);
    });

    return {
      rows,
      cols,
      table,
      rowTotals,
      colTotals,
      n
    };
  },

  // --- 2. 가정 자동 점검 (Assumption Checks) ---
  checkNormality(data) {
    // 왜도, 첨도 및 표본크기에 기반한 고교 수준 정규성 평가
    const stats = this.calculateDescriptive(data);
    if (!stats) return { passed: false, reason: "유효한 데이터가 없습니다." };

    if (stats.n < 10) {
      return {
        passed: false,
        n: stats.n,
        reason: `표본 크기(n=${stats.n})가 10 미만으로 너무 작아 정규성을 가정하기 어렵습니다. 비모수 검정을 적극 검토해야 합니다.`,
        severity: "danger"
      };
    } else if (stats.n >= 30) {
      return {
        passed: true,
        n: stats.n,
        reason: `표본 크기(n=${stats.n})가 30 이상으로, 중심극한정리에 의해 정규분포를 따른다고 가정할 수 있습니다.`,
        severity: "success"
      };
    } else {
      // 10 <= n < 30 : 왜도와 첨도로 판단
      const skewOk = Math.abs(stats.skewness) < 2.0;
      const kurtOk = Math.abs(stats.kurtosis) < 7.0;
      const passed = skewOk && kurtOk;

      return {
        passed,
        n: stats.n,
        skewness: stats.skewness.toFixed(3),
        kurtosis: stats.kurtosis.toFixed(3),
        reason: passed
          ? `표본 크기가 다소 작으나(n=${stats.n}), 왜도(${stats.skewness.toFixed(2)})와 첨도(${stats.kurtosis.toFixed(2)})가 기준치(왜도 절대값 2, 첨도 절대값 7) 이내에 있어 정규성 가정을 충족하는 편입니다.`
          : `표본 크기가 작고(n=${stats.n}), 왜도(${stats.skewness.toFixed(2)}) 또는 첨도(${stats.kurtosis.toFixed(2)})가 정규성 기준을 벗어나 정규성 가정이 위배될 가능성이 있습니다.`,
        severity: passed ? "warning" : "warning-danger"
      };
    }
  },

  checkHomoscedasticity(groups) {
    // groups: 각 집단의 숫자 배열들의 배열 [[1,2], [3,4], [5,6]]
    const activeGroups = groups.map(g => g.filter(v => typeof v === "number" && !isNaN(v))).filter(g => g && g.length > 1);
    if (activeGroups.length < 2) {
      return { passed: true, fValue: 0, pValue: 1, reason: "비교 집단이 부족합니다.", severity: "success" };
    }

    const k = activeGroups.length;
    const nList = activeGroups.map(g => g.length);
    
    // 각 집단 평균 계산
    const means = activeGroups.map(g => {
      const sum = g.reduce((a, b) => a + b, 0);
      return sum / g.length;
    });

    // Z_ij = |Y_ij - mean_i| 편차 절대값 변환
    const zGroups = activeGroups.map((g, i) => g.map(v => Math.abs(v - means[i])));

    // zGroups에 대해 일원분산분석(One-way ANOVA) 수행하여 F값과 p-value 계산
    let nTotal = 0;
    let grandSum = 0;
    const zMeans = [];
    const zNs = [];

    zGroups.forEach(zg => {
      const n = zg.length;
      const sum = zg.reduce((a, b) => a + b, 0);
      zNs.push(n);
      zMeans.push(sum / n);
      nTotal += n;
      grandSum += sum;
    });

    const grandMean = grandSum / nTotal;

    // 집단 간 제곱합 (SS Between)
    let ssBetween = 0;
    for (let i = 0; i < k; i++) {
      ssBetween += zNs[i] * Math.pow(zMeans[i] - grandMean, 2);
    }

    // 전체 제곱합 (SS Total)
    let ssTotal = 0;
    zGroups.forEach(zg => {
      zg.forEach(v => {
        ssTotal += Math.pow(v - grandMean, 2);
      });
    });

    // 집단 내 제곱합 (SS Within)
    const ssWithin = ssTotal - ssBetween;
    const dfBetween = k - 1;
    const dfWithin = nTotal - k;

    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;

    const fValue = msWithin > 0 ? msBetween / msWithin : 0;
    // F-분포의 CDF 계산 (jStat 라이브러리 사용)
    const pValue = 1 - jStat.centralF.cdf(fValue, dfBetween, dfWithin);

    // 유의확률 p-value가 0.05 이상이면 등분산성 가정을 충족함 (차이가 없음)
    const passed = pValue >= 0.05;

    return {
      passed,
      fValue,
      pValue,
      dfBetween,
      dfWithin,
      reason: passed
        ? `르빈의 등분산 검정 결과, 집단 간 분산의 차이가 통계적으로 유의하지 않아 등분산 가정을 충족합니다. (F = ${fValue.toFixed(3)}, p = ${pValue.toFixed(4)} ≥ 0.05)`
        : `르빈의 등분산 검정 결과, 집단 간 분산의 차이가 유의하여 등분산 가정이 위배되었을 수 있습니다. (F = ${fValue.toFixed(3)}, p = ${pValue.toFixed(4)} < 0.05)`,
      severity: passed ? "success" : "warning"
    };
  },

  // --- 3. 추론 통계 (Inferential Statistics) ---

  // 3.1 신뢰구간 (Confidence Interval)
  estimateConfidenceInterval(data, confidenceLevel = 0.95) {
    const stats = this.calculateDescriptive(data);
    if (!stats || stats.n < 2) return null;

    const se = stats.stdDev / Math.sqrt(stats.n);
    const alpha = 1 - confidenceLevel;
    let marginOfError = 0;
    let zOrT = 0;
    let distribution = "";

    if (stats.n >= 30) {
      // Z-분포
      zOrT = jStat.normal.inv(1 - alpha / 2, 0, 1);
      marginOfError = zOrT * se;
      distribution = "Z-분포";
    } else {
      // t-분포 (자유도 df = n - 1)
      const df = stats.n - 1;
      zOrT = jStat.studentt.inv(1 - alpha / 2, df);
      marginOfError = zOrT * se;
      distribution = `t-분포(자유도=${df})`;
    }

    const lower = stats.mean - marginOfError;
    const upper = stats.mean + marginOfError;

    return {
      n: stats.n,
      mean: stats.mean,
      stdDev: stats.stdDev,
      se,
      confidenceLevel,
      distribution,
      criticalValue: zOrT,
      marginOfError,
      lower,
      upper
    };
  },

    // 3.2 독립표본 t-검정 (Independent Samples t-test)
  independentTTest(groupA, groupB) {
    const statsA = this.calculateDescriptive(groupA);
    const statsB = this.calculateDescriptive(groupB);

    if (!statsA || !statsB || statsA.n < 2 || statsB.n < 2) {
      return { error: "두 집단 모두 최소 2개 이상의 데이터가 필요합니다." };
    }

    const n1 = statsA.n;
    const n2 = statsB.n;
    const m1 = statsA.mean;
    const m2 = statsB.mean;
    const v1 = statsA.variance;
    const v2 = statsB.variance;

    // 등분산성 자동 체크도 함께 수행
    const homoscedasticity = this.checkHomoscedasticity([groupA, groupB]);

    // 1. 등분산 가정 (Equal Variance Assumed)
    const dfEqual = n1 + n2 - 2;
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / dfEqual;
    const sp = Math.sqrt(sp2);
    const tEqual = (m1 - m2) / (sp * Math.sqrt(1 / n1 + 1 / n2));
    const pValEqual = 2 * (1 - jStat.studentt.cdf(Math.abs(tEqual), dfEqual));
    const diffSeEqual = sp * Math.sqrt(1 / n1 + 1 / n2);
    const tCritEqual = jStat.studentt.inv(0.975, dfEqual);
    const ciLowerEqual = (m1 - m2) - tCritEqual * diffSeEqual;
    const ciUpperEqual = (m1 - m2) + tCritEqual * diffSeEqual;

    // 2. 등분산 미가정 (Equal Variance Not Assumed / Welch's t-test)
    const seWelch = Math.sqrt(v1 / n1 + v2 / n2);
    const tWelch = (m1 - m2) / seWelch;
    const dfWelch = Math.pow(v1 / n1 + v2 / n2, 2) / (Math.pow(v1 / n1, 2) / (n1 - 1) + Math.pow(v2 / n2, 2) / (n2 - 1));
    const pValWelch = 2 * (1 - jStat.studentt.cdf(Math.abs(tWelch), dfWelch));
    const tCritWelch = jStat.studentt.inv(0.975, dfWelch);
    const ciLowerWelch = (m1 - m2) - tCritWelch * seWelch;
    const ciUpperWelch = (m1 - m2) + tCritWelch * seWelch;

    // 효과크기 Cohen's d (합동 표준편차 기준)
    const spCombined = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
    const cohensD = spCombined > 0 ? (m1 - m2) / spCombined : 0;

    return {
      groupAInfo: { n: n1, mean: m1, stdDev: statsA.stdDev },
      groupBInfo: { n: n2, mean: m2, stdDev: statsB.stdDev },
      cohensD: Math.abs(cohensD),
      diff: m1 - m2,
      homoscedasticity,
      equalVariance: {
        tValue: tEqual,
        df: dfEqual,
        pValue: pValEqual,
        ciLower: ciLowerEqual,
        ciUpper: ciUpperEqual
      },
      unequalVariance: {
        tValue: tWelch,
        df: dfWelch,
        pValue: pValWelch,
        ciLower: ciLowerWelch,
        ciUpper: ciUpperWelch
      }
    };
  },

  // 3.3 대응표본 t-검정 (Paired Samples t-test)
  pairedTTest(preData, postData) {
    if (preData.length !== postData.length) {
      return { error: "대응되는 두 변수의 데이터 개수(쌍)가 일치해야 합니다." };
    }

    const n = preData.length;
    if (n < 2) return { error: "최소 2쌍 이상의 데이터가 필요합니다." };

    const diffs = [];
    const cleanPre = [];
    const cleanPost = [];
    for (let i = 0; i < n; i++) {
      const vPre = parseFloat(preData[i]);
      const vPost = parseFloat(postData[i]);
      if (!isNaN(vPre) && !isNaN(vPost)) {
        diffs.push(vPost - vPre); // 사후 - 사전 차이
        cleanPre.push(vPre);
        cleanPost.push(vPost);
      }
    }

    const diffStats = this.calculateDescriptive(diffs);
    if (!diffStats || diffStats.n < 2) {
      return { error: "유효한 차이값 쌍이 부족합니다." };
    }

    const actualN = diffStats.n;
    const meanDiff = diffStats.mean;
    const stdDevDiff = diffStats.stdDev;
    const seDiff = stdDevDiff / Math.sqrt(actualN);

    // t 통계량 및 p-value
    const t = meanDiff / seDiff;
    const df = actualN - 1;
    const pVal = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

    // 효과크기 Cohen's dz (차이의 표준편차 기준)
    const cohensDz = stdDevDiff > 0 ? meanDiff / stdDevDiff : 0;

    // 95% 신뢰구간
    const tCrit = jStat.studentt.inv(0.975, df);
    const ciLower = meanDiff - tCrit * seDiff;
    const ciUpper = meanDiff + tCrit * seDiff;

    // 대응표본 상관관계 계산 (Pearson)
    let correlation = { r: 0, pValue: 1 };
    if (actualN >= 3) {
      const corrResult = this.correlationAnalysis(cleanPre, cleanPost);
      if (!corrResult.error) {
        correlation = {
          r: corrResult.correlationCoefficient,
          pValue: corrResult.pValue
        };
      }
    } else if (actualN === 2) {
      correlation = { r: 1.0, pValue: 1.0 };
    }

    return {
      method: "대응표본 t-검정",
      n: actualN,
      meanDiff,
      stdDevDiff,
      seDiff,
      tValue: t,
      df,
      pValue: pVal,
      cohensD: Math.abs(cohensDz), // 대응표본의 Cohen's dz
      ciLower,
      ciUpper,
      correlation
    };
  },

  // 3.X 일표본 t-검정 (One Sample t-test)
  oneSampleTTest(data, testValue) {
    const stats = this.calculateDescriptive(data);
    if (!stats || stats.n < 2) {
      return { error: "최소 2개 이상의 유효한 데이터가 필요합니다." };
    }

    const n = stats.n;
    const mean = stats.mean;
    const stdDev = stats.stdDev;
    const se = stdDev / Math.sqrt(n);

    // t 통계량 및 p-value
    const diff = mean - testValue;
    const t = se > 0 ? diff / se : 0;
    const df = n - 1;
    const pVal = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

    // 효과크기 Cohen's d
    const cohensD = stdDev > 0 ? diff / stdDev : 0;

    // 95% 신뢰구간
    const tCrit = jStat.studentt.inv(0.975, df);
    const ciLower = diff - tCrit * se;
    const ciUpper = diff + tCrit * se;

    return {
      method: "일표본 t-검정",
      n,
      mean,
      stdDev,
      se,
      testValue,
      diff,
      tValue: t,
      df,
      pValue: pVal,
      cohensD: Math.abs(cohensD),
      ciLower,
      ciUpper
    };
  },

  // 3.4 일원분산분석 (One-way ANOVA)
  oneWayAnova(groupDataMap) {
    // groupDataMap: { "A": [1,2,3], "B": [4,5], "C": [7,8,9] }
    const groupNames = Object.keys(groupDataMap);
    const k = groupNames.length;
    if (k < 3) {
      return { error: "일원분산분석을 수행하려면 최소 3개 이상의 집단이 필요합니다." };
    }

    const groups = groupNames.map(name => {
      return groupDataMap[name].map(v => parseFloat(v)).filter(v => !isNaN(v));
    });

    // 데이터 크기 검증
    for (let i = 0; i < k; i++) {
      if (groups[i].length < 2) {
        return { error: `집단 '${groupNames[i]}'의 데이터 개수가 최소 2개 이상이어야 합니다.` };
      }
    }

    // 등분산성 점검
    const homoscedasticity = this.checkHomoscedasticity(groups);

    // ANOVA 연산
    let nTotal = 0;
    let grandSum = 0;
    const groupMeans = [];
    const groupNs = [];
    const groupVars = [];

    groups.forEach((g, idx) => {
      const n = g.length;
      const sum = g.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const variance = ss.sampleVariance(g);

      groupNs.push(n);
      groupMeans.push(mean);
      groupVars.push(variance);
      nTotal += n;
      grandSum += sum;
    });

    const grandMean = grandSum / nTotal;

    // SS Total
    let ssTotal = 0;
    groups.forEach(g => {
      g.forEach(v => {
        ssTotal += Math.pow(v - grandMean, 2);
      });
    });

    // SS Between (집단 간)
    let ssBetween = 0;
    for (let i = 0; i < k; i++) {
      ssBetween += groupNs[i] * Math.pow(groupMeans[i] - grandMean, 2);
    }

    // SS Within (집단 내)
    const ssWithin = ssTotal - ssBetween;

    const dfBetween = k - 1;
    const dfWithin = nTotal - k;
    const dfTotal = nTotal - 1;

    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;

    const fValue = msWithin > 0 ? msBetween / msWithin : 0;
    const pValue = 1 - jStat.centralF.cdf(fValue, dfBetween, dfWithin);
    
    // 효과크기 에타제곱 (eta squared)
    const etaSquared = ssTotal > 0 ? ssBetween / ssTotal : 0;

    // --- 사후검정 도우미 함수 ---
    function getDuncanCriticalValue(r, df) {
      const table = {
        2:  [6.08, 6.08, 6.08, 6.08, 6.08, 6.08, 6.08, 6.08, 6.08],
        5:  [3.64, 3.74, 3.79, 3.83, 3.85, 3.86, 3.87, 3.87, 3.87],
        10: [3.15, 3.30, 3.37, 3.43, 3.46, 3.47, 3.47, 3.47, 3.47],
        20: [2.95, 3.10, 3.18, 3.25, 3.28, 3.30, 3.31, 3.31, 3.32],
        30: [2.89, 3.04, 3.12, 3.20, 3.24, 3.26, 3.27, 3.28, 3.29],
        60: [2.83, 2.98, 3.08, 3.14, 3.18, 3.21, 3.22, 3.24, 3.25],
        120:[2.80, 2.95, 3.05, 3.12, 3.16, 3.18, 3.20, 3.21, 3.22],
        9999:[2.77, 2.92, 3.02, 3.09, 3.13, 3.15, 3.17, 3.18, 3.19]
      };
      const dfs = [2, 5, 10, 20, 30, 60, 120, 9999];
      let targetDf = 9999;
      for (let i = 0; i < dfs.length; i++) {
        if (df <= dfs[i]) {
          targetDf = dfs[i];
          break;
        }
      }
      const row = table[targetDf];
      const rIndex = Math.min(Math.max(2, r), 10) - 2;
      return row[rIndex];
    }

    function getTukeyCriticalValue(numK, df) {
      const table = {
        2:  [8.33, 9.80, 10.88, 11.73, 12.43, 13.03, 13.54, 13.99],
        5:  [4.60, 5.22, 5.67, 6.03, 6.33, 6.58, 6.80, 6.99],
        10: [3.88, 4.33, 4.65, 4.91, 5.12, 5.30, 5.46, 5.60],
        20: [3.58, 3.96, 4.23, 4.45, 4.62, 4.77, 4.90, 5.01],
        30: [3.49, 3.85, 4.10, 4.30, 4.46, 4.60, 4.72, 4.82],
        60: [3.40, 3.74, 3.98, 4.16, 4.31, 4.44, 4.55, 4.65],
        120:[3.36, 3.68, 3.92, 4.10, 4.24, 4.36, 4.47, 4.56],
        9999:[3.31, 3.63, 3.86, 4.03, 4.17, 4.29, 4.39, 4.47]
      };
      const dfs = [2, 5, 10, 20, 30, 60, 120, 9999];
      let targetDf = 9999;
      for (let i = 0; i < dfs.length; i++) {
        if (df <= dfs[i]) {
          targetDf = dfs[i];
          break;
        }
      }
      const row = table[targetDf];
      const kIndex = Math.min(Math.max(3, numK), 10) - 3;
      return row[kIndex];
    }

    // 평균 기준 정렬 리스트 생성 (Duncan MRT 용)
    const sortedGroups = groupNames.map((name, idx) => ({
      name,
      mean: groupMeans[idx]
    })).sort((a, b) => a.mean - b.mean);

    // 사후검정 비교 리스트 생성
    const duncanPH = [];
    const scheffePH = [];
    const tukeyPH = [];

    const fCrit = jStat.centralF.inv(0.95, dfBetween, dfWithin);

    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        const nameA = groupNames[i];
        const nameB = groupNames[j];
        const meanA = groupMeans[i];
        const meanB = groupMeans[j];
        const nA = groupNs[i];
        const nB = groupNs[j];

        const diff = meanA - meanB;
        const absDiff = Math.abs(diff);
        const se = Math.sqrt((msWithin / 2) * (1 / nA + 1 / nB));

        // 1. Duncan 검정
        const idxA = sortedGroups.findIndex(g => g.name === nameA);
        const idxB = sortedGroups.findIndex(g => g.name === nameB);
        const r = Math.abs(idxA - idxB) + 1;
        const qDuncan = getDuncanCriticalValue(r, dfWithin);
        const lsr = qDuncan * se;
        const isDuncanSig = absDiff > lsr;
        duncanPH.push({
          comparison: `${nameA} vs ${nameB}`,
          diff,
          criticalRange: lsr,
          isSignificant: isDuncanSig
        });

        // 2. Scheffe 검정
        const cdScheffe = Math.sqrt(2 * dfBetween * fCrit) * se;
        const isScheffeSig = absDiff > cdScheffe;
        const fObs = (absDiff * absDiff) / (msWithin * (1 / nA + 1 / nB));
        const scheffeP = 1 - jStat.centralF.cdf(fObs / dfBetween, dfBetween, dfWithin);
        scheffePH.push({
          comparison: `${nameA} vs ${nameB}`,
          diff,
          criticalRange: cdScheffe,
          pValue: scheffeP,
          isSignificant: isScheffeSig
        });

        // 3. Tukey-Kramer 검정
        const qTukey = getTukeyCriticalValue(k, dfWithin);
        const hsd = qTukey * se;
        const isTukeySig = absDiff > hsd;
        
        // Bonferroni 보정 p값 활용
        const tVal = diff / Math.sqrt(msWithin * (1 / nA + 1 / nB));
        const rawP = 2 * (1 - jStat.studentt.cdf(Math.abs(tVal), dfWithin));
        const numComparisons = (k * (k - 1)) / 2;
        const adjustedP = Math.min(1.0, rawP * numComparisons);

        tukeyPH.push({
          comparison: `${nameA} vs ${nameB}`,
          diff,
          criticalRange: hsd,
          pValue: adjustedP,
          isSignificant: isTukeySig
        });
      }
    }

    return {
      method: "일원분산분석 (One-way ANOVA)",
      groups: groupNames.map((name, idx) => ({
        name,
        n: groupNs[idx],
        mean: groupMeans[idx],
        stdDev: Math.sqrt(groupVars[idx])
      })),
      dfBetween,
      dfWithin,
      dfTotal,
      ssBetween,
      ssWithin,
      ssTotal,
      msBetween,
      msWithin,
      fValue,
      pValue,
      etaSquared,
      homoscedasticity,
      postHoc: {
        duncan: duncanPH,
        scheffe: scheffePH,
        tukey: tukeyPH
      }
    };
  },

  // 3.5 카이제곱 독립성/적합도 검정 (Chi-Square Test)
  chiSquareTest(observed, expected = null, type = "independence") {
    // type: "goodness" (적합도) 또는 "independence" (독립성)
    if (type === "goodness") {
      const n = observed.length;
      if (n < 2) return { error: "적합도 검정을 위해 최소 2개 이상의 범주가 필요합니다." };
      
      const totalObs = observed.reduce((a, b) => a + b, 0);
      let expValues = [];
      if (!expected) {
        // 기본값: 균등 분포
        expValues = Array(n).fill(totalObs / n);
      } else {
        const totalExpProb = expected.reduce((a, b) => a + b, 0);
        expValues = expected.map(p => (p / totalExpProb) * totalObs);
      }

      let chi2 = 0;
      let lowExpectedCells = 0;
      for (let i = 0; i < n; i++) {
        if (expValues[i] < 5) lowExpectedCells++;
        chi2 += Math.pow(observed[i] - expValues[i], 2) / expValues[i];
      }

      const df = n - 1;
      const pVal = 1 - jStat.chisquare.cdf(chi2, df);
      const lowCellPercent = (lowExpectedCells / n) * 100;

      return {
        method: "카이제곱 적합도 검정",
        chi2Value: chi2,
        df,
        pValue: pVal,
        observed,
        expected: expValues,
        warning: lowCellPercent > 20 ? "기대빈도가 5 미만인 범주가 20%를 초과하여 결과의 신뢰도가 떨어질 수 있습니다." : null
      };

    } else {
      // 독립성 검정
      // observed: 2차원 빈도 배열 [[n11, n12], [n21, n22]]
      const r = observed.length;
      const c = observed[0].length;
      if (r < 2 || c < 2) return { error: "독립성 검정을 위해 최소 2x2 교차표가 필요합니다." };

      const rowTotals = Array(r).fill(0);
      const colTotals = Array(c).fill(0);
      let grandTotal = 0;

      for (let i = 0; i < r; i++) {
        for (let j = 0; j < c; j++) {
          rowTotals[i] += observed[i][j];
          colTotals[j] += observed[i][j];
          grandTotal += observed[i][j];
        }
      }

      let chi2 = 0;
      let lowExpectedCells = 0;
      const expectedMatrix = [];

      for (let i = 0; i < r; i++) {
        expectedMatrix[i] = [];
        for (let j = 0; j < c; j++) {
          const exp = (rowTotals[i] * colTotals[j]) / grandTotal;
          expectedMatrix[i][j] = exp;
          if (exp < 5) lowExpectedCells++;
          
          if (exp > 0) {
            chi2 += Math.pow(observed[i][j] - exp, 2) / exp;
          }
        }
      }

      const df = (r - 1) * (c - 1);
      const pVal = 1 - jStat.chisquare.cdf(chi2, df);
      const lowCellPercent = (lowExpectedCells / (r * c)) * 100;

      // 효과크기 Cramér's V
      const kMin = Math.min(r - 1, c - 1);
      const cramersV = grandTotal > 0 && kMin > 0 ? Math.sqrt(chi2 / (grandTotal * kMin)) : 0;

      return {
        method: "카이제곱 독립성 검정",
        chi2Value: chi2,
        df,
        pValue: pVal,
        cramersV,
        observed,
        expected: expectedMatrix,
        warning: lowCellPercent > 20 ? `기대빈도가 5 미만인 셀이 ${lowCellPercent.toFixed(1)}%로 전체의 20%를 초과합니다. 표본이 다소 부족할 수 있습니다.` : null
      };
    }
  },

  // 3.6 상관분석 (Pearson Correlation)
  correlationAnalysis(xData, yData) {
    const validPairsX = [];
    const validPairsY = [];

    for (let i = 0; i < xData.length; i++) {
      const vx = parseFloat(xData[i]);
      const vy = parseFloat(yData[i]);
      if (!isNaN(vx) && !isNaN(vy)) {
        validPairsX.push(vx);
        validPairsY.push(vy);
      }
    }

    const n = validPairsX.length;
    if (n < 3) return { error: "상관 분석을 수행하려면 최소 3개 이상의 유효한 관측치 쌍이 필요합니다." };

    const r = ss.sampleCorrelation(validPairsX, validPairsY);
    
    // 유의성 검정 t 통계량
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const df = n - 2;
    const pVal = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));

    // r의 95% 신뢰구간 (Fisher Z-변환 이용)
    let ciLower = null;
    let ciUpper = null;
    if (Math.abs(r) < 1.0 && n > 3) {
      const z = 0.5 * Math.log((1 + r) / (1 - r));
      const seZ = 1 / Math.sqrt(n - 3);
      const zCrit = jStat.normal.inv(0.975, 0, 1);
      const zLower = z - zCrit * seZ;
      const zUpper = z + zCrit * seZ;
      ciLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
      ciUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);
    }

    return {
      method: "피어슨 상관분석",
      n,
      correlationCoefficient: r,
      tValue: t,
      df,
      pValue: pVal,
      ciLower,
      ciUpper
    };
  },

  // 3.7 단순선형회귀분석 (Simple Linear Regression)
  linearRegression(xData, yData) {
    const validPairsX = [];
    const validPairsY = [];

    for (let i = 0; i < xData.length; i++) {
      const vx = parseFloat(xData[i]);
      const vy = parseFloat(yData[i]);
      if (!isNaN(vx) && !isNaN(vy)) {
        validPairsX.push(vx);
        validPairsY.push(vy);
      }
    }

    const n = validPairsX.length;
    if (n < 3) return { error: "회귀분석을 위해 최소 3개 이상의 유효한 쌍이 필요합니다." };

    // regression 계산 (simple-statistics 사용)
    // ss.linearRegression은 { m: 기울기, b: 절편 } 반환
    const points = validPairsX.map((x, idx) => [x, validPairsY[idx]]);
    const regression = ss.linearRegression(points);
    const slope = regression.m;
    const intercept = regression.b;

    // ANOVA 및 유의성 검정을 위한 계산
    const meanX = ss.mean(validPairsX);
    const meanY = ss.mean(validPairsY);

    let ssTot = 0;
    let ssReg = 0;
    let ssRes = 0;
    let sumSqX = 0;

    for (let i = 0; i < n; i++) {
      const x = validPairsX[i];
      const y = validPairsY[i];
      const predY = slope * x + intercept;

      ssTot += Math.pow(y - meanY, 2);
      ssReg += Math.pow(predY - meanY, 2);
      ssRes += Math.pow(y - predY, 2);
      sumSqX += Math.pow(x - meanX, 2);
    }

    const dfReg = 1;
    const dfRes = n - 2;
    const dfTot = n - 1;

    const msReg = ssReg / dfReg;
    const msRes = ssRes / dfRes;

    const fValue = msRes > 0 ? msReg / msRes : 0;
    const pValueF = 1 - jStat.centralF.cdf(fValue, dfReg, dfRes);

    const r2 = ssTot > 0 ? ssReg / ssTot : 0;

    // 회귀계수(기울기)의 t-검정
    const seSlope = sumSqX > 0 ? Math.sqrt(msRes / sumSqX) : 0;
    const tValue = seSlope > 0 ? slope / seSlope : 0;
    const pValueSlope = 2 * (1 - jStat.studentt.cdf(Math.abs(tValue), dfRes));

    return {
      method: "단순선형회귀분석",
      n,
      slope,
      intercept,
      rSquared: r2,
      adjustedRSquared: 1 - ((1 - r2) * (n - 1)) / (n - 2),
      seSlope,
      tValue,
      pValueSlope,
      fValue,
      pValueF,
      dfReg,
      dfRes,
      ssReg,
      ssRes,
      ssTot
    };
  },

  multipleLinearRegression(xDataList, yData, xNames) {
    // xDataList: 2차원 수치 배열, 각 행은 표본 관측치이고, 열은 X 변수들
    // yData: 1차원 수치 배열 (종속변수 Y)
    // xNames: X 변수들의 한글 명칭 배열
    const n = yData.length;
    const p = xNames.length; 
    
    if (n < p + 2) {
      return { error: `표본 크기(N=${n})가 예측 요인의 개수(${p})에 비해 너무 작습니다. 더 많은 표본이 필요합니다.` };
    }
    
    // X 행렬 구성 (상수항 추가를 위해 첫 번째 열은 1)
    const X = [];
    for (let i = 0; i < n; i++) {
      X[i] = [1];
      for (let j = 0; j < p; j++) {
        X[i].push(xDataList[i][j]);
      }
    }
    
    // Y 열벡터 구성 (n x 1)
    const Y = yData.map(y => [y]);
    
    try {
      const XT = Matrix.transpose(X);
      const XTX = Matrix.multiply(XT, X);
      const XTX_inv = Matrix.invert(XTX);
      const XTY = Matrix.multiply(XT, Y);
      const Beta = Matrix.multiply(XTX_inv, XTY); 
      
      const coefficients = Beta.map(b => b[0]); // [Intercept, b1, b2, ... bp]
      
      // 잔차 제곱합 계산
      let ssRes = 0;
      for (let i = 0; i < n; i++) {
        let pred = coefficients[0];
        for (let j = 0; j < p; j++) {
          pred += coefficients[j + 1] * xDataList[i][j];
        }
        ssRes += Math.pow(yData[i] - pred, 2);
      }
      
      // 총 제곱합 계산
      const meanY = yData.reduce((a, b) => a + b, 0) / n;
      let ssTot = 0;
      for (let i = 0; i < n; i++) {
        ssTot += Math.pow(yData[i] - meanY, 2);
      }
      
      const ssReg = ssTot - ssRes;
      
      const dfReg = p;
      const dfRes = n - p - 1;
      const dfTot = n - 1;
      
      const msReg = ssReg / dfReg;
      const msRes = ssRes / dfRes;
      
      const fValue = msRes > 0 ? msReg / msRes : 0;
      const pValueF = 1 - jStat.centralF.cdf(fValue, dfReg, dfRes);
      
      const r2 = ssTot > 0 ? ssReg / ssTot : 0;
      const adjustedRSquared = 1 - ((1 - r2) * (n - 1)) / (n - p - 1);
      
      // 각 독립변수의 표본표준편차 구하기 (표준화계수용)
      const stdDevY = ss.sampleStandardDeviation(yData);
      const stdDevXList = [];
      for (let j = 0; j < p; j++) {
        const xCol = xDataList.map(row => row[j]);
        stdDevXList.push(ss.sampleStandardDeviation(xCol));
      }
      
      // 회귀계수들의 표준오차(SE), t값, p값 계산
      const coeffResults = [];
      // 1. 상수항 (Intercept)
      const seIntercept = Math.sqrt(msRes * XTX_inv[0][0]);
      const tIntercept = seIntercept > 0 ? coefficients[0] / seIntercept : 0;
      const pIntercept = 2 * (1 - jStat.studentt.cdf(Math.abs(tIntercept), dfRes));
      coeffResults.push({
        name: "(상수 - Intercept)",
        b: coefficients[0],
        se: seIntercept,
        beta: null, 
        tValue: tIntercept,
        pValue: pIntercept
      });
      
      // 2. 각 독립변수 계수
      for (let j = 0; j < p; j++) {
        const idx = j + 1;
        const bVal = coefficients[idx];
        const seVal = Math.sqrt(msRes * XTX_inv[idx][idx]);
        const tVal = seVal > 0 ? bVal / seVal : 0;
        const pVal = 2 * (1 - jStat.studentt.cdf(Math.abs(tVal), dfRes));
        
        // 표준화계수 Beta = B * (stdDevX / stdDevY)
        const betaVal = stdDevY > 0 ? bVal * (stdDevXList[j] / stdDevY) : 0;
        
        coeffResults.push({
          name: xNames[j],
          b: bVal,
          se: seVal,
          beta: betaVal,
          tValue: tVal,
          pValue: pVal
        });
      }
      
      return {
        method: "다중선형회귀분석",
        n,
        p,
        rSquared: r2,
        adjustedRSquared,
        fValue,
        pValueF,
        dfReg,
        dfRes,
        dfTot,
        ssReg,
        ssRes,
        ssTot,
        msReg,
        msRes,
        coefficients: coeffResults
      };
    } catch (err) {
      return { error: err.message || "다중회귀분석 연산 중 오류가 발생했습니다." };
    }
  }
};
