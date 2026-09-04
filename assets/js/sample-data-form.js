/**
 * Get Free Sample Data - request-sample-data.html
 * Handles client-side validation, AJAX submission (via Web3Forms - the same
 * form backend already used by the main Coderaim contact form) and the
 * post-submit success/download experience. Vanilla JS, no jQuery dependency,
 * so it degrades safely even if other page scripts fail to load.
 */
(function () {
    "use strict";

    var WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
    var MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    var ALLOWED_FILE_EXTENSIONS = ["pdf", "csv", "xlsx", "xls", "doc", "docx", "txt", "zip"];
    var SUBMIT_COOLDOWN_MS = 30 * 1000;
    var COOLDOWN_STORAGE_KEY = "coderaim_sample_data_last_submit";

    // Maps the "What Data Do You Need?" selection to a real static sample
    // file already shipped under assets/sample-data/. Options with no ready
    // sample fall back to the "our team will prepare it" message instead of
    // a fake/hardcoded link.
    var SAMPLE_FILE_MAP = {
        "ecommerce": "assets/sample-data/ecommerce_sample.csv",
        "product": "assets/sample-data/product_sample.csv",
        "pricing": "assets/sample-data/pricing_sample.csv",
        "real-estate": "assets/sample-data/real_estate_sample.csv",
        "jobs": "assets/sample-data/jobs_sample.csv",
        "travel": "assets/sample-data/travel_sample.csv",
        "business": "assets/sample-data/business_sample.csv"
    };

    var DATA_REQUIRED_LABELS = {
        "ecommerce": "E-commerce Data",
        "product": "Product Data",
        "pricing": "Pricing Data",
        "real-estate": "Real Estate Data",
        "jobs": "Job Data",
        "travel": "Travel Data",
        "business": "Business Data",
        "social-media": "Social Media Data",
        "web-scraping": "Web Scraping Data",
        "custom": "Custom Data"
    };

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("sampleDataForm");
        if (!form) {
            return;
        }

        var submitBtn = document.getElementById("sampleDataSubmitBtn");
        var submitBtnText = submitBtn ? submitBtn.querySelector(".btn-text") : null;
        var formBanner = document.getElementById("sampleDataFormBanner");
        var formWrapper = document.getElementById("sampleDataFormWrapper");
        var successPanel = document.getElementById("sampleDataSuccess");
        var refIdEl = document.getElementById("sampleDataRefId");
        var downloadBtn = document.getElementById("sampleDataDownloadBtn");
        var customNote = document.getElementById("sampleDataCustomNote");
        var fileInput = document.getElementById("attachment");
        var fileUploadLabelText = document.getElementById("fileUploadText");
        var fileUploadWrap = document.getElementById("fileUploadWrap");

        var defaultFileLabel = fileUploadLabelText ? fileUploadLabelText.textContent : "";
        var defaultSubmitLabel = submitBtnText ? submitBtnText.innerHTML : "";

        function showBanner(message, type) {
            if (!formBanner) {
                return;
            }
            formBanner.textContent = message;
            formBanner.className = "rbt-sample-data-form-banner show " + (type === "error" ? "is-error" : "is-info");
        }

        function clearBanner() {
            if (!formBanner) {
                return;
            }
            formBanner.textContent = "";
            formBanner.className = "rbt-sample-data-form-banner";
        }

        function setFieldError(fieldEl, message) {
            var group = fieldEl.closest(".form-group");
            if (!group) {
                return;
            }
            group.classList.add("has-error");
            var errorEl = group.querySelector(".field-error-text");
            if (errorEl && message) {
                errorEl.textContent = message;
            }
            fieldEl.setAttribute("aria-invalid", "true");
        }

        function clearFieldError(fieldEl) {
            var group = fieldEl.closest(".form-group");
            if (!group) {
                return;
            }
            group.classList.remove("has-error");
            fieldEl.removeAttribute("aria-invalid");
        }

        function isValidEmail(value) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        }

        function getFileExtension(filename) {
            var parts = filename.split(".");
            return parts.length > 1 ? parts.pop().toLowerCase() : "";
        }

        function validateFile(showErrors) {
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                if (fileUploadWrap) {
                    fileUploadWrap.classList.remove("has-file");
                }
                if (fileUploadLabelText) {
                    fileUploadLabelText.textContent = defaultFileLabel;
                }
                clearFieldError(fileInput);
                return true;
            }

            var file = fileInput.files[0];
            var ext = getFileExtension(file.name);
            var isAllowedType = ALLOWED_FILE_EXTENSIONS.indexOf(ext) !== -1;
            var isAllowedSize = file.size <= MAX_FILE_SIZE_BYTES;

            if (!isAllowedType || !isAllowedSize) {
                if (showErrors) {
                    setFieldError(
                        fileInput,
                        !isAllowedType
                            ? "Unsupported file type. Allowed: PDF, CSV, XLSX, DOC/DOCX, TXT, ZIP."
                            : "File is too large. Maximum size is 5MB."
                    );
                }
                fileInput.value = "";
                if (fileUploadWrap) {
                    fileUploadWrap.classList.remove("has-file");
                }
                if (fileUploadLabelText) {
                    fileUploadLabelText.textContent = defaultFileLabel;
                }
                return false;
            }

            clearFieldError(fileInput);
            if (fileUploadWrap) {
                fileUploadWrap.classList.add("has-file");
            }
            if (fileUploadLabelText) {
                fileUploadLabelText.textContent = file.name;
            }
            return true;
        }

        if (fileInput) {
            fileInput.addEventListener("change", function () {
                validateFile(true);
            });
        }

        function validateForm() {
            var isValid = true;
            var firstInvalidField = null;

            var requiredFields = form.querySelectorAll("[required]");
            requiredFields.forEach(function (field) {
                var value = (field.value || "").trim();
                var fieldIsValid = true;

                if (field.type === "checkbox") {
                    fieldIsValid = field.checked;
                } else if (!value) {
                    fieldIsValid = false;
                } else if (field.type === "email" && !isValidEmail(value)) {
                    fieldIsValid = false;
                }

                if (!fieldIsValid) {
                    isValid = false;
                    setFieldError(field);
                    if (!firstInvalidField) {
                        firstInvalidField = field;
                    }
                } else {
                    clearFieldError(field);
                }
            });

            if (!validateFile(true)) {
                isValid = false;
                if (!firstInvalidField) {
                    firstInvalidField = fileInput;
                }
            }

            if (!isValid && firstInvalidField) {
                firstInvalidField.focus();
            }

            return isValid;
        }

        // Clear a field's error state as soon as the user starts fixing it.
        form.addEventListener("input", function (event) {
            var target = event.target;
            if (target && target.closest(".form-group")) {
                if (target.type === "email") {
                    if (isValidEmail(target.value.trim())) {
                        clearFieldError(target);
                    }
                } else if (target.value && target.value.trim()) {
                    clearFieldError(target);
                }
            }
        });
        form.addEventListener("change", function (event) {
            var target = event.target;
            if (target && (target.tagName === "SELECT" || target.type === "checkbox")) {
                if (target.type === "checkbox" ? target.checked : target.value) {
                    clearFieldError(target);
                }
            }
        });

        function generateReferenceId() {
            var timestampPart = Date.now().toString(36).toUpperCase();
            var randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
            return "SD-" + timestampPart + "-" + randomPart;
        }

        function setLoading(isLoading) {
            if (!submitBtn) {
                return;
            }
            submitBtn.disabled = isLoading;
            submitBtn.classList.toggle("btn-loading", isLoading);
            if (submitBtnText) {
                submitBtnText.textContent = isLoading ? "Sending your request..." : "";
                if (!isLoading) {
                    submitBtnText.innerHTML = defaultSubmitLabel;
                }
            }
        }

        function isInCooldown() {
            try {
                var last = window.sessionStorage.getItem(COOLDOWN_STORAGE_KEY);
                if (!last) {
                    return false;
                }
                return (Date.now() - parseInt(last, 10)) < SUBMIT_COOLDOWN_MS;
            } catch (e) {
                return false;
            }
        }

        function markSubmitted() {
            try {
                window.sessionStorage.setItem(COOLDOWN_STORAGE_KEY, String(Date.now()));
            } catch (e) {
                /* sessionStorage unavailable (e.g. private mode) - not a hard requirement */
            }
        }

        function showSuccess(dataRequiredValue) {
            if (formWrapper) {
                formWrapper.hidden = true;
            }
            if (!successPanel) {
                return;
            }
            successPanel.hidden = false;

            if (refIdEl) {
                refIdEl.textContent = "Reference ID: " + generateReferenceId();
            }

            var sampleFile = SAMPLE_FILE_MAP[dataRequiredValue];
            if (sampleFile && downloadBtn) {
                downloadBtn.href = sampleFile;
                downloadBtn.hidden = false;
                if (customNote) {
                    customNote.hidden = true;
                }
            } else {
                if (downloadBtn) {
                    downloadBtn.hidden = true;
                }
                if (customNote) {
                    var label = DATA_REQUIRED_LABELS[dataRequiredValue] || "requested";
                    customNote.textContent = "Since you requested " + label + ", our team will prepare a tailored sample and reach out to you directly.";
                    customNote.hidden = false;
                }
            }

            successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            clearBanner();

            if (isInCooldown()) {
                showBanner("You've already submitted a request. Please wait a moment before trying again.", "info");
                return;
            }

            if (!validateForm()) {
                showBanner("Please fix the highlighted fields above and try again.", "error");
                return;
            }

            setLoading(true);
            markSubmitted();

            var dataRequiredEl = document.getElementById("dataRequired");
            var dataRequiredValue = dataRequiredEl ? dataRequiredEl.value : "";
            var formData = new FormData(form);

            fetch(WEB3FORMS_ENDPOINT, {
                method: "POST",
                headers: { Accept: "application/json" },
                body: formData
            })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { success: response.ok };
                    });
                })
                .then(function (result) {
                    setLoading(false);
                    if (result && result.success) {
                        showSuccess(dataRequiredValue);
                    } else {
                        showBanner(
                            (result && result.message) ||
                                "Something went wrong while sending your request. Please try again or email us at info@coderaim.com.",
                            "error"
                        );
                    }
                })
                .catch(function () {
                    setLoading(false);
                    showBanner(
                        "We couldn't reach the server. Please check your connection and try again, or email us at info@coderaim.com.",
                        "error"
                    );
                });
        });
    });
})();
