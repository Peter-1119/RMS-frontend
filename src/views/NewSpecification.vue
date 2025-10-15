<template>
    <div class="new-specification-container">
        <div class="header">
            <button @click="$router.push('/home')" class="back-btn">
                <img src="@/assets/home-icon.png" alt="首頁" class="icon"> 回首頁
            </button>
            <h1>製造式樣書</h1>
            <button @click="saveDraft" class="save-btn">
                <img src="@/assets/save-icon.png" alt="儲存" class="icon">暫存草稿
            </button>
        </div>
        
        <div class="step-navigation">
            <div v-for="(step, index) in steps" :key="index" :class="['step-item', {'active': currentStep === index + 1, 'completed': currentStep > index + 1}]" @click="goToStep(index + 1)">
                <div class="step-circle">{{ index }}</div>
                <div class="step-label">{{ step.label }}</div>
            </div>
        </div>

        <div class="form-section">
            <div v-if="currentStep === 1" class="step-content">
                <h2>基本屬性</h2>
                <div class="fundamental-attribute-block">
                    <div class="attribute">
                        <div class="form-group"><label for="doc-code">文管編號：</label><input type="text" id="doc-code" v-model="form.documentID" readonly/></div>
                        <div class="form-group"><label for="doc-name">文件名稱：</label><input type="text" id="doc-name" v-model="form.documentName" readonly/></div>
                        <div class="form-group"><label for="doc-version">文件版本：</label><input type="text" id="doc-version" v-model="form.documentVersion" readonly/></div>
                        
                        <div class="form-group">
                            <label for="item-type">品目：</label>
                            <input class="window-select" type="text" id="item-type" v-model="form.attribute.itemType" @click="itemsListVisible=!itemsListVisible" readonly/>
                        </div>

                        <div class="form-group">
                            <label for="apply-project">適用工程：</label>
                            <input class="window-select" type="text" id="apply-project" v-model="form.attribute.specific" @click="specificsListVisible=true" readonly/>
                        </div>

                        <div class="form-group"><label for="style-no">式樣NO：</label><input type="text" id="style-no" v-model="form.attribute.styleNo" readonly/></div>
                        <div class="form-group"><label for="style-version">式樣版本：</label><input type="text" id="style-version" v-model="form.attribute.styleVersion" readonly/></div>
                        <div class="form-group"><label for="department">制訂單位：</label><input type="text" id="department" v-model="form.department" readonly/></div>
                        <div class="form-group"><label for="author">制訂者：</label><input type="text" id="author" v-model="form.author" readonly/></div>
                        <div class="form-group"><label for="approver">承認者：</label><input type="text" id="approver" v-model="form.approver"/></div>
                        <div class="form-group"><label for="confirmer">確認者：</label><input type="text" id="confirmer" v-model="form.confirmer"/></div>
                    </div>
                    <div class="supplement">
                        <div class="form-group"><label for="revise-reason">變更理由：</label><textarea id="revise-reason" v-model="form.reviseReason"></textarea></div>
                        <div class="form-group"><label for="revise-point">變更要點：</label><textarea id="revise-point" v-model="form.revisePoint"></textarea></div>
                    </div>
                </div>
            </div>

            <SpecificListWindow 
                v-if="specificsListVisible"
                @selectSpecific="getSpecific"
                @cancel="specificsListVisible=false"
            ></SpecificListWindow>

            <ItemListWindow
                v-if="itemsListVisible"
                :items="requestItemFromAPI()"
                @selectItem="getItemType"
                @cancel="itemsListVisible=false"
            ></ItemListWindow>

            <div v-if="currentStep === 2" class="step-content">
                <h2>目的</h2>
                <div class="purpose-group">
                    <textarea placeholder="此處將填寫文件的目的相關內容" v-model="form.documentPurpose"></textarea>
                </div>
            </div>
            <div v-if="currentStep === 3" class="step-content">
                <h2>製作條件規範</h2>
                <div class="manufacturing-specification-block">
                    <button class="layer-action-btn add" @click="addSpecificationLayer">新增下一層</button>
                </div>

                <content-block v-for="blockContent in manufacturingSpecifications"
                    :key="blockContent.id"
                    :step="blockContent.step"
                    :tier="blockContent.tier"
                    :blockContents="blockContent"
                    @delete-block="removeSpecificationLayer(blockContent.id)"
                    @update-block="updateSpecificationData"/>
            </div>
            <div v-if="currentStep === 4" class="step-content">
                <h2>製造參數一覽表</h2>
                <div class="Parameters">
                    <button class="layer-action-btn add" @click="addParameterLayer">新增組合</button>
                </div>
                <ManufacturingParamBlock v-for="(blockItem, blockIndex) in manufacturingParameters" :key="`manufacturing-param-block-${blockItem.id}`"
                    :code=blockItem.code
                    :tableIndex=blockIndex
                    :machineGroups="machineGroups"
                    :blockData="blockItem"
                    :isManufacturingTableDuplicate="isManufacturingTableDuplicateMap[blockIndex] || false"
                    :basicParameterStatus="false"
                    @update-table-data="updateParameterData"
                    @copy-table-data="copyManufacturingTableData(blockIndex)"
                    @delete-table-data="removeParameterLayer(blockIndex)"/>

            </div>
            <div v-if="currentStep === 5" class="step-content">
                <h2>適用品質與規格內容</h2>
                <div class="quality-specification-block">
                    <button class="layer-action-btn add" @click="addQualitySpecificationLayer">新增下一層</button>
                </div>

                <content-block v-for="blockContent in qualitySpecifications"
                    :key="blockContent.id"
                    :step="blockContent.step"
                    :tier="blockContent.tier"
                    :blockContents="blockContent"
                    @delete-block="removeQualitySpecificationLayer(blockContent.id)"
                    @update-block="updateQualitySpecificationData"/>
            </div>
            <div v-if="currentStep === 6" class="step-content">
                <h2>使用表單</h2>
                <div class="used-form">
                    <button class="layer-action-btn add" @click="formWindowVisible=true">新增表單</button>
                </div>

                <div v-for="(formInfo, formIndex) in usedForms" class="form-block" :key="formInfo.id">
                    <div class="form-info-block">
                        <label class="form-label no">5.{{ formIndex + 1 }}</label>
                        <label class="form-label id">{{ formInfo.formId }}</label>  
                        <label class="form-label name">{{ formInfo.formName }}</label>
                    </div>
                    <div class="form-btn-block">
                        <button class="remove-btn" @click="formRemove(formInfo.id)">x</button>
                    </div>
                </div>
            </div>

            <FormSearchWindow 
                v-if="formWindowVisible"
                headerName="表單選取"
                :existingForms="usedForms"
                @add-new-form="addUsedForm"
                @close-window="formWindowVisible=false">
            </FormSearchWindow>
            
            <div v-if="currentStep === 7" class="step-content">
                <h2>其它</h2>
                <div class="other-block">
                    <button class="layer-action-btn add" @click="addOtherLayer">新增下一層</button>
                </div>

                <content-block v-for="blockContent in others"
                    :key="blockContent.id"
                    :step="blockContent.step"
                    :tier="blockContent.tier"
                    :blockContents="blockContent"
                    @delete-block="removeOtherLayer(blockContent.id)"
                    @update-block="updateOtherData"/>
            </div>
            <div v-if="currentStep === 8" class="step-content">
                <div style="display: flex; justify-content: space-between;">
                    <h2>文件產出</h2>
                    <button @click="requestEIPAPI" class="layer-action-btn add">拋轉EIP</button>
                </div>
                <div v-if="pdfSrc" class="pdf-viewer">
                    <iframe :src="pdfSrc" width="100%" height="600px" frameborder="0"></iframe>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from 'axios';
