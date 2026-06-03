<template>
  <div class="tree-node">
    <div
      class="node-row"
      :class="{ selectable: isLeaf, selected: isSelected, group: !isLeaf }"
      :style="{ paddingLeft: depth * 16 + 8 + 'px' }"
      @click="onClick"
    >
      <span v-if="hasChildren" class="toggle" @click.stop="expanded = !expanded">
        {{ expanded ? '▾' : '▸' }}
      </span>
      <span v-else class="toggle placeholder"></span>

      <span class="node-label">{{ node.deptName }}</span>
      <span class="count" :class="{ active: node.processCount > 0 }">{{ node.processCount }}</span>
    </div>

    <div v-if="hasChildren && expanded" class="children">
      <DepartmentTreeNode
        v-for="child in node.children"
        :key="child.deptNo"
        :node="child"
        :depth="depth + 1"
        :selected-dept-no="selectedDeptNo"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script>
export default {
  // name 必填：遞迴元件需靠 name 自我參照
  name: "DepartmentTreeNode",
  props: {
    node: { type: Object, required: true },
    depth: { type: Number, default: 0 },
    selectedDeptNo: { type: String, default: "" },
  },
  data() {
    return {
      // 預設展開到 LEV 6（即 LEV 5、6 展開，讓 LEV 7 課別可見）
      expanded: this.node.lev <= 6,
    };
  },
  computed: {
    hasChildren() {
      return Array.isArray(this.node.children) && this.node.children.length > 0;
    },
    isLeaf() {
      // 只有 LEV 7（課）可以綁製程
      return this.node.lev === 7;
    },
    isSelected() {
      return this.isLeaf && this.node.deptNo === this.selectedDeptNo;
    },
  },
  methods: {
    onClick() {
      if (this.isLeaf) {
        this.$emit("select", this.node);
      } else if (this.hasChildren) {
        // LEV 5 / 6 節點點擊：展開 / 收起
        this.expanded = !this.expanded;
      }
    },
  },
};
</script>

<style scoped>
.node-row {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  user-select: none;
}
.node-row.group { cursor: pointer; }
.node-row.selectable { cursor: pointer; }
.node-row.group:hover,
.node-row.selectable:hover { background-color: #eef4fa; }
.node-row.selected { background-color: #cfe6fb; }
.node-row.selected .node-label { font-weight: bold; }

.toggle {
  display: inline-flex;
  justify-content: center;
  width: 16px;
  margin-right: 4px;
  color: #666;
  font-size: 12px;
}
.toggle.placeholder { cursor: default; }

.node-label {
  flex: 1;
  font-size: 14px;
  color: #222;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.count {
  min-width: 22px;
  margin-left: 8px;
  padding: 0 6px;
  text-align: center;
  font-size: 12px;
  line-height: 18px;
  border-radius: 9px;
  color: #aaa;                 /* processCount = 0：淺灰 */
  background-color: #f0f0f0;
}
.count.active {
  color: #fff;                 /* processCount > 0：主色 + 粗體 */
  background-color: #61a5d6;
  font-weight: bold;
}
</style>
