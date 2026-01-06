<template>
  <div class="combination-block">
    <div class="management-header-block">
      <label>{{ managementBlock.step }}.{{ managementBlock.tier }} 生產基本條件</label>
      <div class="management-operation-block">
        <div v-if="allowColor" class="menu color">
          <div class="font-color blue" @click="editor?.chain().focus().setColor('blue').run()"></div>
          <div class="font-color black" @click="editor?.chain().focus().setColor('null').run()"></div>
        </div>
        <button class="combination-btn add" @click="addRow(false)">往上插入</button>
        <button class="combination-btn add" @click="addRow(true)">往下插入</button>
        <button class="combination-btn del" @click="deleteRow">刪除該列</button>
      </div>
    </div>

    <div class="editor-wrapper">
      <!-- 沒有 PMS：只顯示提示文字 -->
      <p v-if="!hasPms" class="hint empty">選擇的機台無任何參數</p>

      <!-- 有 PMS 而且 editor 存在：顯示 Tiptap 表格 -->
      <EditorContent v-else-if="editor" :editor="editor" class="editor-content management-tiptap-editor"/>
    </div>

  </div>
</template>


<script>
import { EditorContent, Editor } from '@tiptap/vue-3'
import { Focus } from '@tiptap/extensions'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { History } from '@tiptap/extension-history'
import { CellSelection, selectedRect } from 'prosemirror-tables'

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })];

const CustomTableCell = TableCell.extend({
  addAttributes() { return { ...this.parent?.(), contenteditable: { default: true }, class: { default: null } }; },
})
const CustomTableHeader = TableHeader.extend({
  addAttributes() { return { ...this.parent?.(), contenteditable: { default: true } }; },
})
const CustomTableRow = TableRow.extend({
  addAttributes() { return { ...this.parent?.(), class: { default: null } }; },
})

const tableEditorExtensions = [
  Document.extend({ content: 'table' }), ...baseExt, Table,
  Focus.configure({ className: 'has-focus', mode: 'all' }),
  CustomTableRow, CustomTableHeader, CustomTableCell, History,
]

// 鎖定不可編輯欄（用在 from PMS 的 arrayData）
const lockCols = [0, 1, 2];

// --- 工具：取 cell 裡的純文字（給驗證用） ---
const extractText = cellNode => {
  const paragraphNode = cellNode.content?.content?.[0];
  if (!paragraphNode || paragraphNode.type.name !== 'paragraph') return '';
  return (paragraphNode.content?.content || []).map(textNode => textNode.text || '').join('').trim();
}

// --- 工具：取 cell 裡的純文字（給匯出 / copy 用） ---
const extractCellText = cellNode => {
  if (!cellNode || !cellNode.content || !cellNode.content.childCount) return '';
  const paragraphNode = cellNode.content.child(0);
  if (!paragraphNode || paragraphNode.type.name !== 'paragraph') return '';

  let text = '';
  paragraphNode.content.forEach(textNode => {
    if (textNode.text) text += textNode.text;
  })
  return text.trim();
}

