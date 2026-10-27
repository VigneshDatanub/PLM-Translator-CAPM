sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (ControllerExtension, Fragment, JSONModel, MessageToast, MessageBox) {
    "use strict";

    var _oSingleDialog = null;
    var _oMassDialog = null;
    var _oInstance = null;

    return ControllerExtension.extend("sap.plm.translator.ext.controller.ListReportExtension", {
        override: {},

        /**
         * Open Single Translation Dialog
         */
        onSingleTranslate: function () {
            var that = this;
            _oInstance = this;
            var oView = this.base && this.base.getView ? this.base.getView() : null;

            if (!_oSingleDialog) {
                var sFragmentId = oView ? oView.getId() + "--singleDialog" : undefined;
                Fragment.load({
                    id: sFragmentId,
                    name: "sap.plm.translator.ext.fragment.SingleTranslationDialog",
                    controller: that
                }).then(function (oDialog) {
                    _oSingleDialog = oDialog;
                    that._oSingleDialog = oDialog;
                    if (oView) {
                        oView.addDependent(oDialog);
                    }
                    that._initSingleModel();
                    _oSingleDialog.open();
                }).catch(function (err) {
                    MessageBox.error("Failed to load Single Translation Dialog: " + err.message);
                });
            } else {
                that._initSingleModel();
                _oSingleDialog.open();
            }
        },

        _initSingleModel: function () {
            var oDialog = this._oSingleDialog || _oSingleDialog;
            if (!oDialog) {
                return;
            }
            var oModel = new JSONModel({
                text: "",
                targetLanguage: "de",
                translatedText: "",
                detectedLanguage: "Auto-detect",
                outcome: "Success",
                accuracy: 100,
                testedBy: "Reviewer",
                observation: "",
                busy: false
            });
            oDialog.setModel(oModel, "singleTranslate");
        },

        /**
         * Execute Single Translation via Google Cloud Translation API
         */
        onExecuteSingleTranslate: function () {
            var oDialog = this._oSingleDialog || _oSingleDialog;
            if (!oDialog) {
                return;
            }
            var oModel = oDialog.getModel("singleTranslate");
            var oData = oModel ? oModel.getData() : {};

            if (!oData.text || !oData.text.trim()) {
                MessageBox.warning("Please enter source text to translate.");
                return;
            }

            if (!oData.targetLanguage) {
                MessageBox.warning("Please select a target language.");
                return;
            }

            oModel.setProperty("/busy", true);

            fetch("/api/translator/translateText", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: oData.text.trim(),
                    targetLanguage: oData.targetLanguage
                })
            })
            .then(function (res) {
                return res.text().then(function (text) {
                    var json = text ? JSON.parse(text) : {};
                    if (!res.ok) {
                        throw new Error((json.error && json.error.message) || "Translation failed");
                    }
                    return json;
                });
            })
            .then(function (data) {
                oModel.setProperty("/translatedText", data.translated_text || "");
                oModel.setProperty("/detectedLanguage", data.detected_source_language || "auto");
                MessageToast.show("Translation successful!");
            })
            .catch(function (err) {
                MessageBox.error("Translation Error: " + err.message);
            })
            .finally(function () {
                oModel.setProperty("/busy", false);
            });
        },

        /**
         * Save translated result into the TestResults database table
         */
        onSaveSingleResult: function () {
            var that = this;
            var oDialog = this._oSingleDialog || _oSingleDialog;
            if (!oDialog) {
                return;
            }
            var oModel = oDialog.getModel("singleTranslate");
            var oData = oModel ? oModel.getData() : {};

            if (!oData.translatedText) {
                MessageBox.warning("No translated output to save. Please translate first.");
                return;
            }

            oModel.setProperty("/busy", true);

            fetch("/api/translator/saveTestResult", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceText: oData.text,
                    translatedText: oData.translatedText,
                    sourceLanguage: oData.detectedLanguage || "auto",
                    targetLanguage: oData.targetLanguage,
                    outcome: oData.outcome,
                    accuracy: parseFloat(oData.accuracy) || 100,
                    observation: oData.observation || "Single UI translation test",
                    testedBy: oData.testedBy || "Reviewer",
                    sessionId: "single_" + Date.now()
                })
            })
            .then(function (res) {
                return res.text().then(function (text) {
                    var json = text ? JSON.parse(text) : {};
                    if (!res.ok) {
                        throw new Error((json.error && json.error.message) || "Failed to save record");
                    }
                    return json;
                });
            })
            .then(function () {
                MessageToast.show("Translation record saved to database!");
                oDialog.close();

                // Refresh the Fiori Elements List Report table
                var oInst = that || _oInstance;
                if (oInst && oInst.base && oInst.base.getExtensionAPI && oInst.base.getExtensionAPI().refresh) {
                    oInst.base.getExtensionAPI().refresh();
                } else if (oInst && oInst.base && oInst.base.getView && oInst.base.getView().getModel()) {
                    oInst.base.getView().getModel().refresh();
                }
            })
            .catch(function (err) {
                MessageBox.error("Save Error: " + err.message);
            })
            .finally(function () {
                oModel.setProperty("/busy", false);
            });
        },

        onCloseSingleDialog: function () {
            var oDialog = this._oSingleDialog || _oSingleDialog;
            if (oDialog) {
                oDialog.close();
            }
        },

        /**
         * Open Mass Translation Dialog
         */
        onMassTranslate: function () {
            var that = this;
            _oInstance = this;
            var oView = this.base && this.base.getView ? this.base.getView() : null;

            if (!_oMassDialog) {
                var sFragmentId = oView ? oView.getId() + "--massDialog" : undefined;
                Fragment.load({
                    id: sFragmentId,
                    name: "sap.plm.translator.ext.fragment.MassTranslationDialog",
                    controller: that
                }).then(function (oDialog) {
                    _oMassDialog = oDialog;
                    that._oMassDialog = oDialog;
                    if (oView) {
                        oView.addDependent(oDialog);
                    }
                    that._initMassModel();
                    _oMassDialog.open();
                }).catch(function (err) {
                    MessageBox.error("Failed to load Mass Translation Dialog: " + err.message);
                });
            } else {
                that._initMassModel();
                _oMassDialog.open();
            }
        },

        _initMassModel: function () {
            var oDialog = this._oMassDialog || _oMassDialog;
            if (!oDialog) {
                return;
            }
            var oModel = new JSONModel({
                fileBase64: "",
                fileName: "",
                targetLanguages: ["de", "es"],
                testedBy: "Batch Tester",
                busy: false,
                statusMessage: "",
                jobId: ""
            });
            oDialog.setModel(oModel, "massTranslate");
        },

        onMassFileSelected: function (oEvent) {
            var oDialog = this._oMassDialog || _oMassDialog;
            var oModel = oDialog ? oDialog.getModel("massTranslate") : null;
            if (!oModel) {
                return;
            }

            var aFiles = oEvent.getParameter("files");
            var oFile = aFiles && aFiles.length > 0 ? aFiles[0] : null;

            if (!oFile && oEvent.getSource) {
                var oDomRef = oEvent.getSource().getDomRef("fu");
                if (oDomRef && oDomRef.files && oDomRef.files.length > 0) {
                    oFile = oDomRef.files[0];
                }
            }

            if (!oFile) {
                oModel.setProperty("/fileBase64", "");
                oModel.setProperty("/fileName", "");
                return;
            }

            var reader = new FileReader();
            reader.onload = function (e) {
                var sDataUrl = e.target.result;
                var sBase64 = sDataUrl.indexOf(",") > -1 ? sDataUrl.split(",")[1] : sDataUrl;
                oModel.setProperty("/fileBase64", sBase64);
                oModel.setProperty("/fileName", oFile.name);
                MessageToast.show("Excel loaded: " + oFile.name + " (" + Math.round(oFile.size / 1024) + " KB)");
            };
            reader.readAsDataURL(oFile);
        },

        onExecuteMassTranslate: function () {
            var that = this;
            var oDialog = this._oMassDialog || _oMassDialog;
            if (!oDialog) {
                return;
            }
            var oModel = oDialog.getModel("massTranslate");
            var oData = oModel ? oModel.getData() : {};

            if (!oData.fileBase64) {
                MessageBox.warning("Please choose an Excel file (.xlsx or .xls) first.");
                return;
            }

            // Ensure targetLanguages array is populated
            var aTargetLanguages = oData.targetLanguages;
            if (!aTargetLanguages || !Array.isArray(aTargetLanguages) || aTargetLanguages.length === 0) {
                MessageBox.warning("Please select at least one target language.");
                return;
            }

            oModel.setProperty("/busy", true);
            oModel.setProperty("/statusMessage", "Uploading and queuing batch translation job...");

            fetch("/api/translator/massTranslate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileContentBase64: oData.fileBase64,
                    targetLanguages: aTargetLanguages,
                    testedBy: oData.testedBy || "Batch Tester"
                })
            })
            .then(function (res) {
                return res.text().then(function (text) {
                    var json = text ? JSON.parse(text) : {};
                    if (!res.ok) {
                        throw new Error((json.error && json.error.message) || "Batch job submission failed");
                    }
                    return json;
                });
            })
            .then(function (data) {
                oModel.setProperty("/jobId", data.jobId);
                oModel.setProperty("/statusMessage", data.message + " (" + data.totalRows + " rows per language)");
                MessageBox.information("Batch Translation Started!\n\nJob ID: " + data.jobId + "\nTotal rows: " + data.totalRows + "\n\nRecords will appear in the table as batches complete.");

                // Automatically refresh table after job starts
                setTimeout(function () {
                    var oInst = that || _oInstance;
                    if (oInst && oInst.base && oInst.base.getExtensionAPI && oInst.base.getExtensionAPI().refresh) {
                        oInst.base.getExtensionAPI().refresh();
                    } else if (oInst && oInst.base && oInst.base.getView && oInst.base.getView().getModel()) {
                        oInst.base.getView().getModel().refresh();
                    }
                }, 2500);
            })
            .catch(function (err) {
                MessageBox.error("Batch Error: " + err.message);
                oModel.setProperty("/statusMessage", "Failed: " + err.message);
            })
            .finally(function () {
                oModel.setProperty("/busy", false);
            });
        },

        onCloseMassDialog: function () {
            var oDialog = this._oMassDialog || _oMassDialog;
            if (oDialog) {
                oDialog.close();
            }
            var oInst = this || _oInstance;
            if (oInst && oInst.base && oInst.base.getExtensionAPI && oInst.base.getExtensionAPI().refresh) {
                oInst.base.getExtensionAPI().refresh();
            }
        }
    });
});