import ContentBlock from '@/components/ContentBlock.vue';
import ManufacturingParamBlock from '@/components/ManufacturingParamBlock.vue';
import FormSearchWindow from '@/components/FormSearchWindow.vue';
import SpecificListWindow from '@/components/SpecificListWindow.vue';
import ItemListWindow from '@/components/ItemListWindow.vue';

export default {
    name: 'NewSpecification',
    components: {
        ContentBlock,
        ManufacturingParamBlock,
        FormSearchWindow,
        SpecificListWindow,
        ItemListWindow
    },
    data() {
        return{
            currentStep: 1,
            steps: [
                {label: "基本屬性"},
                {label: "目的"},
                {label: "製作條件規範"},
                {label: "條件參數一覽表"},
                {label: "適用品質與規格內容"},
                {label: "使用表單"},
                {label: "其他"},
                {label: "文件匯出"},
            ],
            specificsListVisible: false,
            itemsListVisible: false,
            machineGroups: [],
            form: {
                documentType: 1,
                documentID: "",
                documentName: "",
                documentVersion: 1.0,
                attribute: {
                    itemType: "",
                    specific: "",
                    styleNo: "",
                    styleVersion: "",
                },
                // itemType: "",
                // applyProject: "",
                // styleNo: "",
                // styleVersion: "",
                department: sessionStorage.getItem('loggedInUserdeptName'),
                author: sessionStorage.getItem('loggedInUserName'),
                approver: "",
                confirmer: "",
                issueDate: "",
                reviseReason: "",
                revisePoint: "",
                documentStyle: "",
                documentPurpose: "",
            },

            manufacturingSpecifications: [],
            manufacturingSpecificationID: 0,

            manufacturingParameters: [],
            manufacturingParameterID: 0,
            isManufacturingTableDuplicateMap: {},

            qualitySpecifications: [],
            qualitySpecificationID: 0,

            formWindowVisible: false,
            usedForms: [],
            usedFormID: 0,

            others: [],
            otherID: 0,

            pdfSrc: null,
        }
    },
    mounted() {
        this.detectDuplicateManufacturingTables();
    },
    methods: {
        saveDraft(){
            console.log("暫存草稿:", this.form);
            alert("草稿已暫存! (功能待實作)");
        },
        goToStep(step){
            this.currentStep = step;

            if (this.currentStep == 8) {
                this.generateAndDisplayPdf();
            }
        },

        //  Other API function  //
        requestItemFromAPI() {
            return [ {factoryCode: "1011", itemCode: "YD12345"}, {factoryCode: "1011", itemCode: "YD18379"}, {factoryCode: "1011", itemCode: "YD98765"} ]
        },

        //  PMS API function  //
        async requestMachineGroupFromAPI(specific) {
            this.machineGroups = {};
            try {
                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.get(API_BASE_URL + "/MES-get-groups-machines", {params: {specific}})
                this.machineGroups = response.data.data.groups;
            } catch (error) {
                console.error("Error fetching machineGroup: ", error);
            }
        },

        //  基本屬性 - 功能函數  //
        getItemType(payload) {
            if (payload) {
                this.form.attribute.itemType = payload.itemCode;
                this.form.documentName = `${this.form.attribute.itemType}_${this.form.attribute.specific}_製造式樣書`;
            }
            else {
                this.form.attribute.itemType = "";
                this.form.documentName = `${this.form.attribute.itemType}_${this.form.attribute.specific}_製造式樣書`;
            }
        },
        getSpecific(specific_name) {
            this.machineGroups = [];
            if (specific_name) {
                this.form.attribute.specific = `${specific_name}`;
                this.machineGroups = this.requestMachineGroupFromAPI(this.form.attribute.specific);
                this.form.documentName = `${this.form.attribute.itemType}_${this.form.attribute.specific}_製造式樣書`;
            }
            else {
                this.form.attribute.specific = "";
                this.form.documentName = `${this.form.attribute.itemType}__製造式樣書`;
            }
        },

        //  製造條件規範 - 功能函數  //
        addSpecificationLayer() {
            this.manufacturingSpecifications.push({
                id: this.manufacturingSpecificationID++,
                step: 2,
                tier: this.manufacturingSpecifications.length + 1,
                data: [{option: 0, header: "", content: [[""], null]}]
            });
        },
        removeSpecificationLayer(blockId) {
            this.manufacturingSpecifications = this.manufacturingSpecifications.filter(block => block.id !== blockId);
            this.manufacturingSpecifications.forEach((block, index) => {block.tier = index + 1;});
        },
        updateSpecificationData(updateBlockData) {
            const index = this.manufacturingSpecifications.findIndex(block => block.id === updateBlockData.id);
            if (index !== -1) {
                this.manufacturingSpecifications[index] = updateBlockData;
            }
        },

        //  製造條件參數一覽表 - 功能函數  //
        generateCode(prefixCode, code) {
            return prefixCode + String(code).padStart(2, '0');
        },
        addParameterLayer() {
            this.manufacturingParameters.push({
                id: this.manufacturingParameterID++,
                code: this.generateCode("RE233A", this.manufacturingParameters.length + 1),
            });
        },
        removeParameterLayer(blockId) {
            this.manufacturingParameters = this.manufacturingParameters.filter(block => block.id !== blockId);
            this.manufacturingParameters.forEach((block, blockIndex) => block.code = this.generateCode("RE233A", blockIndex + 1));
            this.detectDuplicateManufacturingTables();
        },
        updateParameterData(payload) {
            console.log("payload: ", payload);
            this.manufacturingParameters[payload.tableIndex].machineGroup = payload.tableData.machineGroup;
            this.manufacturingParameters[payload.tableIndex].machine = payload.tableData.machine;
            this.manufacturingParameters[payload.tableIndex].manufacturingParameters = payload.tableData.manufacturingParameters;
            this.detectDuplicateManufacturingTables();
        },
        copyManufacturingTableData(blockIndex) {
            this.manufacturingParameters.push(structuredClone(this.manufacturingParameters[blockIndex]));
            this.manufacturingParameters[this.manufacturingParameters.length - 1].id = this.manufacturingParameterID++;
            this.manufacturingParameters[this.manufacturingParameters.length - 1].code = this.generateCode("RE233A", this.manufacturingParameters.length);
            this.detectDuplicateManufacturingTables();
        },
        // Output serialize table data
        serializeManufacturingTable(tableData) {
            // if table data is none then return false
            if (!tableData || tableData.length <= 1)
                return false
            
            // if table data has empty data then return false
            const tableConcateData = tableData.slice(1).map(item => item.slice(0, 8).join("|")).join("|");
            console.log("tableConcateData: ", tableConcateData);
            if (tableConcateData.indexOf("||") != -1)
                return false;

            // Return string format of table data
            return JSON.stringify(tableData.slice(1));
        },
        // Check duplicate parameter on manufacturing parameter table
        detectDuplicateManufacturingTables() {
            const tableContentOccurrences = new Map(); // storage parameter and duplicate index pair => {"$parameter": [index1, index2, ...]};
            const newDuplicateStatus = {}; // storage duplicate index

            // 先將所有製造參數表標記為不重複
            this.manufacturingParameters.forEach((_, index) => {
                newDuplicateStatus[index] = false;
            });

            this.manufacturingParameters.forEach((block, index) => {
                // 確保 block.manufacturingParameters 存在
                if (!block.manufacturingParameters) {
                    return;
                }
                const serializedContent = this.serializeManufacturingTable(block.manufacturingParameters);
                console.log(index, ", serialized content: ", serializedContent);

                if (serializedContent != false){
                    if (!tableContentOccurrences.has(serializedContent)) {
                        tableContentOccurrences.set(serializedContent, []);
                    }
                    tableContentOccurrences.get(serializedContent).push(index); // 記錄出現的 tableIndex
                }
            });

            // 遍歷出現次數，如果某個內容出現多次，則其對應的 tableIndex 都標記為重複
            // eslint-disable-next-line
            tableContentOccurrences.forEach((indices, content) => {
                if (indices.length > 1) { // 如果同一內容的表格出現了多次，則它們是重複的
                    indices.forEach(idx => newDuplicateStatus[idx] = true);
                }
            });

            // 更新響應式數據，觸發子組件更新
            this.isManufacturingTableDuplicateMap = { ...newDuplicateStatus };
            console.log("Detected duplicate manufacturing tables:", this.isManufacturingTableDuplicateMap);
        },

        //  適用品質與規格內容 - 功能函數  //
        addQualitySpecificationLayer() {
            this.qualitySpecifications.push({
                id: this.qualitySpecificationID++,
                step: 4,
                tier: this.qualitySpecifications.length + 1,
                data: [{option: 0, header: "", content: [[""], null]}]
            });
        },
        removeQualitySpecificationLayer(blockId) {
            this.qualitySpecifications.filter(block => block.id !== blockId);
            this.qualitySpecifications.forEach((block, index) => {block.tier = index + 1;});
        },
        updateQualitySpecificationData(updateBlockData) {
            const index = this.qualitySpecifications.findIndex(block => block.id === updateBlockData.id);
            if (index !== -1) {
                this.qualitySpecifications[index] = updateBlockData;
            }
        },

        //  使用表單 - 功能函數  //
        addUsedForm(payload) {
            this.usedForms.push({id: this.usedFormID++, formId: payload.formId, formName: payload.formName});
            console.log("Used forms: ", this.usedForms);
            this.formWindowVisible = false;
        },
        formRemove(id) {
            this.usedForms = this.usedForms.filter(f => f.id != id);
        },

        //  其他 - 功能函數  //
        addOtherLayer() {
            this.others.push({
                id: this.otherID++,
                step: 6,
                tier: this.others.length + 1,
                data: [{
                    option: 0,
                    header: "",
                    content: [[""], null],
                }]
            });
        },
        removeOtherLayer(blockId) {
            this.others.filter(block => block.id !== blockId);
            this.others.forEach((block, index) => {block.tier = index + 1;});
        },
        updateOtherData(updateBlockData) {
            const index = this.others.findIndex(block => block.id === updateBlockData.id);
            if (index !== -1) {
                this.others[index] = updateBlockData;
            }
        },

        //  文建匯出 - 功能函數  //
        dataURLtoFile(dataurl, filename) {
            const arr = dataurl.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = (mimeMatch && mimeMatch[1]) || 'image/png';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, { type: mime });
        },
        contentBlockProcess(stepType, contentBlocks, dataURLtoFile) {
            const blockData = [];
            const filesToUpload = [];

            // Generate file key for image or file
            const processImage = (file) => {
                const randomId = Math.floor(Math.random() * 90000) + 10000;
                const fileKey = `image_${Date.now()}_${randomId}`;
                filesToUpload.push({ file, key: fileKey });
                return fileKey;
            };

            contentBlocks.forEach(blockItem => {
                if (!blockItem.data) return;

                blockItem.data.forEach((smallBlockItem, blockIndex) => {
                    let currentContent = smallBlockItem.content;
                    
                    // Process text & image data
                    if (smallBlockItem.option === 1) {
                        currentContent = [smallBlockItem.content[0].map(value => (value && value.file) ? processImage(value.file) : value), null];
                    } 
                    // Process table data
                    else if (smallBlockItem.option === 2) {
                        currentContent = smallBlockItem.content.map(row => 
                            row.map(cellValue => {
                                if (typeof cellValue === 'string' && cellValue.includes("data:image")) {
                                    const textPart = cellValue.split('\n').find(p => !p.startsWith("data:image")) || '';
                                    const imagePart = cellValue.split('\n').find(p => p.startsWith("data:image"));
                                    return (textPart ? `${textPart}\n` : '') + processImage(dataURLtoFile(imagePart, `image_${Date.now()}_.png`));
                                }
                                return cellValue;
                            })
                        );
                    }

                    blockData.push({
                        stepType,
                        tier: blockItem.tier,
                        no: blockIndex,
                        contentType: smallBlockItem.option,
                        header: smallBlockItem.header,
                        content: currentContent
                    });
                });
            });

            return { processedData: blockData, filesToUpload: filesToUpload };
        },
        getFormattedDate() {
            const today = new Date();
            const year = today.getFullYear();
            const month = (today.getMonth() + 1).toString().padStart(2, '0'); // getMonth() 回傳 0-11，所以要 +1
            const day = today.getDate().toString().padStart(2, '0');

            return `${year}/${month}/${day}`;
        },
        async generateAndDisplayPdf() {
            this.form.issueDate = this.getFormattedDate()
            let imageFilesToUpload = [];

            let manufacturingSpecifications = (this.manufacturingSpecifications.length > 0) ? this.contentBlockProcess(4, this.manufacturingSpecifications, this.dataURLtoFile) : {processedData: [], filesToUpload: []};
            let manufacturingParameters = this.manufacturingParameters.map(contentBlock => {
                return { stepType: 5, tier: contentBlock.code, no: 0, contentType: 2, header: `${contentBlock.machineGroup}\t${contentBlock.machine}`, content: contentBlock.manufacturingParameters };
            })
            let qualitySpecifications = (this.qualitySpecifications.length > 0) ? this.contentBlockProcess(6, this.qualitySpecifications, this.dataURLtoFile) : {processedData: [], filesToUpload: []};
            let others = (this.others.length > 0) ? this.contentBlockProcess(7, this.others, this.dataURLtoFile) : {processedData: [], filesToUpload: []};

            let usedForms = this.usedForms.map(form => {
                return { referenceType: 1, referenceDocumentID: form.formId, referenceDocumentName: form.formName }
            })

            const queryParams = {
                attribute: [{ ...this.form, documentStyle: "FM-R-MF-AZ-052 Rev11.0-Peter" }],
                content: [...manufacturingSpecifications.processedData, ...manufacturingParameters, ...qualitySpecifications.processedData, ...others.processedData],
                reference: [...usedForms]
            };

            const formData = new FormData();
            formData.append('attribute', JSON.stringify(queryParams.attribute));
            formData.append('content', JSON.stringify(queryParams.content));
            formData.append('reference', JSON.stringify(queryParams.reference));

            imageFilesToUpload = [...manufacturingSpecifications.filesToUpload, ...qualitySpecifications.filesToUpload, ...others.filesToUpload]
            imageFilesToUpload.forEach(item => {
                formData.append(item.key, item.file, item.file.name);
            });

            try {
                console.log('Sending POST request to backend with FormData...');
                const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
                const response = await axios.post(API_BASE_URL + "/generate-pdf", formData, {responseType: 'blob'});
                console.log('Received response from backend. Status:', response.status);

                const pdfBlob = response.data;
                this.pdfSrc = URL.createObjectURL(pdfBlob);
                console.log('PDF Object URL created:', this.pdfSrc);
            } 
            catch (error) {
                console.error('從後端獲取 PDF 失敗:', error);
                alert('生成 PDF 失敗，請檢查後台服務。');
            }
        }
    }
}

