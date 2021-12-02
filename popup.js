const filtersEnabled = document.getElementById("filtersEnabled");
const today = document.getElementById("today");
const tomorrow = document.getElementById("tomorrow");
const hideLive = document.getElementById("hideLive");
const sportsbooks = document.getElementById("sportsbooks");
const hideBet = document.getElementById("hideBet");
const minEdge = document.getElementById("minEdge");
const autoCheck = document.getElementById("autoCheck");
const autoCheckInterval = document.getElementById("autoCheckInterval");
const bankroll = document.getElementById("bankroll");
const kellyMultiplier = document.getElementById("kellyMultiplier");
const enableSounds = document.getElementById("enableSounds");
let deletedBets = null;

const getSettings = () => {
    return {
        enabled: filtersEnabled.checked,
        today: today.checked,
        tomorrow: tomorrow.checked,
        hideLive: hideLive.checked,
        hideBet: hideBet.checked,
        sportsbooks: [...sportsbooks.selectedOptions].map((option) => option.value),
        minEdge: minEdge.valueAsNumber,
        deletedBets,
    };
};

const getAutoCheckSettings = () => {
    return {
        enabled: autoCheck.checked,
        interval: autoCheckInterval.valueAsNumber > 0 ? autoCheckInterval.valueAsNumber : 1,
        bankroll: bankroll.valueAsNumber,
        kellyMultiplier: kellyMultiplier.valueAsNumber,
        enableSounds: enableSounds.checked,
    };
};

chrome.storage.sync.get(["filters"], (result) => {
    filtersEnabled.checked = result.filters.enabled;
    today.checked = result.filters.today;
    tomorrow.checked = result.filters.tomorrow;
    hideLive.checked = result.filters.hideLive;
    hideBet.checked = result.filters.hideBet;
    result.filters.sportsbooks.forEach((book) => {
        sportsbooks.querySelector(`option[value="${book}"]`).selected = true;
    });
    minEdge.value = result.filters.minEdge;
    deletedBets = result.filters.deletedBets;
});

chrome.storage.sync.get(["autoCheckSettings"], (result) => {
    autoCheck.checked = result.autoCheckSettings.enabled;
    autoCheckInterval.value = result.autoCheckSettings.interval;
    bankroll.value = result.autoCheckSettings.bankroll;
    kellyMultiplier.value = result.autoCheckSettings.kellyMultiplier;
    enableSounds.checked = result.autoCheckSettings.enableSounds;
});

const setSettings = () => {
    chrome.storage.sync.set({ filters: getSettings() });
};

const setAutoCheckSettings = () => {
    chrome.storage.sync.set({ autoCheckSettings: getAutoCheckSettings() });
};

autoCheck.addEventListener("change", setAutoCheckSettings);
autoCheckInterval.addEventListener("change", setAutoCheckSettings);
bankroll.addEventListener("change", setAutoCheckSettings);
kellyMultiplier.addEventListener("change", setAutoCheckSettings);
enableSounds.addEventListener("change", setAutoCheckSettings);

minEdge.addEventListener("input", setSettings);
hideBet.addEventListener("change", setSettings);
sportsbooks.addEventListener("change", setSettings);
filtersEnabled.addEventListener("change", setSettings);
today.addEventListener("change", setSettings);
tomorrow.addEventListener("change", setSettings);
hideLive.addEventListener("change", setSettings);

document.getElementById("clearHiddenBets").addEventListener("click", () => {
    chrome.storage.sync.get(["filters"], (result) => {
        result.filters.deletedBets = [];
        chrome.storage.sync.set({ filters: result.filters });
    });
});
