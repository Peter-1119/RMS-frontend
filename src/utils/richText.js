// src/utils/richText.js
//
// 主表帶樣式欄位（document_name / applyProject / purpose）存檔輔助。
// InlineColorEditor 的值（formJson.*）只有「在新系統編輯過」才非 null；
// 舊資料載入未編輯時為 null。為了讓後端「只渲染 tiptap doc、零 fallback」，
// 存檔時統一把純文字補成最簡 doc，使 form_attribute 永遠是 tiptap doc。

/** 純文字 → 最簡 tiptap doc（依換行切成多個 paragraph，保留行）。 */
export function plainToDoc(text) {
  const t = (text ?? '').toString();
  if (!t) return { type: 'doc', content: [{ type: 'paragraph' }] };
  const paragraphs = t.split('\n').map((line) => ({
    type: 'paragraph',
    ...(line ? { content: [{ type: 'text', text: line }] } : {}),
  }));
  return { type: 'doc', content: paragraphs };
}

/**
 * 有帶樣式的 JSON 就用它；否則用純文字補成 doc。
 * 讓 form_attribute 永遠是 tiptap doc，後端不需判斷有無樣式。
 */
export function richOrPlain(json, plain) {
  if (json && typeof json === 'object' && Object.keys(json).length) return json;
  return plainToDoc(plain);
}