</script>

<style scoped>
.new-specification-container {
    width: 90%;
    margin: 30px auto;
    padding: 25px;
    background-color: #ffffff;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}


/*  Page Header Style  */
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
}

.header h1 {
    margin: 0;
    font-size: 28px;
    color: #333;
}

.back-btn, .save-btn {
    display: flex;
    background-color: #6c757d;
    color: white;
    border: none;
    padding: 10px 18px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 15px;
    align-items: center;
    transition: background-color 0.3s ease;
}

.back-btn:hover, .save-btn:hover {
    background-color: #5a6268;
}

.back-btn .icon, .save-btn .icon {
    width: 18px;
    height: 18px;
    margin-right: 8px;
    filter: invert(100%);
}


/*  Step navigation Style  */
.step-navigation {
    display: flex;
    justify-content: space-around;
    margin-bottom: 30px;
    background-color: #e3f2fd;
    padding: 15px 10px;
    border-radius: 8px;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
    position: sticky;
    top: 0;
    z-index: 1000;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.7);
}

.step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.3s ease, transform 0.2s ease;
}

.step-item:hover {
    opacity: 1;
    transform: translateY(-2px);
}

.step-item.active .step-label{
    color: #007bff;
    font-weight: bold;
    opacity: 1;
}

.step-item.completed .step-circle {
    background-color: #28a745;
    color: white;
}

