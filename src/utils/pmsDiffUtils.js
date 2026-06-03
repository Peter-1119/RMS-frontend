export const pmsTemplateDiffCheck = (oldTable, newTemplate) => {
  const isOldEmpty = !oldTable || oldTable.length <= 1;
  const isNewEmpty = !newTemplate || newTemplate.length <= 1;

  if (isOldEmpty && isNewEmpty) return { messages: [], mergedTable: newTemplate || [] };
  if (isOldEmpty && !isNewEmpty) return { messages: ["整個 PMS 表格已新增 (全新點位)"], mergedTable: newTemplate };
  if (!isOldEmpty && isNewEmpty) return { messages: ["整個 PMS 表格已全數刪除"], mergedTable: [] };

  const oldMap = new Map(oldTable.slice(1).map(row => [`${row[1]}-${row[2]}`, row]));
  const newMap = new Map(newTemplate.slice(1).map(row => [`${row[1]}-${row[2]}`, row]));

  const mergedTable = [newTemplate[0]]; // 先放入表頭
  const messages = [];

  for(const key of oldMap.keys()) { if (!newMap.has(key)) messages.push(`${key} 刪減`); }
  newTemplate.slice(1).forEach((row, index) => {
    const key = `${row[1]}-${row[2]}`;
    if (oldMap.has(key)) {
      const oldRow = oldMap.get(key);
      const mergedRow = [...row];
      for (let i = 3; i < mergedRow.length; i++) { mergedRow[i] = (oldRow[i] !== undefined) ? oldRow[i] : mergedRow[i]; }
      mergedRow[0] = String(index + 1); // 重新校正「項次」
      mergedTable.push(mergedRow);
    } else {
      messages.push(`${key} 新增`);
      row[0] = String(index + 1); // 給予新項次
      mergedTable.push(row);
    }
  })

  return { messages, mergedTable };
}

// ==========================================
// 2. Parameter Template 差異比對
// ==========================================
export const paramTemplateDiffCheck = (oldTables, newTemplate) => {
  const isOldEmpty = !oldTables || oldTables.length === 0 || !oldTables[0] || oldTables[0].length <= 1;
  const isNewEmpty = !newTemplate || newTemplate.length <= 1;

  if (isOldEmpty && isNewEmpty) return { messages: [], mergedTables: [] };
  if (isOldEmpty && !isNewEmpty) return { messages: ["整個 參數 表格已新增 (全新點位)"], mergedTables: oldTables ? oldTables.map(() => newTemplate) : [newTemplate] };
  if (!isOldEmpty && isNewEmpty) return { messages: ["整個 參數 表格已全數刪除"], mergedTables: [] };

  // Create item key for old template and new template
  const referenceOldTable = oldTables[0];
  const oldKeys = referenceOldTable.slice(1).map(row => `${row[0]}-${row[1]}`);
  const newKeys = newTemplate.slice(1).map(row => `${row[0]}-${row[1]}`);

  // Filter repeat item key
  const oldSet = new Set(oldKeys);
  const newSet = new Set(newKeys);
  const messages = [];

  // Pick add and remove item
  for (const key of newSet) { if (!oldSet.has(key)) messages.push(`「${key}」新增`); }
  for (const key of oldSet) { if (!newSet.has(key)) messages.push(`「${key}」刪減`); }

  const mergedTables = oldTables.map(oldTable => {
    const oldMap = new Map(oldTable.slice(1).map(row => [`${row[0]}-${row[1]}`, row]));
    const mergedTable = [newTemplate[0]]; // Put header first

    newTemplate.slice(1).forEach(row => {
      const key = `${row[0]}-${row[1]}`;
      if (oldMap.has(key)) {
        const oldRow = oldMap.get(key);
        const mergedRow = [...row];
        
        for (let i = 2; i < mergedRow.length; i++) { mergedRow[i] = (oldRow[i] !== undefined) ? oldRow[i] : mergedRow[i]; }
        mergedTable.push(mergedRow);
      } else { mergedTable.push([...row]); }
    });

    return mergedTable;
  });

  return { messages, mergedTables };
}