export default {
  name: 'ManagementSpecificBlock',
  components: { EditorContent },
  props: {
    managementBlock: { type: Object, required: true },
    hasPms: { type: Boolean, default: true },
    allowColor: { type: Boolean, default: true },
  },
  data() {
    return {
      localBlockData: { ...this.managementBlock },
      editor: null,
      validateTimer: null, // 驗證用 timeout
      dirtyRows: new Set(), // 被改過的 row index
    }
  },
  mounted() {
    this.initOrReloadFromProps();
  },
  beforeUnmount() {
    if (this.validateTimer) clearTimeout(this.validateTimer);
    this.exportTableData(this.editor);
    if (this.editor) this.editor.destroy();
  },
  methods: {
    initOrReloadFromProps() {
      const blk = this.managementBlock || {};
      const data = blk.data || {};
      const jsonContent = data.jsonContent || null;
      const arrayData = Array.isArray(data.arrayData) ? data.arrayData : [];

      // ✅ 完全沒有內容（沒有草稿 json，也沒有 PMS arrayData）→ 不建立 editor
      //    只保留「選擇的機台無任何參數」提示
      if (!jsonContent && !arrayData.length) {
        if (this.editor) {
          this.editor.destroy();
          this.editor = null;
        }
        this.localBlockData = { ...blk };
        return;
      }

      let content = (jsonContent) ? jsonContent : this.getInitialTableContent(arrayData);
      this.localBlockData = { ...blk };

      if (!this.editor) {
        // 第一次建立 editor
        this.editor = new Editor({
          content,
          extensions: tableEditorExtensions,
          editorProps: {
            handleDOMEvents: {
              drop: () => true,
              dragstart: () => true,
              copy: (view, event) => this.handleCopy(view, event),
              keydown: (view, event) => this.handleKeydown(view, event),
              paste: (view, event) => this.handlePaste(view, event),
            },
          },
          onUpdate: ({ editor }) => {
            // 先標記目前 row 是 dirty
            this.markCurrentRowDirty(editor);

            // 2️⃣ 驗證：稍微 debounce，只檢查 dirtyRows
            if (this.validateTimer) clearTimeout(this.validateTimer)
            this.validateTimer = setTimeout(() => {
              const rows = Array.from(this.dirtyRows);
              if (rows.length) {
                this.validateTableContent(editor, rows);
                this.dirtyRows.clear();
              }
            }, 200);
          },
        });
        this.validateTableContent(this.editor);
      } else {
        // 已經有 editor → 只重設內容
        this.editor.commands.setContent(content, false);
        this.validateTableContent(this.editor);
      }
    },

    markCurrentRowDirty(editor) {
      if (!editor) return
      const rowIndex = this.rowFocusCheck()
      if (rowIndex > 0) {
        this.dirtyRows.add(rowIndex)
      }
    },

    handleKeydown(view, event) {
      if (event.key !== 'Enter') return false

      const { state } = view
      const { $from } = state.selection

      // 找到目前所在的 cell / header
      let cellNode = null
      let cellDepth = -1
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d)
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          cellNode = node
          cellDepth = d
          break
        }
      }
      if (!cellNode || cellDepth < 0) return false

      // rowNode = 這個 cell 所在的那一列
      const rowNode = $from.node(cellDepth - 1)
      // tableNode = 整張 table
      const tableNode = $from.node(cellDepth - 2)

      let rowIndex = -1
      let colIndex = -1

      // 取得 rowIndex
      tableNode.content.forEach((row, _offset, index) => {
        if (row === rowNode) {
          rowIndex = index
        }
      })

      // 取得 colIndex
      rowNode.content.forEach((cell, _offset, index) => {
        if (cell === cellNode) {
          colIndex = index
        }
      })

      if (rowIndex < 0 || colIndex < 0) return false
      const blockedCols = [3, 4, 5, 6, 7]

      // 如果是在需要鎖 Enter 的那些欄位，就擋掉
      if (blockedCols.includes(colIndex)) {
        event.preventDefault()
        return true // 告訴 ProseMirror：這個事件已經處理完了
      }

      return false
    },

    handleCopy(view, event) {
      const { state } = view
      const sel = state.selection

      // 只處理「多格選取」的情況，其他丟回瀏覽器預設
      if (!(sel instanceof CellSelection)) {
        return false
      }

      const rect = selectedRect(state)
      const table = rect.table
      const rows = []

      for (let r = rect.top; r < rect.bottom; r++) {
        const rowNode = table.child(r)
        const cols = []
        for (let c = rect.left; c < rect.right; c++) {
          const cellNode = rowNode.child(c)
          cols.push(extractCellText(cellNode) || '')
        }
        rows.push(cols.join('\t'))
      }

      const text = rows.join('\n')

      // 寫進剪貼簿，只用純文字（避免 contenteditable 屬性跟著亂跑）
      if (event.clipboardData) {
        event.clipboardData.setData('text/plain', text)
        event.preventDefault()
        return true
      }

      return false
    },

    handlePaste(view, event) {
      const { state, dispatch } = view
      const sel = state.selection
      const { $from } = sel

      // 讀剪貼簿文字
      const raw = event.clipboardData?.getData('text/plain') || ''
      if (!raw) return false

      // 解析矩陣：換行 -> row，tab -> col
      const rows = raw.split(/\r?\n/).filter(r => r.length > 0)
      if (!rows.length) return true

      const matrix = rows.map(r => r.split('\t'))
      const rowCount = matrix.length
      const colCount = Math.max(...matrix.map(r => r.length))

      // 先找到「目前 table / row / col 的起點」
      let tableNode = null
      let rowNode = null

      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d)
        if (!tableNode && node.type.name === 'table') {
          tableNode = node
        } else if (!rowNode && node.type.name === 'tableRow') {
          rowNode = node
        }
      }
      if (!tableNode || !rowNode) return false

      let startRowIndex = -1
      let startColIndex = -1

      // 如果是多格選取 → 用矩形左上角當起點
      if (sel instanceof CellSelection) {
        const rect = selectedRect(state)
        startRowIndex = rect.top
        startColIndex = rect.left
      } else {
        // 否則沿用原本「從游標所在 cell 推算」的邏輯
        tableNode.content.forEach((row, _off, idx) => {
          if (row === rowNode) startRowIndex = idx
        })

        let cellNode = null
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
            cellNode = node
            break
          }
        }
        if (!cellNode) return false

        rowNode.content.forEach((cell, _off, idx) => {
          if (cell === cellNode) startColIndex = idx
        })
      }

      if (startRowIndex < 0 || startColIndex < 0) return false

      // 找出 table 在整個 doc 裡的起始位置
      let tablePos = null
      state.doc.descendants((node, pos) => {
        if (node === tableNode) {
          tablePos = pos
          return false
        }
        return true
      })
      if (tablePos == null) return true

      // ⭐：這次貼上的所有目標 row index
      const impactedRowIndexes = new Set()
      const targets = [] // { from, to, type, attrs, text }

      // 先預檢查 + 收集所有要替換的 cell（還不動 tr）
      for (let r = 0; r < rowCount; r++) {
        const targetRowIndex = startRowIndex + r
        if (targetRowIndex >= tableNode.childCount) break

        const targetRowNode = tableNode.child(targetRowIndex)
        impactedRowIndexes.add(targetRowIndex)

        // 算這一列在 doc 裡的起始 pos
        let rowStart = tablePos + 1
        for (let i = 0; i < targetRowIndex; i++) {
          rowStart += tableNode.child(i).nodeSize
        }

        let cellPos = rowStart + 1

        for (let c = 0; c < targetRowNode.childCount; c++) {
          const targetCell = targetRowNode.child(c)
          const thisCellPos = cellPos
          const thisCellEnd = cellPos + targetCell.nodeSize

          if (c >= startColIndex && c < startColIndex + colCount) {
            const colOffset = c - startColIndex
            const text = (matrix[r][colOffset] ?? '').toString()

            // 🔒 任一格 contenteditable=false → 整個 paste 擋掉
            if (targetCell.attrs?.contenteditable === false) {
              return true
            }

            targets.push({
              from: thisCellPos,
              to: thisCellEnd,
              type: targetCell.type,
              attrs: { ...targetCell.attrs },
              text,
            })
          }

          cellPos = thisCellEnd
        }
      }

      if (!targets.length) return true

      // ⭐ 反向套用 replace，避免 pos 變動
      let tr = state.tr
      const schema = state.schema

      for (let i = targets.length - 1; i >= 0; i--) {
        const { from, to, type, attrs, text } = targets[i]
        const paragraph =
          text && text.length > 0
            ? schema.nodes.paragraph.create({}, schema.text(text))
            : schema.nodes.paragraph.create()
        const newCell = type.create(attrs, [paragraph])
        tr = tr.replaceWith(from, to, newCell)
      }

      if (tr.docChanged) {
        dispatch(tr.scrollIntoView())

        // ⭐⭐ 關鍵：把所有受影響列標記為 dirty，並立即驗證
        if (impactedRowIndexes.size && this.editor) {
          impactedRowIndexes.forEach(idx => {
            this.dirtyRows.add(idx)
          })
          this.validateTableContent(this.editor, Array.from(impactedRowIndexes))
        }
      }

      event.preventDefault()
      return true
    },

    validateTableContent(editor, rowsToCheck = null) {
      if (!editor) return;

      const { state } = editor;
      const tableNode = state.doc.content.firstChild;
      if (!tableNode || tableNode.type.name !== 'table') return;

      let tr = state.tr;
      let changed = false;

      const rowCount = tableNode.content.childCount;
      let rowPos = 1; // 第一列 row 的起始位置（table node 之後）

      const rowsSet = rowsToCheck ? new Set(rowsToCheck) : null;

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        const rowNode = tableNode.content.child(rowIndex);
        const cells = rowNode.content;

        // 表頭列跳過
        if (rowIndex === 0) {
          rowPos += rowNode.nodeSize;
          continue;
        }

        // 有指定要檢查的 rows，而且這列不在裡面 → 跳過
        if (rowsSet && !rowsSet.has(rowIndex)) {
          rowPos += rowNode.nodeSize;
          continue;
        }

        // 計算這一列每個 cell 的起始 pos
        const cellPos = [];
        let pos = rowPos + 1;
        for (let i = 0; i < cells.childCount; i++) {
          cellPos.push(pos);
          pos += cells.child(i).nodeSize;
        }

        const values = [];
        const valueStatus = [];

        // 3~7 欄：數值欄
        for (let col = 3; col <= 7; col++) {
          const cellNode = cells.child(col);
          const txt = extractText(cellNode);
          if (!txt) {
            valueStatus.push('empty');
            values.push(null);
          } else {
            const num = Number(txt)
            if (!Number.isFinite(num)) {
              valueStatus.push('invalid');
              values.push(null);
            } else {
              valueStatus.push('valid');
              values.push(num);
            }
          }
        }

        const statusCheck = s => s === 'valid' || s === 'error';
        for (let i = 1; i < 5; i++) {
          const a = values[i - 1];
          const b = values[i];
          if (a != null && b != null && statusCheck(valueStatus[i - 1]) && statusCheck(valueStatus[i]) && a > b) {
            valueStatus[i - 1] = 'error';
            valueStatus[i] = 'error';
          }
        }

        for (let offset = 0; offset < 5; offset++) {
          const colIndex = 3 + offset;
          const cellNode = cells.child(colIndex);
          const newClass = 'value-' + valueStatus[offset];

          if (cellNode.attrs.class === newClass) continue;

          const newAttrs = { ...cellNode.attrs, class: newClass };
          tr = tr.setNodeMarkup(cellPos[colIndex], cellNode.type, newAttrs, cellNode.marks);
          changed = true;
        }

        rowPos += rowNode.nodeSize;
      }

      if (changed) editor.view.dispatch(tr);
    },

    // ✅ 只負責「把 arrayData 變成 TipTap Table JSON」
    //   - 第一列當 header（contenteditable=false）
    //   - 每列第 0,1,2 欄鎖定（contenteditable=false）
    getInitialTableContent(data) {
      const table = { type: 'table', content: [] }

      for (let row = 0; row < data.length; row++) {
        const row_data = []
        for (let col = 0; col < data[row].length; col++) {
          const type = row === 0 ? 'tableHeader' : 'tableCell'
          const textValue = data[row][col] ?? ''
          const paragraphText = { type: 'text', text: textValue }
          const content = [{ type: 'paragraph', content: paragraphText.text.length > 0 ? [paragraphText] : [] }]
          const isHeader = row === 0
          const isLockedCol = lockCols.includes(col)
          const attrs = isHeader || isLockedCol ? { contenteditable: false } : {}

          row_data.push({ type, content, attrs })
        }
        table.content.push({ type: 'tableRow', content: row_data })
      }

      return { type: 'doc', content: [table] }
    },

    rowFocusCheck() {
      if (!this.editor) return -1
      const { selection } = this.editor.state
      const rowDepth = selection.$anchor.depth - 2

      let currentRowIndex = -1
      selection.$anchor.node(rowDepth - 1).forEach((child, offset, index) => {
        if (currentRowIndex !== -1) return
        if (child === selection.$anchor.node(rowDepth)) {
          currentRowIndex = index
        }
      })

      return currentRowIndex
    },

    deleteRow() {
      if (!this.editor) return
      const targetRowIndex = this.rowFocusCheck()
      if (targetRowIndex === 0) {
        alert('請選擇要刪除的列')
        return
      }

      const { state } = this.editor
      let rowIndex = 0
      let success = true
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'tableRow' && success) {
          if (rowIndex === targetRowIndex) {
            if (node.content.child(1).attrs?.contenteditable === false) {
              success = false
            }
          }
          rowIndex++
        }
      })

      if (!success) {
        alert('禁止刪除初始參數')
        return
      }

      this.editor.chain().focus().deleteRow().run()
      this.updateTable()
    },

    addRow(below) {
      if (!this.editor) return
      if (this.rowFocusCheck() === 0) {
        alert('請選擇要插入的列')
        return
      }

      if (below) this.editor.chain().focus().addRowAfter().run()
      else this.editor.chain().focus().addRowBefore().run()

      this.updateTable()
    },

    updateTable() {
      if (!this.editor) return
      const { state, view } = this.editor
      const tr = state.tr
      let rowIndex = 0

      // Collect all rows
      const rowsToUpdate = []
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'tableRow') {
          rowsToUpdate.push({ node, pos, rowNumber: rowIndex++ })
        }
      })

      // Process text from the end（避免位置受影響）
      rowsToUpdate.slice(1).reverse().forEach(rowNode => {
        const { node, pos, rowNumber } = rowNode
        const firstCell = node.content.child(0)
        const isCell = firstCell && (firstCell.type.name === 'tableCell' || firstCell.type.name === 'tableHeader')

        if (isCell) {
          const paragraph = state.schema.nodes.paragraph.create({}, state.schema.text(rowNumber.toString()) )
          const newCell = firstCell.type.create({ ...firstCell.attrs, contenteditable: false }, paragraph)
          tr.replaceWith(pos + 1, pos + 1 + firstCell.nodeSize, newCell)
        }
      })

      if (tr.docChanged) view.dispatch(tr)
    },

    exportTableData(editor) {
      if (!editor || !editor.state) return { arrayData: [], jsonContent: null };

      const jsonContent = editor.getJSON();
      const doc = editor.state.doc;
      const tableNode = doc.content.firstChild;
      const arrayData = [];

      if (!tableNode || tableNode.type.name !== 'table') return { arrayData, jsonContent };

      tableNode.content.forEach(rowNode => {
        if (rowNode.type.name !== 'tableRow') return

        const rowArray = rowNode.content.content.map(cellNode => {
          return cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader' ? extractCellText(cellNode) : '';
        })

        arrayData.push(rowArray);
      })

      if (!this.localBlockData.data) {
        this.localBlockData.data = {};
      }
      this.localBlockData.data.arrayData = arrayData;
      this.localBlockData.data.jsonContent = jsonContent;

      this.$emit('update-table-data', this.localBlockData);
      return { arrayData, jsonContent };
    },
  },
}
</script>


