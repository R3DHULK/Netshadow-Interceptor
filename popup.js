// popup.js
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const interceptToggle = document.getElementById('interceptToggle');
    const requestList = document.getElementById('requestList');
    const requestFilter = document.getElementById('requestFilter');
    const clearBtn = document.getElementById('clearBtn');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Request details elements
    const requestMethod = document.getElementById('requestMethod');
    const requestUrl = document.getElementById('requestUrl');
    const requestHeaders = document.getElementById('requestHeaders');
    const requestBody = document.getElementById('requestBody');

    // Response details elements
    const responseStatus = document.getElementById('responseStatus');
    const responseHeaders = document.getElementById('responseHeaders');
    const responseBody = document.getElementById('responseBody');

    // Repeater elements
    const repeaterMethod = document.getElementById('repeaterMethod');
    const repeaterUrl = document.getElementById('repeaterUrl');
    const repeaterHeaders = document.getElementById('repeaterHeaders');
    const repeaterBody = document.getElementById('repeaterBody');
    const addHeaderBtn = document.getElementById('addHeaderBtn');
    const sendRequestBtn = document.getElementById('sendRequestBtn');

    let currentRequestId = null;
    let allRequests = [];

    // Initialize the UI
    init();

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${button.dataset.tab}Tab`).classList.add('active');
        });
    });

    // Toggle intercept on/off
    interceptToggle.addEventListener('change', () => {
        browser.runtime.sendMessage({
            action: "toggleIntercept",
            enabled: interceptToggle.checked
        });
    });

    // Clear request history
    clearBtn.addEventListener('click', () => {
        browser.runtime.sendMessage({ action: "clearHistory" })
            .then(() => {
                requestList.innerHTML = '';
                allRequests = [];
                clearRequestDetails();
            });
    });

    // Filter requests
    requestFilter.addEventListener('input', () => {
        const filterText = requestFilter.value.toLowerCase();
        refreshRequestList(filterText);
    });

    // Add header in repeater
    addHeaderBtn.addEventListener('click', () => {
        addHeaderRow();
    });

    // Handle removing headers in repeater
    repeaterHeaders.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-header')) {
            event.target.closest('.header-row').remove();
        }
    });

    // Send modified request
    sendRequestBtn.addEventListener('click', () => {
        // Get all header inputs from the repeater
        const headerRows = repeaterHeaders.querySelectorAll('.header-row');
        const headers = Array.from(headerRows)
            .map(row => {
                const nameInput = row.querySelector('.header-name');
                const valueInput = row.querySelector('.header-value');

                if (nameInput && valueInput && nameInput.value.trim() !== '') {
                    return {
                        name: nameInput.value.trim(),
                        value: valueInput.value
                    };
                }
                return null;
            })
            .filter(header => header !== null);

        const modifiedRequest = {
            url: repeaterUrl.value,
            method: repeaterMethod.value,
            headers: headers,
            body: repeaterBody.value
        };

        browser.runtime.sendMessage({
            action: "modifyAndResend",
            requestId: currentRequestId,
            modifiedRequest: modifiedRequest
        }).then(response => {
            // Show notification of successful send
            if (response && response.success) {
                // Switch to the first tab to see the new request in history
                tabButtons[0].click();
            }
        }).catch(error => {
            console.error("Error sending modified request:", error);
        });
    });

    // Initialize the popup
    function init() {
        browser.runtime.sendMessage({ action: "getState" })
            .then(state => {
                interceptToggle.checked = state.interceptEnabled;
                allRequests = state.requestHistory;
                refreshRequestList();
            });

        // Listen for updates from background script
        browser.runtime.onMessage.addListener(message => {
            if (message.action === "newRequest") {
                allRequests.unshift(message.request);
                refreshRequestList();

                // If this is a response to a modified request, select it automatically
                if (message.request.isModified) {
                    loadRequestDetails(message.request.id);
                }
            } else if (message.action === "requestUpdated") {
                // Refresh the selected request if it was updated
                if (currentRequestId === message.requestId) {
                    loadRequestDetails(currentRequestId);
                }

                // Update the request in the list
                const index = allRequests.findIndex(req => req.id === message.requestId);
                if (index !== -1) {
                    browser.runtime.sendMessage({
                        action: "getRequestDetails",
                        requestId: message.requestId
                    }).then(updatedRequest => {
                        allRequests[index] = updatedRequest;
                        refreshRequestList();
                    });
                }
            }
        });
    }

    // Refresh the request list UI
    function refreshRequestList(filterText = '') {
        requestList.innerHTML = '';

        const filteredRequests = filterText ?
            allRequests.filter(req =>
                req.url.toLowerCase().includes(filterText) ||
                req.method.toLowerCase().includes(filterText)
            ) :
            allRequests;

        filteredRequests.forEach(request => {
            const item = document.createElement('div');
            item.className = 'request-item';
            if (request.id === currentRequestId) {
                item.classList.add('selected');
            }

            let displayUrl;
            try {
                const urlParts = new URL(request.url);
                const path = urlParts.pathname.length > 25 ?
                    urlParts.pathname.substring(0, 22) + '...' :
                    urlParts.pathname;
                displayUrl = `<div><span>${urlParts.hostname}</span></div><div class="request-url">${path}</div>`;
            } catch (e) {
                displayUrl = `<div class="request-url">${request.url}</div>`;
            }

            let methodClass = 'method-' + request.method.toLowerCase();
            if (request.isModified) {
                methodClass = 'method-modified';
            }

            let statusClass = 'status-pending';
            if (request.status === 'completed') {
                statusClass = 'status-completed';
            } else if (request.status === 'error') {
                statusClass = 'status-error';
            }

            item.innerHTML = `
                <div>
                    <span class="request-method ${methodClass}">${request.method}</span>
                    ${displayUrl}
                </div>
                <div class="request-status ${statusClass}">
                    ${request.status}${request.statusCode ? ` (${request.statusCode})` : ''}
                </div>
            `;

            item.addEventListener('click', () => {
                document.querySelectorAll('.request-item').forEach(el => {
                    el.classList.remove('selected');
                });
                item.classList.add('selected');
                loadRequestDetails(request.id);
            });

            requestList.appendChild(item);
        });

        // If no request is selected and we have requests, select the first one
        if (currentRequestId === null && filteredRequests.length > 0) {
            loadRequestDetails(filteredRequests[0].id);
        }
    }

    let originalHeaderValues = new Map(); // Store original header values for comparison

    // Load request details
    function loadRequestDetails(requestId) {
        currentRequestId = requestId;
        // Reset header tracking
        originalHeaderValues = new Map();

        browser.runtime.sendMessage({
            action: "getRequestDetails",
            requestId: requestId
        }).then(request => {
            if (!request) return;

            // Request tab
            requestMethod.value = request.method;
            requestUrl.value = request.url;

            // Headers
            requestHeaders.innerHTML = '';
            if (request.requestHeaders) {
                request.requestHeaders.forEach(header => {
                    const headerItem = document.createElement('div');
                    headerItem.className = 'header-item';
                    headerItem.innerHTML = `
                        <span class="header-name">${escapeHtml(header.name)}:</span>
                        <span class="header-value">${escapeHtml(header.value)}</span>
                    `;
                    requestHeaders.appendChild(headerItem);
                });
            }

            // Request body
            if (request.requestBody && request.requestBody.formData) {
                const formData = new URLSearchParams();
                Object.entries(request.requestBody.formData).forEach(([key, values]) => {
                    values.forEach(value => formData.append(key, value));
                });
                requestBody.value = formData.toString();
            } else if (request.requestBody && request.requestBody.raw) {
                // Handle raw data (may be binary)
                const decoder = new TextDecoder();
                try {
                    const rawData = request.requestBody.raw[0].bytes;
                    requestBody.value = decoder.decode(new Uint8Array(rawData));
                } catch (e) {
                    requestBody.value = '[Binary data]';
                }
            } else if (request.requestBody && typeof request.requestBody === 'string') {
                // Handle string body (from modified requests)
                requestBody.value = request.requestBody;
            } else {
                requestBody.value = '';
            }

            // Response tab
            if (request.statusCode) {
                let statusClass = '';
                if (request.statusCode >= 200 && request.statusCode < 300) {
                    statusClass = 'status-2xx';
                } else if (request.statusCode >= 300 && request.statusCode < 400) {
                    statusClass = 'status-3xx';
                } else if (request.statusCode >= 400 && request.statusCode < 500) {
                    statusClass = 'status-4xx';
                } else if (request.statusCode >= 500) {
                    statusClass = 'status-5xx';
                }

                responseStatus.textContent = request.statusCode;
                responseStatus.className = `status-code ${statusClass}`;
            } else {
                responseStatus.textContent = '-';
                responseStatus.className = 'status-code';
            }

            // Response headers
            responseHeaders.innerHTML = '';
            if (request.responseHeaders) {
                request.responseHeaders.forEach(header => {
                    const headerItem = document.createElement('div');
                    headerItem.className = 'header-item';
                    headerItem.innerHTML = `
                        <span class="header-name">${escapeHtml(header.name)}:</span>
                        <span class="header-value">${escapeHtml(header.value)}</span>
                    `;
                    responseHeaders.appendChild(headerItem);
                });
            }

            // Response body
            responseBody.value = request.responseBody || '';

            // Repeater tab - reset headers first
            repeaterHeaders.innerHTML = '';

            // Set method and URL
            repeaterMethod.value = request.method;
            repeaterUrl.value = request.url;

            // Populate repeater headers
            if (request.requestHeaders) {
                request.requestHeaders.forEach(header => {
                    addHeaderRow(header.name, header.value);
                });
            }

            // Add the "Add Header" button after all headers
            const addBtn = document.createElement('button');
            addBtn.id = 'addHeaderBtn';
            addBtn.className = 'btn add-header';
            addBtn.textContent = '+ Add Header';
            addBtn.addEventListener('click', () => addHeaderRow());
            repeaterHeaders.appendChild(addBtn);

            // Populate repeater body
            repeaterBody.value = requestBody.value;
        });
    }

    // Clear request details
    function clearRequestDetails() {
        currentRequestId = null;

        requestMethod.value = '';
        requestUrl.value = '';
        requestHeaders.innerHTML = '';
        requestBody.value = '';

        responseStatus.textContent = '-';
        responseStatus.className = 'status-code';
        responseHeaders.innerHTML = '';
        responseBody.value = '';

        repeaterMethod.value = 'GET';
        repeaterUrl.value = '';

        // Reset repeater headers but keep the add button
        repeaterHeaders.innerHTML = '';
        const addBtn = document.createElement('button');
        addBtn.id = 'addHeaderBtn';
        addBtn.className = 'btn add-header';
        addBtn.textContent = '+ Add Header';
        addBtn.addEventListener('click', () => addHeaderRow());
        repeaterHeaders.appendChild(addBtn);

        repeaterBody.value = '';
    }

    // Then modify the addHeaderRow function to track original values and add highlighting:

    // Add a header row to the repeater
    function addHeaderRow(name = '', value = '') {
        const headerRow = document.createElement('div');
        headerRow.className = 'header-row';
        headerRow.innerHTML = `
            <input type="text" class="header-name" placeholder="Name" value="${escapeHtml(name)}">
            <input type="text" class="header-value" placeholder="Value" value="${escapeHtml(value)}">
            <button class="btn remove-header">×</button>
        `;

        // Store original values to track changes
        const nameInput = headerRow.querySelector('.header-name');
        const valueInput = headerRow.querySelector('.header-value');

        // Create a unique key for this header
        const headerKey = `${headerRow.id || Date.now()}-${name}`;
        originalHeaderValues.set(headerKey, { name, value });

        // Add change listeners to highlight modified headers
        [nameInput, valueInput].forEach(input => {
            input.dataset.originalKey = headerKey;
            input.addEventListener('input', highlightModifiedHeader);
        });

        // Insert before the Add Header button
        const addHeaderBtn = document.getElementById('addHeaderBtn');
        repeaterHeaders.insertBefore(headerRow, addHeaderBtn);

        // Focus on the name field if it's empty (new header)
        if (!name) {
            headerRow.querySelector('.header-name').focus();
        }
    }

    // Add this to the highlightModifiedHeader function
    function highlightModifiedHeader(event) {
        const input = event.target;
        const headerRow = input.closest('.header-row');
        const nameInput = headerRow.querySelector('.header-name');
        const valueInput = headerRow.querySelector('.header-value');
        const originalKey = input.dataset.originalKey;

        const original = originalHeaderValues.get(originalKey);
        if (!original) return;

        // Check if either name or value has changed
        const isModified =
            nameInput.value !== original.name ||
            valueInput.value !== original.value;

        // Get or create the revert button container
        let actionsContainer = headerRow.querySelector('.header-actions');

        if (isModified) {
            headerRow.classList.add('modified-header');

            // Add revert button if it doesn't exist
            if (!actionsContainer) {
                actionsContainer = document.createElement('div');
                actionsContainer.className = 'header-actions';

                const revertBtn = document.createElement('button');
                revertBtn.className = 'btn revert-header';
                revertBtn.title = 'Revert to original';
                revertBtn.innerHTML = '↺';
                revertBtn.dataset.originalKey = originalKey;

                revertBtn.addEventListener('click', function () {
                    const origValues = originalHeaderValues.get(this.dataset.originalKey);
                    if (origValues) {
                        nameInput.value = origValues.name;
                        valueInput.value = origValues.value;
                        headerRow.classList.remove('modified-header');
                        actionsContainer.remove();
                    }
                });

                actionsContainer.appendChild(revertBtn);
                headerRow.appendChild(actionsContainer);
            }
        } else {
            headerRow.classList.remove('modified-header');
            if (actionsContainer) {
                actionsContainer.remove();
            }
        }
    }

    // Helper function to escape HTML
    function escapeHtml(unsafe) {
        if (unsafe === undefined || unsafe === null) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});