// ==========================================
// 3. Condition Template 差異比對
// ==========================================
export const condTemplateDiffCheck = (oldCondTables, newTemplate) => {
  // 過濾掉沒資料的 null (例如本來就沒條件表的區塊)
  const validOldTables = oldCondTables?.filter(t => t && t.condTemplate) || [];
  
  const isOldEmpty = validOldTables.length === 0;
  const isNewEmpty = !newTemplate || newTemplate.length === 0;

  // 防呆產生空 values 陣列，對齊 block 數量
  const emptyValuesArray = oldCondTables ? oldCondTables.map(() => []) : [[]];

  if (isOldEmpty && isNewEmpty) return { messages: [], mergedValues: [] };
  if (isOldEmpty && !isNewEmpty) return { messages: ["整個 條件表格 已新增 (全新條件)"], mergedValues: emptyValuesArray };
  if (!isOldEmpty && isNewEmpty) return { messages: ["整個 條件表格 已全數刪除"], mergedValues: [] };

  // 以第一個有效的舊表當作基準來計算增刪提示
  const oldHeaders = validOldTables[0].condTemplate.map(item => item.name);
  const newHeaders = newTemplate.map(item => item.name);
  const messages = [];

  const oldSet = new Set(oldHeaders);
  const newSet = new Set(newHeaders);

  for (const name of newHeaders) { if (!oldSet.has(name)) messages.push(`條件「${name}」新增`); }
  for (const name of oldHeaders) { if (!newSet.has(name)) messages.push(`條件「${name}」刪減`); }

  // ★ 核心邏輯：將每個 Block 的舊 values 陣列，對齊新的 headers
  const mergedValues = oldCondTables.map(oldTable => {
    if (!oldTable || !oldTable.values || oldTable.values.length === 0) return [];

    const localOldHeaders = oldTable.condTemplate.map(i => i.name);

    return oldTable.values.map(oldRow => {
      // 根據 newHeaders 的順序，找對應的舊值
      return newTemplate.map(newCol => {
        const oldIdx = localOldHeaders.indexOf(newCol.name);
        const val = oldIdx !== -1 ? (oldRow[oldIdx] || "") : "";

        // ★ 重點防呆：如果舊值不在新的選項 (parameters) 內，強制清空為空字串！
        if (val && newCol.parameters && !newCol.parameters.includes(val)) {
          return "";
        }
        return val;
      });
    });
  });

  return { messages, mergedValues };
}

// ==========================================
// 4. 製造參數 (Manufacturing PMS) 差異比對
// ==========================================
export const mfgPmsDiffCheck = (oldTable, newTemplate) => {
  const isOldEmpty = !oldTable || oldTable.length <= 1;
  const isNewEmpty = !newTemplate || newTemplate.length <= 1;

  // 狀況處理：皆空、從無到有、從有到無
  if (isOldEmpty && isNewEmpty) return { messages: [], mergedTable: null };
  if (isOldEmpty && !isNewEmpty) return { messages: ["整個 PMS 表格已新增 (機台原先無點位)"], mergedTable: newTemplate };
  if (!isOldEmpty && isNewEmpty) return { messages: ["整個 PMS 表格已全數刪除 (機台點位已被清空)"], mergedTable: null };

  // 使用「槽體-管理項目」作為唯一識別 Key (Index 0 和 Index 1)
  const oldMap = new Map(oldTable.slice(1).map(row => [`${row[0]}-${row[1]}`, row]));
  const newMap = new Map(newTemplate.slice(1).map(row => [`${row[0]}-${row[1]}`, row]));

  const mergedTable = [newTemplate[0]]; // 先放入表頭
  const messages = [];

  // 1. 找出被刪除的點位
  for(const key of oldMap.keys()) { 
    if (!newMap.has(key)) messages.push(`點位「${key}」已遭刪除`); 
  }
  
  // 2. 組合新表格，保留舊數值，並找出新增的點位
  newTemplate.slice(1).forEach((row) => {
    const key = `${row[0]}-${row[1]}`;
    if (oldMap.has(key)) {
      const oldRow = oldMap.get(key);
      const mergedRow = [...row];
      // 保留使用者先前填寫的值 (Index 2 ~ Index 7: 規格下限~說明)
      for (let i = 2; i < mergedRow.length; i++) { mergedRow[i] = (oldRow[i] !== undefined && oldRow[i] !== null) ? oldRow[i] : mergedRow[i]; }
      mergedTable.push(mergedRow);
    } else {
      messages.push(`點位「${key}」新增`);
      mergedTable.push([...row]); // 全新的一行空值
    }
  });

  return { messages, mergedTable };
}