.step-item.active .step-circle {
    background-color: #007bff;
    color: white;
    box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.25);
}

.step-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #cccccc;
    color: #555;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    font-size: 18px;
    margin-bottom: 8px;
    border: 2px solid transparent;
    transition: all 0.3 ease;
}

.step-label {
    font-size: 14px;
    color: #555;
    text-align: center;
}


/*  Content Block Style  */
.form-section {
    padding: 20px 0;
}

.step-content { background-color: #f9f9f9; padding: 25px; border-radius: 8px; min-height: 250px; border: 1px solid #e0e0e0; }
.step-content h2 { font-size: 22px; color: #333; margin-top: 0; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #007bff; display: inline-block; }

/*  Attribute Block Style  */
.fundamental-attribute-block { display: flex; border: unset; padding: 0px; }
.fundamental-attribute-block .attribute { display: flex; flex-direction: column; width: 100%; }
.fundamental-attribute-block .supplement { display: flex; flex-direction: column; width: 100%; }
.form-group { display: flex; flex-direction: row; align-items: center; margin-bottom: 8px; padding: 8px; }
.form-group label { width: 20%; font-size: 15px; color: #555; margin-bottom: 8px; font-weight: bold; }
.form-group input, .form-group textarea, .form-group select { width: 70%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; box-sizing: border-box; transition: border-color 0.2s ease; }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #008bff; outline: none; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);}
.form-group textarea { resize: vertical; min-height: 80px; }
.form-group input[readonly] { background-color: #e9ecef; color: #495057; cursor: not-allowed; }
.form-group input.window-select { background: white; cursor: pointer; }


/*  Purpose Block Page  */
.purpose-group {
    width: 100%;
    flex-grow: 1;
    height: 50%;
}

.purpose-group textarea{
    width: 100%;
    height: 100%;
    min-height: 150px;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    box-sizing: border-box;
    resize: vertical;
    transition: border-color 0.2 ease;
}

.purpose-group textarea:focus{
    border-color: #007bff;
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}


/*  Common Use  */
.layer-action-btn {
    margin: 10px;
    background: #1666C0;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 5px;
    font-size: 14px;
    cursor: pointer;
}

.form-block { display: flex; justify-content: space-between; padding: 10px; margin: 10px 10px; border: 1px solid #ddd; }
.form-label { padding: 8px 10px; }
.form-label.no { border-right: 1px solid #ddd; }
.form-label.id { display: inline-block; width: 200px; border-right: 1px solid #ddd; }
.form-btn-block { display: flex; align-items: center;}
.remove-btn { background: none; border: none; color: red; font-weight: bold; cursor: pointer; font-size: 1.2em; }

</style>