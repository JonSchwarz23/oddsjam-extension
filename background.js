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
                        const evPercent = (ev / stake) * 100;

                        evPercentElement = row.querySelector("#extension-ev-percent");
                        evPercentElement.innerText = evPercent.toFixed(2) + "%";
                        if (evPercent < 0) evPercentElement.style.color = "red";
                        else if (evPercent < 2) evPercentElement.style.color = "orange";
                        else if (evPercent > 4) evPercentElement.style.color = "green";
                    });

                document.querySelector("h3.card-label").innerText =
                    "EV: $" + totalEV.toFixed(2) + " - EV%: " + ((totalEV * 100) / totalStake).toFixed(2) + "%" + " - Stake: $" + totalStake.toFixed(2);
            },
        });
    }
});

const now = new Date();
now.setDate(now.getDate() + 1);
now.setHours(4);

chrome.alarms.create("clearDeletedBets", {
    when: now / 1,
    periodInMinutes: 24 * 60,
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.filters) updateFilters(changes.filters.newValue);
    if (changes.autoCheckSettings) {
        if (changes.autoCheckSettings.newValue.enabled && changes.autoCheckSettings.newValue.interval) {
            chrome.alarms.create("autoCheck", {
                periodInMinutes: 0.1, //changes.autoCheckSettings.newValue.interval,
            });
        } else {
            chrome.alarms.clear("autoCheck");
        }
    }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "clearDeletedBets") {
        chrome.storage.sync.get(["filters"], async (result) => {
            const filters = result.filters;
            filters.deletedBets = [];
            await chrome.storage.sync.set({ filters });
        });
    }
    if (alarm.name === "autoCheck") {
        const evTabs = await getEvTabs();
        if (evTabs.length === 0) return;
        chrome.storage.sync.set({ autoCheckInProgress: true });
        chrome.scripting.executeScript({
            target: { tabId: evTabs[0].id },
            func: async () => {
                const icon = document.querySelector(".flaticon-refresh");
                if (icon) {
                    icon.click();
                }
            },
        });
    }
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