<style scoped>

.combination-block { border: 1px solid #ccc; padding: 15px; margin: 4px; border-radius: 8px; background-color: #f9f9f9; }

.management-header-block { display: flex; margin-bottom: 10px; justify-content: space-between; align-items: center; align-items: center; }
.management-header-block label { font-size: 18px; }
.management-main-function-block, .management-operation-block { display: flex; gap: 10px; align-items: center; }
.combination-btn {
    background-color: #1666C0;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 5px;
    font-size: 14px;
    cursor: pointer;
}

.combination-btn.del { background-color: #dc3545;  }

.menu.color { display: flex; gap: 5px; align-items: center; }
.font-color { width: 20px; height: 20px; border-radius: 50%; margin: 0px 4px; }
.font-color.red { background-color: red; }
.font-color.blue { background-color: blue; }
.font-color.black { background-color: black; }


/* Tiptap 專用 CSS 樣式 */
.editor-content :deep(.ProseMirror) { padding: 10px; outline: none; line-height: 1.5; }
.editor-content :deep(table) { border-collapse: collapse; width: 100%; margin: 10px 0px; table-layout: fixed; }
.editor-content :deep(th) { position:sticky; top:35px; z-index:5; }
.editor-content :deep(th), .editor-content :deep(td) { 
    border: 1px solid #ccc; 
    padding: 8px; 
    text-align: left; 
    vertical-align: top; 
    min-height: 40px;
}

.editor-content :deep(p) { margin: 0px; }
.editor-content :deep(th), .editor-content :deep(td) { text-align: center; }

.management-tiptap-editor :deep(col:nth-child(1)) { width: 50%; } /* 項次 */
.management-tiptap-editor :deep(col:nth-child(2)) { width: 75%; } /* 槽體/測試點 */
.management-tiptap-editor :deep(col:nth-child(3)) { width: 100%; }
.management-tiptap-editor :deep(col:nth-child(4)), 
.management-tiptap-editor :deep(col:nth-child(5)),
.management-tiptap-editor :deep(col:nth-child(6)),
.management-tiptap-editor :deep(col:nth-child(7)),
.management-tiptap-editor :deep(col:nth-child(8)) { width: 75%; } 

.management-tiptap-editor :deep(col:nth-child(9)) { width: 100%; } /* 檢查頻率 */
.management-tiptap-editor :deep(col:nth-child(10)) { width: 50%; } /* 檢查方式 */
.management-tiptap-editor :deep(col:nth-child(11)) { width: 50%; } /* 檢驗人員 */
.management-tiptap-editor :deep(col:nth-child(12)) { width: 100%; } /* 記錄 */
.management-tiptap-editor :deep(col:nth-child(13)) { width: 100%; } /* 備註/參考指示書 */

.editor-content :deep(td.selectedCell),
.editor-content :deep(th.selectedCell) {
    border: 2px solid #ccc;
    background-color: #cce7ff;
    box-shadow: 0 0 0 3px #4a90e2 inset;
    border-color: transparent;
    opacity: 1;
}
.management-tiptap-editor :deep(td[contenteditable="false"]),
.management-tiptap-editor :deep(th[contenteditable="false"]) {
    background-color: #f1f3f5; 
    /* cursor: not-allowed; */
    /* user-select: none; */
    cursor: default;      
    color: #6c757d;
}

.editor-content :deep(td.value-empty), .editor-content :deep(th.value-empty) { background-color: #fffee0; }
.editor-content :deep(td.value-error), .editor-content :deep(th.value-error) { background-color: #ffeaea; }
.editor-content :deep(td.value-invalid), .editor-content :deep(th.value-invalid) { background-color: #ffeaea; }
.editor-content :deep(td.has-focus){ background-color:#fff7cc; box-shadow: inset 0 0 0 2px #ff9800; }

.hint.empty { margin: 8px 0; color: #c62828; font-weight: 600; }

</style>