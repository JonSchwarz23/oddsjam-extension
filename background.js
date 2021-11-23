chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url.includes("oddsjam.com/bet-tracker")) {
        chrome.scripting.executeScript({
            target: { tabId },
            func: async () => {
                //sleep function
                const sleep = (ms) => {
                    return new Promise((resolve) => setTimeout(resolve, ms));
                };

                const americanToPercent = (odds) => {
                    if (odds < 0) {
                        return (-1 * odds) / (-1 * odds + 100);
                    } else {
                        return 100 / (odds + 100);
                    }
                };

                //calculate profit from american odds
                const calculateProfit = (odds, stake) => {
                    if (odds > 0) {
                        return (stake * odds) / 100;
                    } else {
                        return (stake / odds) * -100;
                    }
                };

                let table = null;
                let tr = [];

                while (!table || tr.length < 2) {
                    table = document.querySelector("table");
                    if (!table) continue;
                    tr = table.querySelectorAll("tr");
                    await sleep(1000);
                }

                if (!document.getElementById("extension-ev-header")) {
                    const th = document.createElement("th");
                    th.setAttribute("tabindex", "0");
                    th.id = "extension-ev-header";
                    th.innerText = "EV";
                    tr[0].insertBefore(th, tr[0].children[10]);
                }

                //splice array from 1 to end
                Array.from(tr)
                    .slice(1)
                    .forEach((row) => {
                        if (!row.querySelector("#extension-ev-value")) {
                            const td = document.createElement("td");
                            td.id = "extension-ev-value";
                            td.innerText = "$0";
                            row.insertBefore(td, row.children[10]);
                        }

                        const odds = parseInt(row.children[7].innerText);
                        const clv = americanToPercent(parseInt(row.children[8].innerText));
                        const stake = parseFloat(row.children[9].innerText.split("$")[1]);
                        const profit = calculateProfit(odds, stake);
                        const ev = clv * profit - (1 - clv) * stake;

                        row.querySelector("#extension-ev-value").innerText = "$" + ev.toFixed(2);
                    });
            },
        });
    }
});
