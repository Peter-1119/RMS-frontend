import { CellSelection, selectedRect } from 'prosemirror-tables'

export const range = (a, b) => Array.from({length: b - a}, (v, i) => i + a);
export const getListText = cellNode => cellNode.attrs?.dropdownValue;
export const getText = cellNode => {
  const paragraphs = cellNode.content?.content || [];
  return paragraphs.map(pNode => { return (pNode.content?.content || []).map(textNode => textNode.text || '').join('') }).join('\n');
}
// Parse Excel
//  and Word format
export function parseExcelClipboard(str) {
  // 移除字串末端多餘的換行
  str = str.replace(/(\r\n|\n|\r)$/, '');

  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuote = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i+1];

    if (inQuote) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"'; // 雙引號跳脫
          i++; 
        } else {
          inQuote = false; // 結束引號
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === '\t') {
        currentRow.push(currentCell);
        currentCell = "";
      } else if (char === '\n' || (char === '\r')) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows;
}
// Handle copy process (Ctrl + C)
export function handleCopy(view, event) {
  const { state } = view;
  const sel = state.selection;
  if (!(sel instanceof CellSelection)) {
    const slice = sel.content();
    const text = slice.content.textBetween(0, slice.content.size, '\n', '\n');

    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', text);
      event.preventDefault(); // 阻止 Tiptap 預設行為
      return true;
    }
    return false;
  }

  const rect = selectedRect(state);
  const table = rect.table;
  const rows = [];

  for (let r = rect.top; r < rect.bottom; r++) {
    const rowNode = table.child(r);
    const cols = Array.from({length: rect.right - rect.left}, (_, i) => i + rect.left).map(col => {
      const text = getText(rowNode.child(col)).replace(/"/g, '""');
      return `"${text}"`;
    })
    rows.push(cols.join('\t')); // 欄位用 Tab 分隔
  }

  const clipboardText = rows.join('\r\n');

  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', clipboardText);
    event.preventDefault();
    return true;
  }
  return false;
}
// Handle paste process (Ctrl + V)
export function handlePaste(view, event) {
  const { state, dispatch } = view;
  const sel = state.selection;

  // =================================================================
  // 🌟 關鍵新增：檢查剪貼簿是否包含 HTML 格式的表格 (例如從 Word 複製)
  // =================================================================
  const htmlData = event.clipboardData?.getData('text/html');
  if (htmlData && htmlData.includes('<table')) {
    console.log("偵測到 HTML 表格，放手交給 Tiptap 原生引擎處理！");
    return false;  // 代表「取消攔截」，讓 Tiptap 底層的 ProseMirror 接管貼上行為。 它會自動解析 HTML 中的 colspan 和 rowspan，完美還原 Word 表格！
  }

  // =================================================================
  // 往下是你原本的 Excel 純文字解析邏輯 (沒有 HTML 時才觸發)
  // =================================================================
  const raw = event.clipboardData?.getData('text/plain') || '';
  if (!raw) return false;

  const matrix = parseExcelClipboard(raw);
  if (!matrix.length) return true;

  // 2. 定位 Table & Row / 計算起點
  let tableNode = view.state.doc.content.firstChild;
  let startRowIndex = view.state.selection.$anchor.path[4];
  let startColIndex = view.state.selection.$anchor.path[7];

  if (!(sel instanceof CellSelection)) {
    let textToPaste = raw;
    textToPaste = textToPaste.replace(/(\r\n|\n|\r)+$/, '');
    if (textToPaste.length >= 2 && textToPaste.startsWith('"') && textToPaste.endsWith('"')) {
       textToPaste = textToPaste.slice(1, -1);
       textToPaste = textToPaste.replace(/""/g, '"');
    }
    textToPaste = textToPaste.replace(/\r\n/g, '\n');
    dispatch(state.tr.insertText(textToPaste));

    const anchorPath = view.state.selection.$anchor.path;
    if(anchorPath && anchorPath.length > 4) {
      startRowIndex = anchorPath[4];
    }
    event.preventDefault(); 
    return true; 
  }

  const rect = selectedRect(state);
  startRowIndex = rect.top;
  startColIndex = rect.left;

  if (startRowIndex < 0 || startColIndex < 0) return false;

  let M = view.state.selection.$anchor.node(1).childCount;
  let N = view.state.selection.$anchor.node(2).childCount;

  let rowsPos = [1];
  for(let rowIndex = 0; rowIndex < tableNode.childCount; rowIndex++) rowsPos.push(rowsPos.at(-1) + tableNode.content.child(rowIndex).nodeSize);

  const targets = [];
  range(startRowIndex, startRowIndex + matrix.length).forEach((rowIndex, rIndex) => {
    if (rowIndex >= M) return;

    const rowNode = view.state.selection.$anchor.node(1).content.child(rowIndex);
    const rowPos = rowsPos[rowIndex];
    const cells = rowNode.content;
    const sourceRowData = matrix[rIndex] || [];

    const cellPos = [rowPos + 1];
    for(let index = 0; index < N - 1; index++) cellPos.push(cellPos.at(-1) + cells.child(index).nodeSize);

    range(startColIndex, startColIndex + sourceRowData.length).forEach((colIndex, cIndex) => {
      if (colIndex >= N) return;
      const cellNode = cells.child(colIndex);
      targets.push({ cellPos: cellPos[colIndex], cellSize: cellNode.nodeSize, type: cellNode.type, attrs: cellNode.attrs, text: sourceRowData[cIndex].toString() });
    })
  })

  if (targets.length === 0) return true;
  targets.sort((a, b) => b.cellPos - a.cellPos);

  let tr = state.tr;
  const schema = state.schema;

  for (const t of targets) {
    const lines = t.text.split('\n');
    const contentNodes = lines.map(line => schema.nodes.paragraph.create({}, line ? [schema.text(line)] : []));
    const newCell = t.type.create(t.attrs, contentNodes);
    tr = tr.replaceWith(t.cellPos, t.cellPos + t.cellSize, newCell);
  }

  if (tr.docChanged) {
    dispatch(tr.scrollIntoView());
  }

  event.preventDefault();
  return true;
}
export function handleTextPaste(view, event) {
  const text = event.clipboardData?.getData('text/plain');
  if (text) {
    view.dispatch(view.state.tr.insertText(text));
    event.preventDefault();
    return true;
  }
  return false;
}
// Handle mouse click for cell select
export function handleMousedown(view, event) {
  // 1. 忽略按鈕
  if (event.target.closest('button')) return false;
  
  // 2. 找出點擊的儲存格 DOM
  const cellDOM = event.target.closest('td, th');
  if (!cellDOM) return false;

  // 3. 取得該儲存格在文件中的位置
  const pos = view.posAtDOM(cellDOM, 0);
  if (pos === null) return false;

  const cellPos = view.state.doc.resolve(pos).before(3);

  // 4. 判斷是否為「第二次點擊」(進入編輯模式)
  const { selection } = view.state;
  if (selection instanceof CellSelection) {
      // 如果已經單選了這一格，且再次點擊 -> 放行事件，讓使用者進入編輯模式
      if (selection.$anchorCell.pos === cellPos && selection.$headCell.pos === cellPos) {
          return false; 
      }
  }

  // [情境：第一次點擊] -> 手動實作「點擊選取」與「拖曳框選」
  view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, view.state.doc.resolve(cellPos).pos)));
  if (!view.hasFocus()) view.focus();
  event.preventDefault();

  // C. 手動啟動拖曳監聽 (因為 preventDefault 殺死了插件的拖曳功能)
  const startAnchorPos = cellPos;
  let currentHeadPos = cellPos;

  const moveHandler = (moveEvent) => {
    // 1. 找出滑鼠當前位置下的 Cell
    const posObj = view.posAtCoords({ left: moveEvent.clientX, top: moveEvent.clientY });
    if (!posObj) return;

    const $currPos = view.state.doc.resolve(posObj.pos);
    let foundCellPos = $currPos.before(3);

    // 2. 如果滑鼠移到了新的格子，且位置合法，更新選取範圍
    if (foundCellPos !== null && foundCellPos !== currentHeadPos) {
      currentHeadPos = foundCellPos;
      try {
        // 使用 CellSelection.create 自動計算矩形範圍
        // 注意：必須確保 anchor 和 head 在同一個 table 內，否則 create 會報錯，這裡用 try-catch 保護
        const newSelection = CellSelection.create(view.state.doc, startAnchorPos, foundCellPos);
        view.dispatch(view.state.tr.setSelection(newSelection));
      } catch (e) {
        // 跨表格拖曳或結構錯誤時忽略
      }
    }
  };

  const upHandler = () => {
    // 滑鼠放開時，移除監聽
    window.removeEventListener('mousemove', moveHandler);
    window.removeEventListener('mouseup', upHandler);
  };

  // D. 掛載監聽器到 window (確保拖曳出表格也能感應)
  window.addEventListener('mousemove', moveHandler);
  window.addEventListener('mouseup', upHandler);

  // E. 回傳 true，表示我們完全接管了這個事件
  return true; 
}
export function handleKeyDown(view, event) {
  // --- [邏輯 A]：處理 Enter 鍵 ---
  if (event.key === 'Enter') {
    const anchor = view.state.selection.$anchor;
    // 加上可選連鍊保護，避免非表格區域出錯
    const rowIndex = anchor.path[4];
    const colIndex = anchor.path[7];

    if (rowIndex > 0  && [3, 4, 5, 6, 7].includes(colIndex)) {
      event.preventDefault();
      return true; // 攔截 Enter
    }
  }

  // --- [邏輯 B]：處理 Backspace / Delete (清除多個儲存格內容) ---
  if (['Backspace', 'Delete'].includes(event.key)) {
    const sel = view.state.selection;
    if (sel instanceof CellSelection) {
      const { state } = view; 
      let tr = state.tr; 
      const cells = [];
      
      sel.forEachCell((cell, pos) => {
        const isHeader = cell.type.name === 'tableHeader';
        const editable = cell.attrs?.contenteditable !== false;
        if (!isHeader && editable) cells.push({ cell, pos });
      });
      
      if (!cells.length) { event.preventDefault(); return true; }
      
      for (let i = cells.length - 1; i >= 0; i--) {
        const { cell, pos } = cells[i];
        const empty = state.schema.nodes.paragraph.create();
        const newCell = cell.type.create(cell.attrs, empty, cell.marks);
        tr = tr.replaceWith(pos, pos + cell.nodeSize, newCell);
      }
      
      view.dispatch(tr); event.preventDefault(); return true; // 攔截刪除鍵
    }
  }
  return false;
}

