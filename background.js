// background.js
let interceptEnabled = false;
let pendingRequests = {};
let requestHistory = [];
let requestId = 0;

// Initialize settings
browser.storage.local.get('interceptEnabled').then(result => {
    interceptEnabled = result.interceptEnabled || false;
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getState") {
        sendResponse({
            interceptEnabled: interceptEnabled,
            requestHistory: requestHistory
        });
    } else if (message.action === "toggleIntercept") {
        interceptEnabled = message.enabled;
        browser.storage.local.set({ interceptEnabled });
        sendResponse({ success: true });
    } else if (message.action === "getRequestDetails") {
        sendResponse(requestHistory.find(req => req.id === message.requestId));
    } else if (message.action === "modifyAndResend") {
        // Clone the original request with modifications
        const originalRequest = requestHistory.find(req => req.id === message.requestId);
        if (originalRequest) {
            sendModifiedRequest(message.modifiedRequest, originalRequest);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: "Request not found" });
        }
    } else if (message.action === "clearHistory") {
        requestHistory = [];
        sendResponse({ success: true });
    }
    return true; // Required for async sendResponse
});

// Intercept web requests
browser.webRequest.onBeforeRequest.addListener(
    details => {
        if (!interceptEnabled) return {};

        // Only intercept main document and XHR/fetch requests
        if (details.type !== "main_frame" && details.type !== "xmlhttprequest") {
            return {};
        }

        // Add request to history
        const request = {
            id: ++requestId,
            url: details.url,
            method: details.method,
            type: details.type,
            timeStamp: details.timeStamp,
            requestHeaders: null, // Will be populated in onBeforeSendHeaders
            requestBody: details.requestBody,
            responseHeaders: null, // Will be populated in onHeadersReceived
            responseBody: null, // Can't access response body directly due to Firefox limitations
            status: "pending"
        };

        requestHistory.unshift(request);
        if (requestHistory.length > 100) requestHistory.pop(); // Limit history size

        // Notify UI if open
        browser.runtime.sendMessage({ action: "newRequest", request }).catch(() => {
            // Popup not open, ignore error
        });

        return {}; // Don't block the request
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestBody"]
);

// Capture request headers
browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
        if (!interceptEnabled) return {};

        const request = requestHistory.find(req =>
            req.url === details.url &&
            req.timeStamp === details.timeStamp
        );

        if (request) {
            request.requestHeaders = details.requestHeaders;
        }

        return {};
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);

// Capture response headers
browser.webRequest.onHeadersReceived.addListener(
    details => {
        if (!interceptEnabled) return {};

        const request = requestHistory.find(req =>
            req.url === details.url &&
            req.timeStamp === details.timeStamp
        );

        if (request) {
            request.responseHeaders = details.responseHeaders;
            request.statusCode = details.statusCode;
            request.status = "completed";

            // Notify UI if open
            browser.runtime.sendMessage({
                action: "requestUpdated",
                requestId: request.id
            }).catch(() => {
                // Popup not open, ignore error
            });
        }

        return {};
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders"]
);

// Function to send a modified request
function sendModifiedRequest(modifiedRequest, originalRequest) {
    // Create a new entry in request history
    const request = {
        id: ++requestId,
        url: modifiedRequest.url,
        method: modifiedRequest.method,
        type: "modified",
        timeStamp: Date.now(),
        requestHeaders: modifiedRequest.headers,
        requestBody: modifiedRequest.body,
        responseHeaders: null,
        responseBody: null,
        status: "pending",
        isModified: true,
        originalRequestId: originalRequest.id
    };

    requestHistory.unshift(request);

    // Notify UI
    browser.runtime.sendMessage({
        action: "newRequest",
        request
    }).catch(() => {
        // Popup not open, ignore error
    });

    // Prepare headers for fetch
    const headerObj = {};
    modifiedRequest.headers.forEach(header => {
        headerObj[header.name] = header.value;
    });

    // Perform the actual request
    fetch(modifiedRequest.url, {
        method: modifiedRequest.method,
        headers: headerObj,
        body: modifiedRequest.method !== "GET" && modifiedRequest.method !== "HEAD" ?
            modifiedRequest.body : undefined,
        credentials: "include"
    })
        .then(response => {
            // Store response headers
            const responseHeaders = [];
            response.headers.forEach((value, name) => {
                responseHeaders.push({ name, value });
            });

            request.responseHeaders = responseHeaders;
            request.statusCode = response.status;

            return response.text();
        })
        .then(responseText => {
            request.responseBody = responseText;
            request.status = "completed";

            // Notify UI
            browser.runtime.sendMessage({
                action: "requestUpdated",
                requestId: request.id
            }).catch(() => {
                // Popup not open, ignore error
            });
        })
        .catch(error => {
            request.status = "error";
            request.error = error.toString();

            // Notify UI
            browser.runtime.sendMessage({
                action: "requestUpdated",
                requestId: request.id
            }).catch(() => {
                // Popup not open, ignore error
            });
        });
}