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
      <EditorContent
        v-else-if="editor"
        :editor="editor"
        class="editor-content management-tiptap-editor"
      />
    </div>

  </div>
</template>


<script>
import { EditorContent, Editor } from '@tiptap/vue-3';
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

const baseExt = [Paragraph, Text, TextStyle, Color.configure({ types: ['textStyle'] })]

const CustomTableCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: {default: true}, class: {default: null} } } });
const CustomTableHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), contenteditable: { default: true } } } });
const CustomTableRow = TableRow.extend({ addAttributes() { return { ...this.parent?.(), class: { default: null } } } });
const tableEditorExtensions = [
    Document.extend({ content: 'table' }), ...baseExt, Table,
    CustomTableRow, CustomTableHeader, CustomTableCell, History
];

const lockCols = [0, 1, 2, 8];
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
            localBlockData: {...this.managementBlock},
            editor: null,
        }
    },
    mounted() {
      console.log("management block: ", this.managementBlock)
      const jsonContent = this.localBlockData.data?.jsonContent
      const arrayData   = this.localBlockData.data?.arrayData

      // ★ 如果這個 block 沒有 PMS 且沒有任何已儲存的內容，就不要建立 editor
      if (!this.hasPms && !jsonContent && (!Array.isArray(arrayData) || !arrayData.length)) {
        this.editor = null
        return
      }

      let content
      if (jsonContent) {
        content = jsonContent
      } else if (Array.isArray(arrayData) && arrayData.length) {
        content = this.getInitialTableContent(arrayData)
      } else {
        content = this.getInitialTableContent(initialTableData)
      }

      this.editor = new Editor({
        content,
        extensions: tableEditorExtensions,
        editorProps: { handleDOMEvents: { drop: () => true, dragstart: () => true } },
        onUpdate: ({ editor }) => {
          this.validateTableContent(editor);
          this.exportTableData(editor);
        },
      })
      this.validateTableContent(this.editor)
    },

    beforeUnmount() {
        if (this.editor) this.editor.destroy();
    },
    computed: {
        isTableSelected() { return this.editor?.can().mergeCells() || this.editor?.can().splitCell() }
    },
    methods: {
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

            // 1. 輸出 JSON 內容 (用於載入/儲存)
            const jsonContent = editor.getJSON();

            // 2. 輸出 2D 陣列結構
            const doc = editor.state.doc;
            const tableNode = doc.content.firstChild;
            const arrayData = [];
            
            // 確認文檔的頂層內容是否為表格
            if (!tableNode || tableNode.type.name !== 'table') {
                console.warn("編輯器內容不是表格。");
                return { arrayData, jsonContent };
            }

            // 遍歷 Row (tableNode.content 包含所有 tableRow 節點)
            tableNode.content.forEach(rowNode => {
                if (rowNode.type.name !== 'tableRow') return;

                const rowArray = rowNode.content.content.map(cellNode => {
                    return (cellNode.type.name === 'tableCell' || cellNode.type.name === 'tableHeader') ? extractCellText(cellNode) : "";
                })
                
                arrayData.push(rowArray);
            });

            this.localBlockData.data["arrayData"] = arrayData;
            this.localBlockData.data["jsonContent"] = jsonContent;
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
.editor-content :deep(th) { position:sticky; top:100px; z-index:5; }
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
    cursor: not-allowed;
    user-select: none;
    color: #6c757d;
}

.editor-content :deep(td.value-empty), .editor-content :deep(th.value-empty) { background-color: #fffee0; }
.editor-content :deep(td.value-error), .editor-content :deep(th.value-error) { background-color: #ffeaea; }
.editor-content :deep(td.value-invalid), .editor-content :deep(th.value-invalid) { background-color: #ffeaea; }

.hint.empty { margin: 8px 0; color: #c62828; font-weight: 600; }

</style>