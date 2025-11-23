<template>
  <div class="combination-block">
    <div class="management-header-block">
      <label>{{ managementBlock.step }}.{{ managementBlock.tier }} 生產基本條件</label>
      <div class="management-operation-block">
        <div class="menu color">
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
import { EditorContent, Editor } from '@tiptap/vue-3';
import { Focus } from '@tiptap/extensions'
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { History } from '@tiptap/extension-history';
import { CellSelection, selectedRect } from 'prosemirror-tables'

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]

const CustomTableCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: {default: true}, class: {default: null} } } });
const CustomTableHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: { default: true } } } });
const CustomTableRow = TableRow.extend({ addAttributes() { return { ...this.parent?.(), class: { default: null } } } });
const tableEditorExtensions = [
    Document.extend({ content: 'table' }), ...baseExt, Table, Focus.configure({ className: 'has-focus', mode: 'all' }),
    CustomTableRow, CustomTableHeader, CustomTableCell, History
];

const lockCols = [0, 1, 2];
const initialTableData = [
    ["項次", "槽體", "管理項目", '規格下限(OOS-)','操作下限(OOC-)','設定值','操作上限(OOC+)','規格上限(OOS+)', "單位", "檢查頻率", "檢查方式", "檢驗人員", "記錄", "備註/參考指示書"],
    ["", "熱水洗1", "噴壓", "", "", "", "", "", "kgf/cm2", "", "", "", "", ""],
    ["", "熱水洗1", "溫度", "", "", "", "", "", "℃", "", "", "", "", ""],
    ["", "剝膜1", "氫氧化鈉NaOH", "", "", "", "", "", "%", "", "", "", "", ""],
    ["", "剝膜1", "噴壓", "", "", "", "", "", "kgf/cm2", "", "", "", "", ""],
    ["", "剝膜1", "作業溫度", "", "", "", "", "", "℃", "", "", "", "", ""],
    ["", "剝膜2", "氫氧化鈉NaOH", "", "", "", "", "", "%", "", "", "", "", ""],
    ["", "剝膜2", "噴壓", "", "", "", "", "", "kgf/cm2", "", "", "", "", ""],
    ["", "剝膜2", "作業溫度", "", "", "", "", "", "℃", "", "", "", "", ""],
];

const extractText = (cellNode) => {
    const paragraphNode = cellNode.content.content[0]; 
    if (!paragraphNode || paragraphNode.type.name !== 'paragraph') return '';
    
    return paragraphNode.content.content.map(textNode => textNode.text).join('').trim();
};

const extractCellText = (cellNode) => {
    if (!cellNode || !cellNode.content || !cellNode.content.childCount) {
        return "";
    }
    
    const paragraphNode = cellNode.content.child(0); 
    if (!paragraphNode || paragraphNode.type.name !== 'paragraph') {
        return "";
    }

    let text = '';
    paragraphNode.content.forEach(textNode => {
        if (textNode.text) text += textNode.text;
    });

    return text.trim();
};