export function validateValueStatus(value, valueStatus) {
  let newValueStatus = [...valueStatus];
  
  // Compare relation from left to right
  const validIndices = [0, 1, 2, 3, 4].filter(i => newValueStatus[i] === 'valid');
  if (validIndices.length > 1){
    let maxSoFar = value[validIndices[0]];
    for (let i = 1; i < validIndices.length; i++) {
        const item = value[validIndices[i]];
        if (item <= maxSoFar) newValueStatus[validIndices[i]] = 'invalid';
        else maxSoFar = item;
    }

    let minSoFar = value[validIndices.at(-1)];;
    for (let i = validIndices.length - 2; i >= 0; i--) {
        const item = value[validIndices[i]];
        if (item >= minSoFar) newValueStatus[validIndices[i]] = 'invalid';
        else minSoFar = item;
    }
  }

  // Handle specific condition (when set up setting value then mark all columns is needed)
  if (newValueStatus.filter(status => status == 'empty').length != 5 && newValueStatus[2] == 'empty') {
    newValueStatus[2] = (newValueStatus[2] == 'invalid') ? 'invalid' : 'valid';
    if ((newValueStatus[0] != 'empty' || newValueStatus[1] != 'empty') && (newValueStatus[3] != 'empty' || newValueStatus[4] != 'empty')) { }
    else if ((newValueStatus[0] != 'empty' || newValueStatus[1] != 'empty') && (newValueStatus[3] == 'empty' || newValueStatus[4] == 'empty')) {
      newValueStatus[3] = (newValueStatus[3] == 'invalid') ? 'invalid' : 'valid';
      newValueStatus[4] = (newValueStatus[4] == 'invalid') ? 'invalid' : 'valid';
    }
    else if ((newValueStatus[3] != 'empty' || newValueStatus[4] != 'empty') && (newValueStatus[0] == 'empty' || newValueStatus[1] == 'empty')) {
      newValueStatus[0] = (newValueStatus[0] == 'invalid') ? 'invalid' : 'valid';
      newValueStatus[1] = (newValueStatus[1] == 'invalid') ? 'invalid' : 'valid';
    }
  }
  return newValueStatus;
}

