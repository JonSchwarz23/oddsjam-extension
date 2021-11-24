const filtersEnabled = document.getElementById("filtersEnabled");
const today = document.getElementById("today");
const tomorrow = document.getElementById("tomorrow");
const hideLive = document.getElementById("hideLive");
const sportsbooks = document.getElementById("sportsbooks");

const getSettings = () => {
	return {
		enabled: filtersEnabled.checked,
		today: today.checked,
		tomorrow: tomorrow.checked,
		hideLive: hideLive.checked,
		sportsbooks: [...sportsbooks.selectedOptions].map(
			(option) => option.value
		),
	};
};

chrome.storage.sync.get(["filters"], function (result) {
	filtersEnabled.checked = result.filters.enabled;
	today.checked = result.filters.today;
	tomorrow.checked = result.filters.tomorrow;
	hideLive.checked = result.filters.hideLive;
	console.log(result.filters.sportsbooks);
	result.filters.sportsbooks.forEach((book) => {
		sportsbooks.querySelector(`option[value="${book}"]`).selected = true;
	});
});

const setSettings = () => {
	chrome.storage.sync.set({ filters: getSettings() });
};

sportsbooks.addEventListener("change", setSettings);
filtersEnabled.addEventListener("change", setSettings);
today.addEventListener("change", setSettings);
tomorrow.addEventListener("change", setSettings);
hideLive.addEventListener("change", setSettings);