export default {
    name: 'ManagementSpecificBlock',
    components: {
        EditorContent,
    },
    props: {
        machines: { type: Array, required: true },
        managementBlock: { type: Object, required: true },
        hasPms: { type: Boolean, default: true },
    },
    data() {
        return {
            localBlockData: { ...this.managementBlock },
            editor: null,
            hasUserEdited: false,      // 使用者是否改過
            lastExternalJson: null,    // 上一次「外部載入」的 jsonContent 簽章
        }

    },
    mounted() {
      this.initOrReloadFromProps(true)
    },

    beforeUnmount() {
        if (this.editor) this.editor.destroy();
    },
    computed: {
        isTableSelected() { return this.editor?.can().mergeCells() || this.editor?.can().splitCell() }
    },
    watch: {
        managementBlock: {
            deep: true,
            handler(newVal) {
                const data = newVal?.data || {}
                const jsonContent = data.jsonContent || null
                const sig = JSON.stringify(jsonContent || null)

                // 若這次的內容跟 lastExternalJson 一樣 → 多半是自己 emit update-table-data 之後
                // 父層又把同一份內容丟回來，這種就不要再重載，避免無限迴圈
                if (sig === this.lastExternalJson && this.hasUserEdited) {
                    return
                }

                // 其他情況（例如：載入草稿 / 換機台重設 PMS） → 正式重載
                this.initOrReloadFromProps(false)
            },
        },
    },

    methods: {
        initOrReloadFromProps(isInitial = false) {
            const blk = this.managementBlock || {}
            const data = blk.data || {}
            const jsonContent = data.jsonContent || null
            const arrayData   = Array.isArray(data.arrayData) ? data.arrayData : []

            // 記錄目前這次「外部狀態」的簽章（只看 jsonContent）
            const sig = JSON.stringify(jsonContent || null)
            this.lastExternalJson = sig
            this.hasUserEdited = false  // 外部重載時視為尚未編輯

            // ★ 沒有 PMS 且沒有任何資料 → 不建立 editor，只顯示「選擇的機台無任何參數」
            if (!this.hasPms && !jsonContent && !arrayData.length) {
            if (this.editor) {
                this.editor.destroy()
                this.editor = null
            }
            this.localBlockData = { ...blk }
            return
            }

            let content
            if (jsonContent) {
              // 優先使用草稿 / DB 儲存的內容
              content = jsonContent
            } else if (arrayData.length) {
              // 其次使用 PMS 回來的 arrayData
              content = this.getInitialTableContent(arrayData)
            } else {
              // 兩邊都沒有 → fallback 初始模板
              content = this.getInitialTableContent(initialTableData)
            }

            this.localBlockData = { ...blk }

            if (!this.editor) {
                // 第一次建立 editor
                this.editor = new Editor({
                    content,
                    extensions: tableEditorExtensions,
                    editorProps: { handleDOMEvents: { 
                        drop: () => true, 
                        dragstart: () => true, 
                        copy: (view, event) => this.handleCopy(view, event),      // ⭐ 新增 copy
                        keydown: (view, event) => this.handleKeydown(view, event),
                        paste: (view, event) => this.handlePaste(view, event),   // ⭐ 新增這行
                    }},
                    onUpdate: ({ editor }) => {
                    this.validateTableContent(editor)
                    this.exportTableData(editor)   // 這裡會 emit 給父層
                    },
                })
                this.validateTableContent(this.editor)
            } else {
                // 已經有 editor → 只重設內容
                this.editor.commands.setContent(content, false)
                this.validateTableContent(this.editor)
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

            // 欄位 index 對應 initialTableData：
            // 0 "項次"
            // 1 "槽體"
            // 2 "管理項目"
            // 3 "規格下限(OOS-)"
            // 4 "操作下限(OOC-)"
            // 5 "設定值"
            // 6 "操作上限(OOC+)"
            // 7 "規格上限(OOS+)"
            // 8 "單位"
            // ...
            const blockedCols = [3, 4, 5, 6, 7]

            // 如果是在需要鎖 Enter 的那些欄位，就擋掉
            if (blockedCols.includes(colIndex)) {
            event.preventDefault()
            return true       // 告訴 ProseMirror：這個事件已經處理完了
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
            let tableDepth = -1
            let rowDepth = -1

            for (let d = $from.depth; d > 0; d--) {
                const node = $from.node(d)
                if (!tableNode && node.type.name === 'table') {
                    tableNode = node
                    tableDepth = d
                } else if (!rowNode && node.type.name === 'tableRow') {
                    rowNode = node
                    rowDepth = d
                }
            }
            if (!tableNode || !rowNode) return false

            // 算目前所在的 rowIndex / colIndex
            let startRowIndex = -1
            let startColIndex = -1

            // 如果現在是多格選取，就用「選取矩形的左上角」當起點
            if (sel instanceof CellSelection) {
                const rect = selectedRect(state)
                startRowIndex = rect.top
                startColIndex = rect.left
            } else {
                // 否則就用 cursor 所在的 cell 當起點（跟你原本類似）
                const table = tableNode

                table.content.forEach((row, _off, idx) => {
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

            // ⭐ 第一步：預檢查 + 收集所有要替換的 cell（還不動 tr）
            const targets = []   // { from, to, type, attrs, text }

            for (let r = 0; r < rowCount; r++) {
                const targetRowIndex = startRowIndex + r
                if (targetRowIndex >= tableNode.childCount) break

                const targetRowNode = tableNode.child(targetRowIndex)

                // 算這一列在 doc 裡的起始 pos（用「原始 doc」的 nodeSize）
                let rowStart = tablePos + 1
                for (let i = 0; i < targetRowIndex; i++) {
                    rowStart += tableNode.child(i).nodeSize
                }

                let cellPos = rowStart + 1

                for (let c = 0; c < targetRowNode.childCount; c++) {
                    const targetCell = targetRowNode.child(c)
                    const thisCellPos = cellPos
                    const thisCellEnd = cellPos + targetCell.nodeSize

                    // 是否在要貼的矩陣範圍內
                    if (c >= startColIndex && c < startColIndex + colCount) {
                        const colOffset = c - startColIndex
                        const text = (matrix[r][colOffset] ?? '').toString()

                        // 🔒 如果其中一格是 contenteditable=false → 整個 paste 擋掉
                        if (targetCell.attrs?.contenteditable === false) { return true }

                        targets.push({ from: thisCellPos, to: thisCellEnd, type: targetCell.type, attrs: { ...targetCell.attrs }, text })
                    }

                    cellPos = thisCellEnd
                }
            }

            if (!targets.length) return true

            // ⭐ 第二步：反向套用（避免 pos 因為前面 replaceWith 而變動）
            let tr = state.tr
            const schema = state.schema

            for (let i = targets.length - 1; i >= 0; i--) {
                const { from, to, type, attrs, text } = targets[i]

                const paragraph = text && text.length > 0 ? schema.nodes.paragraph.create({}, schema.text(text)) : schema.nodes.paragraph.create()

                const newCell = type.create(attrs, [paragraph])
                tr = tr.replaceWith(from, to, newCell)
            }

            if (tr.docChanged) {
                dispatch(tr.scrollIntoView())
            }
            event.preventDefault()
            return true
        },

        validateTableContent(editor) {
            if (!editor) return
            const tr = editor.state.tr;
            let changes = false;
            
            // 1. 獲取表格節點
            const tableNode = editor.state.doc.content.firstChild;
            if (!tableNode || tableNode.type.name !== 'table') return;

            for (let rowIndex = 0; rowIndex < tableNode.content.childCount; rowIndex++) {
                const rowNode = tableNode.content.child(rowIndex);
                const cells = rowNode.content;

                let rowPos = 1;
                for (let i = 0; i < rowIndex; i++) {
                    rowPos += tableNode.content.child(i).nodeSize;
                }

                if (rowIndex == 0) continue;

                let cellPos = [rowPos + 1];
                for (let index = 0; index < cells.content.length - 1; index++) {
                    cellPos.push(cellPos[index] + cells.child(index).nodeSize);
                }

                const values = [];
                const valueStatus = [];

                for (let index = 3; index < 8; index++) {
                    const valueText = extractText(cells.child(index));
                    if (valueText.length > 0) {
                        const value = Number(valueText);
                        const valid = (!isNaN(value)) ? "valid" : "invalid";
                        valueStatus.push(valid);
                        values.push(!isNaN(value) ? value : null);
                    } else {
                        valueStatus.push("empty");
                        values.push(null);
                    }
                }

                const statusCheck = (status) => { return (status == "valid" || status == "error") }
                for (let index = 1; index < 5; index++) {
                    if (statusCheck(valueStatus[index - 1]) && statusCheck(valueStatus[index]) && (values[index - 1] > values[index])) {
                        valueStatus[index - 1] = "error"
                        valueStatus[index] = "error"
                    }
                }

                for (let index = 0; index < 5; index++) {
                    tr.setNodeMarkup(cellPos[index + 3], null, { ...rowNode.attrs, class: "value-" + valueStatus[index] });
                }
            }
            editor.view.dispatch(tr);
        },
        getInitialTableContent(data) {
            let table = { type: "table", content: [] };
            for (let row = 0; row < data.length; row++) {
                let row_data = [];
                for (let col = 0; col < data[row].length; col++){
                    let type = (row == 0) ? "tableHeader" : "tableCell";
                    let paragraphText = {type: "text", text: (row > 0 && col == 0) ? row.toString() : data[row][col]};
                    let content = [{ type: "paragraph", content: (paragraphText.text.length > 0) ? [paragraphText] : []}];
                    row_data.push({ type, content: content, attrs: (row == 0 || lockCols.some(lockCol => lockCol == col)) ? {contenteditable: false} : {}});
                }
                table.content.push({ type: "tableRow", content: row_data });
            }
            return { type: "doc", content: [table] };
        },
        rowFocusCheck() {
            if (!this.editor) return -1
            const { selection } = this.editor.state;
            const rowDepth = this.editor.state.selection.$anchor.depth - 2;

            let currentRowIndex = -1;
            selection.$anchor.node(rowDepth - 1).forEach((child, offset, index) => {
                if (currentRowIndex != -1) return;
                if (child === selection.$anchor.node(rowDepth)) {
                    currentRowIndex = index; 
                }
            });

            return currentRowIndex;
        },
        deleteRow() {
            if (!this.editor) return
            let targetRowIndex = this.rowFocusCheck();
            if (targetRowIndex == 0) {
                alert("請選擇要刪除的列");
                return;
            }

            const { state } = this.editor;
            let rowIndex = 0;
            let success = true;
            state.doc.descendants((node, pos) => {
                if (node.type.name == "tableRow" && success){
                    if (rowIndex == targetRowIndex) {
                        if (node.content.child(1).attrs?.contenteditable == false) {
                            success = false;
                        }
                    }
                    rowIndex++;
                }
            });

            if (!success) {
                alert("禁止刪除初始參數");
                return;
            }

            this.editor.chain().focus().deleteRow().run();
            this.updateTable();
        },
        addRow(below) {
            if (!this.editor) return
            if (this.rowFocusCheck() == 0) {
                alert("請選擇要插入的列");
                return;
            }

            if (below)
                this.editor.chain().focus().addRowAfter().run();
            else
                this.editor.chain().focus().addRowBefore().run();

            this.updateTable();
        },
        updateTable() {
            if (!this.editor) return
            const { state, view } = this.editor;
            const tr = state.tr;
            let rowIndex = 0;

            // Collect all need node and position
            const rowsToUpdate = [];
            state.doc.descendants((node, pos) => {
                if (node.type.name == "tableRow")
                    rowsToUpdate.push({ node, pos, rowNumber: rowIndex++ });
            });

            // Process text from the end
            rowsToUpdate.slice(1).reverse().forEach(rowNode => {
                const { node, pos, rowNumber } = rowNode;

                const firstCell = node.content.child(0);
                const isCell = firstCell && (firstCell.type.name == "tableCell" || firstCell.type.name == "tableHeader");

                if (isCell) {
                    const paragraph = state.schema.nodes.paragraph.create({}, state.schema.text(rowNumber.toString()));
                    const newCell = firstCell.type.create({ ...firstCell.attrs, contenteditable: false }, paragraph);
                    tr.replaceWith(pos + 1, pos + 1 + firstCell.nodeSize, newCell);
                }
            })
            
            // Update front-end interface
            if (tr.docChanged) view.dispatch(tr);
        },
        exportTableData(editor) {
            if (!editor || !editor.state) {
                console.error("Editor 實例無效。");
                return { arrayData: [], jsonContent: null };
            }

            const jsonContent = editor.getJSON();
            const doc = editor.state.doc;
            const tableNode = doc.content.firstChild;
            const arrayData = [];
            
            if (!tableNode || tableNode.type.name !== 'table') {
                console.warn("編輯器內容不是表格。");
                return { arrayData, jsonContent };
            }

            tableNode.content.forEach(rowNode => {
                if (rowNode.type.name !== 'tableRow') return;

                const rowArray = rowNode.content.content.map(cellNode => {
                    return (cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader')
                        ? extractCellText(cellNode)
                        : "";
                })
                
                arrayData.push(rowArray);
            });

            this.localBlockData.data["arrayData"] = arrayData;
            this.localBlockData.data["jsonContent"] = jsonContent;

            // ⭐ 標記這是「使用者編輯後」的版本，並更新 lastExternalJson
            this.hasUserEdited = true
            this.lastExternalJson = JSON.stringify(jsonContent || null)

            this.$emit("update-table-data", this.localBlockData);
            return { arrayData, jsonContent };
        }
    },
};
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

.management-tiptap-editor :deep(col:nth-child(1)) { width: 5%; } /* 項次 */
.management-tiptap-editor :deep(col:nth-child(2)) { width: 10%; } /* 槽體/測試點 */
.management-tiptap-editor :deep(col:nth-child(3)) { width: 12.5%; }
.management-tiptap-editor :deep(col:nth-child(4)), 
.management-tiptap-editor :deep(col:nth-child(5)),
.management-tiptap-editor :deep(col:nth-child(6)),
.management-tiptap-editor :deep(col:nth-child(7)),
.management-tiptap-editor :deep(col:nth-child(8)) { width: 6.5%; } 

.management-tiptap-editor :deep(col:nth-child(9)) { width: 5%; } /* 單位 */
/* .management-tiptap-editor :deep(col:nth-child(10)) { width: 5%; } 參數下放 */
.management-tiptap-editor :deep(col:nth-child(11)) { width: 6.5%; } /* 檢查頻率 */
.management-tiptap-editor :deep(col:nth-child(12)) { width: 6.5%; } /* 檢查方式 */
.management-tiptap-editor :deep(col:nth-child(13)) { width: 6.5%; } /* 檢驗人員 */
.management-tiptap-editor :deep(col:nth-child(14)) { width: 9%; } /* 記錄 */
.management-tiptap-editor :deep(col:nth-child(15)) { width: 15%; } /* 備註/參考指示書 */

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