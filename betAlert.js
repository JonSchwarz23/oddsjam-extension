const betReturn = (wager, odds) => {
    let numOdds = parseFloat(odds.substring(1));
    if (odds[0] === "-") {
        return 100 * wager * (1 / odds.substring(1, odds.length));
    } else {
        return (wager * odds) / 100;
    }
};

const getWinPercentage = (percent, odds) => {
    const percentNum = parseFloat(percent.substring(0, percent.length - 1));
    return (100 + percentNum) / (100 + betReturn(100, odds));
};

const oddsToDecimal = (odds) => {
    let numOdds = parseFloat(odds.substring(1));
    if (odds[0] === "-") {
        return 100 / numOdds;
    } else {
        return numOdds / 100;
    }
};

const getBankrollToWager = (percent, odds, multiplier) => {
    const b = oddsToDecimal(odds);
    const p = getWinPercentage(percent, odds);
    const q = 1 - p;
    return (multiplier * (b * p - q)) / b;
};

getBankrollToWager("2.63%", "-110", 0.5);

const table = document.querySelector("tbody");

let sound = null;
let autoCheckSettings = null;

const addRows = (latestBets) => {
    latestBets.forEach(function (bet) {
        const row = document.createElement("template");
        row.innerHTML = `
            <tr>
                <td>${bet.percent}</td>
                <td>${bet.date}</td>
                <td>${bet.event}</td>
                <td>${bet.books.join(", ")}</td>
                <td>${bet.odds}</td>
                <td>${bet.oppositeOdds}</td>
                <td>${bet.oddsjamOdds}</td>
                <td>${bet.market}</td>
                <td>$${(getBankrollToWager(bet.percent, bet.odds, autoCheckSettings.kellyMultiplier || 1) * (autoCheckSettings.bankroll || 1000)).toFixed(
                    2
                )}</td>
            </tr>
        `;
        table.appendChild(row.content.cloneNode(true));
    });
};

chrome.storage.sync.get(["latestBets", "autoCheckSettings"], function (result) {
    console.log();
    if (result.autoCheckSettings.enableSounds) {
        sound = new Audio("alert.wav");
        sound.loop = true;
        sound.play();
        console.log("Playing...");
    }

    autoCheckSettings = result.autoCheckSettings;
    addRows(result.latestBets);
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.latestBets) {
        table.innerHTML = "";
        addRows(changes.latestBets.newValue);
    }
});

window.addEventListener("click", () => {
    if (sound) sound.pause();
});
