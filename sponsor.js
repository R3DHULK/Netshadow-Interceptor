// Add near the bottom of the init() function or where other event listeners are set up
document.querySelectorAll('.sponsor-btn, .donation-btn').forEach(button => {
    button.addEventListener('click', (event) => {
        const buttonText = event.target.textContent;
        let amount = '10';

        if (buttonText.includes('Basic')) {
            amount = '5';
        } else if (buttonText.includes('Enterprise')) {
            amount = '50';
        } else if (buttonText.match(/\$\d+/)) {
            // Extract amount from button text for one-time donations
            amount = buttonText.match(/\$(\d+)/)[1];
        }

        // Open the sponsor website in a new tab
        browser.tabs.create({
            url: `https://example.com/sponsor?amount=${amount}&from=extension`
        });
    });
});