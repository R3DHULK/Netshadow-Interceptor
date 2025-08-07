# NetShadow Interceptor

A dark, glassmorphism-styled Firefox extension for intercepting, analyzing, and manipulating web requests.

## Features

- **Request Interception**: Capture and view all outgoing HTTP/HTTPS requests 
- **Request Inspection**: Examine request headers, parameters, and bodies
- **Response Analysis**: View response status, headers, and bodies
- **Request Manipulation**: Modify and repeat requests with custom parameters
- **Dark Glassmorphism UI**: Modern, hacker-inspired interface

## Installation Instructions

### Temporary Installation (for Development)

1. Download and unzip this extension
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the sidebar
4. Click "Load Temporary Add-on..."
5. Select any file from the extension's directory (e.g., `manifest.json`)

### Permanent Installation

1. Zip all the files into a `.zip` archive
2. Rename the file to have a `.xpi` extension
3. Open Firefox and navigate to `about:addons`
4. Click the gear icon and select "Install Add-on From File..."
5. Select your `.xpi` file

## Usage

1. Click the extension icon in your browser toolbar to open the NetShadow Interceptor interface
2. Toggle the "Intercept" switch to begin capturing requests
3. Select a request from the sidebar to view its details
4. Use the tabs to view request data, response data, or modify and repeat the request
5. In the Repeater tab, modify the request as desired and click "Send Request"

## Interface Guide

- **Request Panel**: View the original request method, URL, headers, and body
- **Response Panel**: Examine the response status, headers, and body content
- **Repeater Panel**: Modify request details and send a new request
- **Request Filter**: Use the search bar to filter requests by URL or method
- **Clear History**: Click the "×" button to clear the request history

## Permissions

This extension requires the following permissions:

- `webRequest`: To intercept and analyze web requests
- `webRequestBlocking`: To temporarily hold requests for analysis
- `<all_urls>`: To work on all websites
- `tabs`: To access tab information
- `storage`: To save extension settings

## Privacy Note

This extension operates entirely locally and does not transmit any data to external servers. All captured request and response data remains within your browser.

## Development

This extension is built using vanilla JavaScript, HTML, and CSS. To contribute:

1. Fork the repository
2. Make your changes
3. Test using the temporary installation method
4. Submit a pull request

## License

MIT License