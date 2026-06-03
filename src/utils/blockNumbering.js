// src/utils/blockNumbering.js
//
// 文件區塊階層編號 formatter（對齊 block-hierarchy-redesign-spec.md §5 / §5.1 / §5.2 / §5.3）。
// 純函式、前後端共用規格；後端為匯出（Word/PDF）標準答案，本檔為前端即時預覽的參考實作。
//
// 編號規則（§5）：
//   L1 (章節) 由 §5.3 對照表提供，不可編輯。
//   L2 → `C.i2`        dotted 累進（含章節 + 祖先）
//   L3 → `C.i2.i3`     dotted 累進
//   L4 → `(1)`         只顯示自身，阿拉伯數字
//   L5 → `(A)`         只顯示自身，大寫英文 bijective base-26
//   L6 → `(a)`         只顯示自身，小寫英文 bijective base-26
//   L7 → `(I)`         只顯示自身，大寫羅馬（不設上限）
//   L8 → `(i)`         只顯示自身，小寫羅馬（不設上限）
// 各層計數在「同一 parent 下」1-based。

/**
 * §5.3 / §20.2：L1 章節號對照（寫死，不可由 step_type 公式推導）。
 * 權威來源為後端 DocxDefinition_.py 的 DOCUMENT_STEP 排序；此表須與其 byte 對齊。
 * key = document_type，value = { [step_type]: 章節號 }。
 */
export const CHAPTER_NUMBER = {
  // 指示書：目的(1) / 製造流程(2,st0) / 管理條件(3,st1) / 製造條件參數一覽表(4,st2) / 異常處置(5,st3)
  0: { 0: 2, 1: 3, 2: 4, 3: 5 },
  // 式樣書：目的(1) / 製作條件規範(2,st4) / 製造參數一覽表(3,st5) / 適用品質與規格內容(4,st6) / 使用表單(5) / 其他(6,st7)
  1: { 4: 2, 5: 3, 6: 4, 7: 6 },
};

/**
 * 取章節號。找不到對照時回傳 null（呼叫端可決定如何 fallback）。
 * @param {number} documentType
 * @param {number} stepType
 * @returns {number|null}
 */
export function chapterNumber(documentType, stepType) {
  return CHAPTER_NUMBER?.[documentType]?.[stepType] ?? null;
}

/** 阿拉伯數字（L4）。 */
function toArabic(n) {
  return String(n);
}

/** Bijective base-26：1→A, 26→Z, 27→AA, 28→AB …（試算表式，§5.1）。回傳大寫。 */
function toBijectiveBase26(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** 標準羅馬數字（L7/L8），不設人為上限。回傳大寫。 */
function toRoman(n) {
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let s = '';
  let x = n;
  for (const [v, sym] of table) {
    while (x >= v) { s += sym; x -= v; }
  }
  return s;
}

/**
 * 每一層「自身 token」的格式器（depth → (1-based index) → 字串），不含外框 / 點號。
 * depth 2/3 回傳純數字（dotted 由 formatNodeLabel 組裝）；4–8 回傳括號內字元。
 */
function selfToken(depth, index) {
  switch (depth) {
    case 2:
    case 3: return toArabic(index);
    case 4: return toArabic(index);
    case 5: return toBijectiveBase26(index);              // 大寫英文
    case 6: return toBijectiveBase26(index).toLowerCase(); // 小寫英文
    case 7: return toRoman(index);                         // 大寫羅馬
    case 8: return toRoman(index).toLowerCase();           // 小寫羅馬
    default: return toArabic(index);
  }
}

/**
 * 組裝節點完整顯示編號。
 * @param {number} chapter      L1 章節號（由 §5.3 / chapterNumber() 取得）
 * @param {number} depth        節點深度，2..8
 * @param {number[]} pathIndices 由 L2 至本層的 1-based 兄弟索引，長度 = depth - 1
 *                               例：depth=3 的節點傳 [i2, i3]
 * @returns {string} 例：`2.1`、`2.1.3`、`(1)`、`(AA)`、`(IV)`
 */
export function formatNodeLabel(chapter, depth, pathIndices) {
  if (depth === 2) {
    return `${chapter}.${pathIndices[0]}`;
  }
  if (depth === 3) {
    return `${chapter}.${pathIndices[0]}.${pathIndices[1]}`;
  }
  // L4–L8：只顯示自身、加括號、不串祖先、不帶 step 前綴（§5）
  const own = pathIndices[depth - 2]; // pathIndices 從 L2 起算 → 本層在 index depth-2
  return `(${selfToken(depth, own)})`;
}

// 內部工具導出，供單元測試 / 後端對拍使用
export const __testing = { toBijectiveBase26, toRoman, selfToken };