chrome.runtime.onMessage.addListener(async (request, sender) => {
    if (request.type === "refreshPositiveEV") {
        chrome.storage.sync.get(["filters"], (result) => {
            filterTab(sender.tab, result.filters);
        });
    }
    if (request.type === "deleteBet") {
        chrome.storage.sync.get(["filters"], (result) => {
            if (!result.filters.deletedBets) result.filters.deletedBets = [];
            const length = result.filters.deletedBets.length;
            result.filters.deletedBets = result.filters.deletedBets.filter((bet) => {
                return request.bet.date !== bet.date || request.bet.event !== bet.event || request.bet.market !== bet.market;
            });
            if (result.filters.deletedBets.length === length) {
                result.filters.deletedBets.push(request.bet);
            }
            chrome.storage.sync.set({ filters: result.filters });
        });
    }
    if (request.type === "newBets") {
        chrome.storage.sync.set({ latestBets: request.bets });
        const result = await chrome.storage.sync.get("window");
        if (result.window) return;
        const window = await chrome.windows.create({
            url: chrome.runtime.getURL("betAlert.html"),
            type: "popup",
            height: 600,
            width: 1200,
        });
        chrome.storage.sync.set({ window });
    }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
    const result = await chrome.storage.sync.get("window");
    if (result.window) {
        if (result.window.id === windowId) {
            chrome.storage.sync.set({ window: null });
        }
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
    const { autoCheckInProgress } = (await chrome.storage.sync.get("autoCheckInProgress")) || false;
    chrome.storage.sync.set({ autoCheckInProgress: false });
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (filters, autoCheckInProgress) => {
            const sleep = (ms) => {
                return new Promise((resolve) => setTimeout(resolve, ms));
            };

            const rowToKey = (row) => {
                return {
                    date: row.children[4].innerText.replaceAll("\n", " "),
                    event: row.children[5].innerText.replaceAll("\n", " "),
                    market: row.children[8].innerText.replaceAll("\n", " "),
                };
            };

            const rowToData = (row) => {
                const percent = row.children[3].innerText.split("\n");
                const interestedSide = percent[0] === "–" ? 1 : 0;
                return {
                    percent: percent[interestedSide],
                    date: row.children[4].innerText,
                    event: row.children[5].innerText,
                    odds: row.children[6].innerText.split("\n")[interestedSide].trim(),
                    oppositeOdds: row.children[6].innerText.split("\n")[interestedSide === 0 ? 1 : 0].trim(),
                    books: [...row.children[6].querySelectorAll("div")[interestedSide].querySelectorAll("img")].map((img) => img.alt),
                    oddsjamOdds: row.children[7].innerText.split("\n")[interestedSide].trim(),
                    market: row.children[8].innerText.split("\n")[interestedSide],
                };
            };

            const compareKeys = (a, b) => {
                return a.date === b.date && a.event === b.event && a.market === b.market;
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
                if (!filters.enabled) return "show";

                const date = row.children[4].innerText;
                if (filters.today || filters.tomorrow) {
                    if ((!filters.today || !date.includes("Today")) && (!filters.tomorrow || !date.includes("Tomorrow"))) {
                        return "hide";
                    }
                }

                if (filters.hideLive && date.includes("Live")) return "hide";

                if (filters.sportsbooks.length > 0) {
                    let valid = false;
                    const interestedSide = row.children[3].innerText[0] === "–" ? 1 : 0;
                    const sportsbooks = [...row.children[6].querySelectorAll("div")[interestedSide].querySelectorAll("img")].map((img) => img.alt);
                    for (const book of filters.sportsbooks) {
                        if (sportsbooks.includes(book)) {
                            valid = true;
                            break;
                        }
                    }

                    if (!valid) return "hide";
                }

                if (filters.hideBet && row.children[2].querySelector(".svg-icon-success")) return "hide";

                if (filters.minEdge) {
                    let edgeString = row.children[3].innerText;
                    if (edgeString[0] === "–") edgeString = edgeString.substring(1);
                    else edgeString = edgeString.substring(0, edgeString.length - 1);
                    const edge = parseFloat(edgeString.substring(0, edgeString.length - 1));
                    if (filters.minEdge > edge) return "hide";
                }

                if (filters.deletedBets) {
                    const key = rowToKey(row);
                    if (filters.deletedBets.find((bet) => compareKeys(bet, key))) return "dim";
                }

                return "show";
            };

            const trashIcon = `
                <svg width="24px" height="24px" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                    <title>Stockholm-icons / General / Trash</title>
                    <desc>Created with Sketch.</desc>
                    <defs></defs>
                    <g id="Stockholm-icons-/-General-/-Trash" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                        <rect id="bound" x="0" y="0" width="24" height="24"></rect>
                        <path d="M6,8 L6,20.5 C6,21.3284271 6.67157288,22 7.5,22 L16.5,22 C17.3284271,22 18,21.3284271 18,20.5 L18,8 L6,8 Z" id="round" fill="#000000" fill-rule="nonzero"></path>
                        <path d="M14,4.5 L14,4 C14,3.44771525 13.5522847,3 13,3 L11,3 C10.4477153,3 10,3.44771525 10,4 L10,4.5 L5.5,4.5 C5.22385763,4.5 5,4.72385763 5,5 L5,5.5 C5,5.77614237 5.22385763,6 5.5,6 L18.5,6 C18.7761424,6 19,5.77614237 19,5.5 L19,5 C19,4.72385763 18.7761424,4.5 18.5,4.5 L14,4.5 Z" id="Shape" fill="#000000" opacity="0.3"></path>
                    </g>
                </svg>
            `;

            if (!document.querySelector("#hide-row-header")) {
                const header = document.createElement("th");
                header.id = "hide-row-header";
                rows[0].insertBefore(header, rows[0].children[0]);
            }

            [...rows].slice(1).forEach((row) => {
                if (row.querySelector("#hide-row")) return;

                const hideRow = document.createElement("td");
                hideRow.id = "hide-row";
                hideRow.style = "z-index: 1000; cursor: pointer; opacity: 1;";

                hideRow.addEventListener("click", (event) => {
                    chrome.runtime.sendMessage({
                        type: "deleteBet",
                        bet: rowToKey(hideRow.parentElement),
                    });
                    event.stopPropagation();
                    event.preventDefault();
                });

                const hideRowIcon = document.createElement("span");
                hideRowIcon.classList.add("svg-icon", "svg-icon-md", "svg-icon-danger");
                hideRowIcon.innerHTML = trashIcon;
                hideRow.appendChild(hideRowIcon);
                row.insertBefore(hideRow, row.children[0]);
            });

            const betsToSend = [];

            [...rows].slice(1).forEach((row) => {
                const display = displayRow(row);
                if (display === "show") {
                    row.style.display = "";
                    row.style.opacity = "1";
                } else if (display === "dim") {
                    row.style.display = "";
                    row.style.opacity = "0.5";
                } else row.style.display = "none";

                if (display === "show" && autoCheckInProgress) {
                    betsToSend.push(rowToData(row));
                }
            });

            if (betsToSend.length > 0) {
                chrome.runtime.sendMessage({
                    type: "newBets",
                    bets: betsToSend,
                });
            }
        },
        args: [filters, autoCheckInProgress],
    });
};
