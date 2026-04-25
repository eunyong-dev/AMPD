/** 공통 JSON 응답 함수 */
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * 시트의 탭(워크시트) 목록을 가져오는 API
 * GET /exec?sheetId=XXX&mode=listTabs
 */
function listTabs(sheetId) {
  var ss = SpreadsheetApp.openById(sheetId);
  var sheets = ss.getSheets();
  var result = sheets.map(function (sh) {
    return {
      name: sh.getName(), // 탭 이름
      gid: sh.getSheetId().toString(), // 탭 gid (문자열로)
    };
  });
  return jsonResponse({ tabs: result });
}

/**
 * GET API → 시트 데이터 읽기 (날짜 필터링 지원)
 * 예: /exec?sheetId=xxx&gid=0&fromDate=2025-10-17&toDate=2025-11-16
 */
function doGet(e) {
  try {
    var sheetId = e.parameter.sheetId;
    var mode = e.parameter.mode;
    var gid = e.parameter.gid;
    var fromDate = e.parameter.fromDate; // YYYY-MM-DD 형식
    var toDate = e.parameter.toDate; // YYYY-MM-DD 형식

    if (!sheetId) return jsonResponse({ error: 'sheetId required' });

    if (mode === 'listTabs') {
      return listTabs(sheetId);
    }

    var ss = SpreadsheetApp.openById(sheetId);
    var sheet;

    // gid로 시트 찾기
    if (gid !== null && gid !== undefined && gid !== '') {
      var sheets = ss.getSheets();
      sheet = null;
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getSheetId().toString() === gid.toString()) {
          sheet = sheets[i];
          break;
        }
      }
      if (!sheet) {
        return jsonResponse({ error: 'Sheet not found with gid: ' + gid });
      }
    } else {
      return jsonResponse({ error: 'gid required' });
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues(); // 원시 값
    var displayValues = dataRange.getDisplayValues(); // 서식이 적용된 표시 값

    if (!values.length) return jsonResponse({ rows: [] });

    var header = values.shift();
    var displayHeader = displayValues.shift();

    // 날짜 컬럼 찾기 (첫 번째 컬럼 또는 '날짜', 'date' 컬럼)
    var dateColumnIndex = 0; // 기본값: 첫 번째 컬럼
    var dateHeaderName = header[0];

    // '날짜' 또는 'date' 컬럼 찾기
    for (var i = 0; i < header.length; i++) {
      var headerName = String(header[i]).toLowerCase();
      if (headerName === '날짜' || headerName === 'date') {
        dateColumnIndex = i;
        dateHeaderName = header[i];
        break;
      }
    }

    // 날짜가 없는 행 필터링 및 날짜 범위 필터링
    var rows = values
      .map(function (row, rowIndex) {
        var obj = {};
        header.forEach(function (key, i) {
          // 표시 값 사용 (서식 포함)
          obj[key] = displayValues[rowIndex][i];
        });
        return obj;
      })
      .filter(function (row) {
        // 첫 번째 열(날짜 컬럼)의 값 확인
        var dateValue = row[dateHeaderName];

        // 날짜 값이 있고 비어있지 않으면 유지
        if (
          dateValue === null ||
          dateValue === undefined ||
          dateValue === '' ||
          String(dateValue).trim() === ''
        ) {
          return false;
        }

        // 날짜 범위 필터링
        if (fromDate || toDate) {
          var rowDate = parseDateFromSheet(dateValue);
          if (!rowDate) {
            // 날짜 파싱 실패 시 로그 출력 (디버깅용)
            console.log('Failed to parse date:', dateValue);
            return false;
          }

          // fromDate 체크: rowDate가 fromDate보다 작으면 제외 (fromDate 포함)
          if (fromDate) {
            var from = parseDateParameter(fromDate);
            if (!from) {
              console.log('Failed to parse fromDate:', fromDate);
              return false;
            }
            // rowDate가 from보다 작으면 제외 (from과 같거나 크면 포함)
            if (rowDate.getTime() < from.getTime()) {
              return false;
            }
          }

          // toDate 체크: rowDate가 toDate보다 크면 제외 (toDate 포함)
          if (toDate) {
            var to = parseDateParameter(toDate);
            if (!to) {
              console.log('Failed to parse toDate:', toDate);
              return false;
            }
            // rowDate가 to보다 크면 제외 (to와 같거나 작으면 포함)
            if (rowDate.getTime() > to.getTime()) {
              return false;
            }
          }
        }

        return true;
      });

    return jsonResponse({ rows: rows });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/**
 * 시트의 날짜 문자열을 Date 객체로 변환
 * "2025.11.1" 또는 "2025.11.1 (토)" 형식 지원
 * Date 객체도 지원 (Google Sheets의 원시 날짜 값)
 */
function parseDateFromSheet(dateStr) {
  if (!dateStr) return null;

  // Date 객체인 경우 직접 처리
  if (dateStr instanceof Date) {
    var date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  var str = String(dateStr);

  // "2025.11.1" 또는 "2025.11.1 (토)" 형식 파싱
  var match = str.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!match) {
    // 다른 형식 시도: "2025-11-01" 형식
    var dashMatch = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dashMatch) {
      var year = parseInt(dashMatch[1], 10);
      var month = parseInt(dashMatch[2], 10) - 1;
      var day = parseInt(dashMatch[3], 10);
      var date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      // 유효성 검사
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
      ) {
        return null;
      }
      return date;
    }
    return null;
  }

  var year = parseInt(match[1], 10);
  var month = parseInt(match[2], 10) - 1; // JavaScript Date는 0부터 시작
  var day = parseInt(match[3], 10);

  // 유효성 검사
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  var date = new Date(year, month, day);

  // 생성된 날짜가 유효한지 확인 (예: 2025-13-01 같은 잘못된 날짜 방지)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  // 시간을 00:00:00으로 설정하여 날짜만 비교
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * API 파라미터의 날짜 문자열을 Date 객체로 변환
 * "YYYY-MM-DD" 형식
 */
