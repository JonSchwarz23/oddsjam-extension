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
                    await sleep(1000);
                    table = document.querySelector("table");
                    if (!table) continue;
                    tr = table.querySelectorAll("tr");
                }

                if (!document.getElementById("extension-ev-header")) {
                    const th = document.createElement("th");
                    th.setAttribute("tabindex", "0");
                    th.id = "extension-ev-header";
                    th.innerText = "EV";
                    tr[0].insertBefore(th, tr[0].children[10]);
                }

                if (!document.getElementById("extension-ev-header-percent")) {
                    const th = document.createElement("th");
                    th.setAttribute("tabindex", "0");
                    th.id = "extension-ev-header-percent";
                    th.innerText = "EV%";
                    tr[0].insertBefore(th, tr[0].children[11]);
                }

                let totalEV = 0;
                let totalStake = 0;

                Array.from(tr)
                    .slice(1)
                    .forEach((row) => {
                        if (!row.querySelector("#extension-ev-value")) {
                            const td = document.createElement("td");
                            td.id = "extension-ev-value";
                            td.innerText = "$0";
                            row.insertBefore(td, row.children[10]);
                        }

                        if (!row.querySelector("#extension-ev-percent")) {
                            const td = document.createElement("td");
                            td.id = "extension-ev-percent";
                            td.innerText = "0%";
                            row.insertBefore(td, row.children[11]);
                        }

                        const odds = parseInt(row.children[7].innerText);
                        const clv = americanToPercent(parseInt(row.children[8].innerText));
                        const stake = parseFloat(row.children[9].innerText.split("$")[1]);
                        const profit = calculateProfit(odds, stake);
                        const ev = clv * profit - (1 - clv) * stake;
                        if (ev) {
                            totalEV += ev;
                            totalStake += stake;
                        }

                        row.querySelector("#extension-ev-value").innerText = "$" + ev.toFixed(2);
                        const evPercent = (ev / stake * 100);

                        evPercentElement = row.querySelector("#extension-ev-percent");
                        evPercentElement.innerText = evPercent.toFixed(2) + "%";
                        if(evPercent < 1) evPercentElement.style.color = "red";
                        else if(evPercent < 2.5 ) evPercentElement.style.color = "orange";
                        else if (evPercent > 4) evPercentElement.style.color = "green";
                    });

                document.querySelector("h3.card-label").innerText =
                    "EV: $" + totalEV.toFixed(2) + " - EV%: " + ((totalEV * 100) / totalStake).toFixed(2) + "%" + " - Stake: $" + totalStake.toFixed(2);
            },
        });
    }
});

//listed for storage update
chrome.storage.onChanged.addListener((changes) => {
    updateFilters(changes.filters.newValue);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url.includes("oddsjam.com/positive-ev")) {
        chrome.scripting.executeScript({
            target: { tabId },
            func: async () => {
                const sleep = (ms) => {
                    return new Promise((resolve) => setTimeout(resolve, ms));
                };

                let button = null;

                while (true) {
                    const icon = document.querySelector(".flaticon-refresh");
                    if (icon) {
                        button = icon.parentElement;
                        break;
                    }
                    await sleep(1000);
                }

                button.addEventListener("click", () => {
                    chrome.runtime.sendMessage({
                        type: "refreshPositiveEV",
                    });
                });
            },
        });

        chrome.storage.sync.get(["filters"], (result) => {
            filterTab(tab, result.filters);
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.type === "refreshPositiveEV") {
        chrome.storage.sync.get(["filters"], (result) => {
            filterTab(sender.tab, result.filters);
        });
    }
});

const getEvTabs = async () => {
    const tabs = await chrome.tabs.query({
        url: "*://oddsjam.com/positive-ev",
    });
    return tabs;
};

const updateFilters = async (filters) => {
    const tabs = await getEvTabs();
    tabs.forEach((tab) => filterTab(tab, filters));
};

const filterTab = async (tab, filters) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (filters) => {
            const sleep = (ms) => {
                return new Promise((resolve) => setTimeout(resolve, ms));
            };

            let table = null;
            let rows = [];

            console.log(filters);

            while (true) {
                table = document.querySelector("table");
                if (table) {
                    rows = table.querySelectorAll("tr");
                    if (rows.length > 2) {
                        break;
                    }
                }
                await sleep(1000);
            }

            const displayRow = (row) => {
                if (!filters.enabled) return true;

                const date = row.children[3].innerText;

                if (filters.today || filters.tomorrow) {
                    if ((!filters.today || !date.includes("Today")) && (!filters.tomorrow || !date.includes("Tomorrow"))) {
                        return false;
                    }
                }

                if (filters.hideLive && date.includes("Live")) return false;

                if (filters.sportsbooks.length > 0) {
                    let valid = false;
                    const interestedSide = row.children[2].innerText[0] === "–" ? 1 : 0;
                    const sportsbooks = [...row.children[5].querySelectorAll("div")[interestedSide].querySelectorAll("img")].map((img) => img.alt);
                    for (const book of filters.sportsbooks) {
                        if (sportsbooks.includes(book)) {
                            valid = true;
                            break;
                        }
                    }

                    if (!valid) return false;
                }

                if (filters.hideBet && row.children[1].querySelector(".svg-icon-success")) return false;

                if(filters.minEdge) {
                    let edgeString = row.children[2].innerText;
                    console.log(edgeString);
                    if(edgeString[0] === "–") edgeString = edgeString.substring(1);
                    else edgeString = edgeString.substring(0, edgeString.length - 1);
                    const edge = parseFloat(edgeString.substring(0, edgeString.length - 1));
                    if(filters.minEdge > edge) return false;
                }

                return true;
            };

            [...rows].slice(1).forEach((row) => {
                row.style.display = displayRow(row) ? "" : "none";
            });
        },
        args: [filters],
    });
};