export const parseParamTemplate = (table_json) => {
  if (!table_json) return null;
  const headers = table_json.content[0].content[0].content.map(cellNode => cellNode.content[0].content[0].text);
  const pms = table_json.content[0].content.slice(1).map(rowNode => [rowNode.content[0].content[0].content[0].text, rowNode.content[1].content[0].content[0].text, "", "", "", "", ""]);
  return [headers, ...pms];
}
export const parseParamTable = (table_json) => {
  if (!table_json) return null;
  console.log("table_json: ", table_json);
  const headers = table_json.content[0].content[0].content.map(cellNode => cellNode.content[0].content[0].text);
  const pms = table_json.content[0].content.slice(1).map(rowNode => rowNode.content.map(cellNode => cellNode?.content?.[0]?.content?.[0]?.text || ""));
  return [headers, ...pms];
}
export const parseCondTemplate = (table_json, with_value = false) => {
  if (!table_json) return null;
  const headers = table_json.content[0].content[0].content.slice(2).map(cellNode => cellNode.content[0].content[0].text);
  const opts = table_json.content[0].content[1].content.slice(2).map(cellNode => cellNode.attrs.dropdownOptions);
  const values = table_json.content[0].content.slice(1).map(rowNode => rowNode.content.slice(2).map(cellNode => getListText(cellNode)));
  return { condTemplate: headers.map((headerName, index) => ({ name: headerName, parameters: opts[index] })), values };
}