function parseDateParameter(dateStr) {
  if (!dateStr) return null;

  var parts = String(dateStr).split('-');
  if (parts.length !== 3) return null;

  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1; // JavaScript Date는 0부터 시작
  var day = parseInt(parts[2], 10);

  // 유효성 검사
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  var date = new Date(year, month, day);

  // 생성된 날짜가 유효한지 확인 (예: 2025-13-01 같은 잘못된 날짜 방지)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * POST API → 시트에 데이터 업서트(업데이트 또는 추가)
 * body(JSON):
 * {
 *    "rows": [
 *      {"date": "2025-11-15", "installs": 42, "revenue": 38.2},
 *      ...
 *    ]
 * }
 */
function doPost(e) {
  try {
    var sheetId = e.parameter.sheetId;
    var tab = e.parameter.tab || 'raw_data';
    var mode = e.parameter.mode;

    if (!sheetId) return jsonResponse({ error: 'sheetId required' });

    // 정렬 모드 처리
    if (mode === 'sort') {
      return sortSheetByDate(sheetId, tab);
    }

    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tab);
    if (!sheet) return jsonResponse({ error: 'Tab not found: ' + tab });

    var data = JSON.parse(e.postData.contents || '{}');
    var rows = data.rows || [];
    if (!rows.length) return jsonResponse({ error: 'No rows in body' });

    // HEADER 가져오기
    var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    var header = headerRange.getValues()[0];

    // 날짜 컬럼 찾기
    var dateColumnIndex = header.findIndex(function (h) {
      var name = String(h).toLowerCase();
      return name === 'date' || name === '날짜';
    });

    if (dateColumnIndex === -1) {
      return jsonResponse({
        error: '시트에 날짜를 추가해주세요',
        success: false,
      });
    }

    // 시트 모든 데이터 읽기
    var lastRow = sheet.getLastRow();
    var existingValues =
      lastRow > 1
        ? sheet.getRange(2, 1, lastRow - 1, header.length).getValues()
        : [];

    // 날짜 → 시트 row index(2부터 시작) 매핑
    var dateToRowIndex = {};
    existingValues.forEach(function (row, idx) {
      var dateVal = row[dateColumnIndex];
      if (dateVal) {
        var normalized = normalizeSheetDate(dateVal);
        if (normalized) {
          dateToRowIndex[normalized] = idx + 2; // 실제 row 번호 (헤더 +1)
        }
      }
    });

    var updateRows = 0;
    var appendRows = [];

    // 업데이트할 컬럼 인덱스 찾기 (date, Install, Revenue, Clicks만)
    var updateColumnIndices = [];
    var dataColumnIndices = []; // Install, Revenue, Clicks만 (날짜 제외)

    var updateColumnNames = [
      'date',
      'install',
      'revenue',
      'clicks',
      'installs', // 하위 호환성
      'revenue ltv', // 하위 호환성
      '날짜',
      '설치',
      '수익',
      '수익 ltv', // 하위 호환성
      '클릭',
    ];

    var dataColumnNames = [
      'install',
      'revenue',
      'clicks',
      'installs', // 하위 호환성
      'revenue ltv', // 하위 호환성
      '설치',
      '수익',
      '수익 ltv', // 하위 호환성
      '클릭',
    ];

    header.forEach(function (h, idx) {
      var headerName = String(h).toLowerCase().trim();
      if (updateColumnNames.indexOf(headerName) !== -1) {
        updateColumnIndices.push({
          index: idx + 1, // 1-based index
          name: h,
        });
        // 데이터 컬럼만 별도로 저장 (날짜 제외)
        if (dataColumnNames.indexOf(headerName) !== -1) {
          dataColumnIndices.push({
            index: idx + 1,
            name: h,
          });
        }
      }
    });

    // 비어있는 행 찾기 (날짜는 있지만 데이터 컬럼이 비어있는 행)
    var emptyRowIndices = {};
    existingValues.forEach(function (row, idx) {
      var dateVal = row[dateColumnIndex];
      if (dateVal) {
        var normalized = normalizeSheetDate(dateVal);
        if (normalized) {
          // 데이터 컬럼이 모두 비어있는지 확인
          var isEmpty = true;
          dataColumnIndices.forEach(function (colInfo) {
            var colValue = row[colInfo.index - 1]; // 0-based index
            if (
              colValue !== null &&
              colValue !== undefined &&
              colValue !== ''
            ) {
              var strValue = String(colValue).trim();
              if (strValue !== '') {
                isEmpty = false;
              }
            }
          });

          if (isEmpty) {
            emptyRowIndices[normalized] = idx + 2; // 실제 row 번호
          }
        }
      }
    });

    // 날짜 열이 비어있는 행 찾기 (A열이 비어있는 행)
    var emptyDateRowIndices = [];
    existingValues.forEach(function (row, idx) {
      var dateVal = row[dateColumnIndex];
      // 날짜 열이 비어있거나 null인 경우
      if (!dateVal || dateVal === '' || String(dateVal).trim() === '') {
        emptyDateRowIndices.push(idx + 2); // 실제 row 번호
      }
    });

    // 업데이트 및 추가 처리
    rows.forEach(function (rowObj) {
      var inputDate = rowObj['date'];
      if (!inputDate) return;

      var normalizedInput = normalizeIsoDate(inputDate);
      if (!normalizedInput) return;

      // 업데이트 대상 (날짜가 있는 행)
      if (dateToRowIndex[normalizedInput]) {
        var rowNum = dateToRowIndex[normalizedInput];

        // 업데이트할 컬럼만 개별적으로 업데이트 (함수 보존)
        updateColumnIndices.forEach(function (colInfo) {
          var colIndex = colInfo.index;
          var colName = colInfo.name;
          var value = rowObj[colName] ?? '';

          sheet.getRange(rowNum, colIndex).setValue(value);
        });

        updateRows++;
      }
      // 비어있는 행에 채우기 (날짜는 있지만 데이터가 비어있는 행)
      else if (emptyRowIndices[normalizedInput]) {
        var rowNum = emptyRowIndices[normalizedInput];

        // 데이터 컬럼만 업데이트 (날짜는 이미 있음)
        updateColumnIndices.forEach(function (colInfo) {
          var colIndex = colInfo.index;
          var colName = colInfo.name;
          var value = rowObj[colName] ?? '';

          sheet.getRange(rowNum, colIndex).setValue(value);
        });

        updateRows++;
      }
      // 날짜 열이 비어있는 행에 채우기 (A열이 비어있는 행)
      else if (emptyDateRowIndices.length > 0) {
        var rowNum = emptyDateRowIndices.shift(); // 첫 번째 비어있는 행 사용

        // 날짜와 데이터 모두 채우기
        updateColumnIndices.forEach(function (colInfo) {
          var colIndex = colInfo.index;
          var colName = colInfo.name;
          var value = rowObj[colName] ?? '';

          sheet.getRange(rowNum, colIndex).setValue(value);
        });

        updateRows++;
      }
      // 완전히 새로운 행 추가 (비어있는 행도 없을 때만)
      else {
        var rowArray = header.map(function (h) {
          return rowObj[h] ?? '';
        });

        appendRows.push(rowArray);
      }
    });

    // Append 실행
    if (appendRows.length > 0) {
      sheet
        .getRange(
          sheet.getLastRow() + 1,
          1,
          appendRows.length,
          appendRows[0].length
        )
        .setValues(appendRows);
    }

    // 업데이트 또는 추가가 있으면 정렬 수행
    if (updateRows > 0 || appendRows.length > 0) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var dataRange = sheet.getRange(
          2,
          1,
          lastRow - 1,
          sheet.getLastColumn()
        );
        var sortColumnIndex = dateColumnIndex + 1; // 1-based index
        dataRange.sort(sortColumnIndex);
      }
    }

    return jsonResponse({
      success: true,
      updated: updateRows,
      appended: appendRows.length,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/**
 * 시트를 날짜순으로 정렬
 * POST /exec?sheetId=XXX&tab=XXX&mode=sort
 */
function sortSheetByDate(sheetId, tab) {
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName(tab);
    if (!sheet) {
      return jsonResponse({ error: 'Tab not found: ' + tab });
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse({ success: true, message: 'No data to sort' });
    }

    // 헤더 행 제외하고 정렬 (2행부터 마지막 행까지)
    var dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());

    // 날짜 컬럼 찾기
    var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    var header = headerRange.getValues()[0];
    var dateColumnIndex = 1; // 기본값: 첫 번째 컬럼 (A열, 1-based index)

    for (var i = 0; i < header.length; i++) {
      var headerName = String(header[i]).toLowerCase();
      if (headerName === '날짜' || headerName === 'date') {
        dateColumnIndex = i + 1; // 1-based index
        break;
      }
    }

    // 날짜 컬럼 기준으로 오름차순 정렬
    dataRange.sort(dateColumnIndex);

    return jsonResponse({
      success: true,
      message: 'Sheet sorted by date',
      sortedRows: lastRow - 1,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

/** YYYY-MM-DD → ISO 날짜 정규화 */
function normalizeIsoDate(str) {
  var parts = String(str).split('-');
  if (parts.length !== 3) return null;
  return parts.join('-');
}

/** 시트 날짜 형식 → YYYY-MM-DD 로 정규화 */
function normalizeSheetDate(value) {
  if (typeof value === 'object' && value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  var match = String(value).match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (match) {
    return (
      match[1] +
      '-' +
      ('0' + match[2]).slice(-2) +
      '-' +
      ('0' + match[3]).slice(-2)
    );
  }
  // YYYY-MM-DD 형태면 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return value;
  }
  return null;
}
